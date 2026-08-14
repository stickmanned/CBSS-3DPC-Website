import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";
import { requireAdmin } from "@/app/lib/auth";
import { getDatabase } from "@/app/lib/db";
import {
  adminUser,
  emailDelivery,
  printRequest,
  requestEvent,
  requestFile,
} from "@/app/lib/db/schema";
import {
  MATERIAL_KINDS,
  REQUEST_STATUSES,
  type MaterialKind,
  type RequestStatus,
} from "@/app/lib/queue/domain";

export type QueueSort = "created" | "deadline" | "quantity" | "status";
export type SortDirection = "asc" | "desc";

export type DashboardFilters = {
  statuses: RequestStatus[];
  material?: MaterialKind;
  createdFrom?: string;
  createdTo?: string;
  search?: string;
  sort: QueueSort;
  direction: SortDirection;
};

export type PipelineRow = {
  id: string;
  ref: string;
  requesterName: string;
  requesterEmail: string;
  createdAt: Date;
  deadline: string | null;
  quantity: number;
  material: MaterialKind;
  colors: string[];
  currentStatus: RequestStatus;
  version: number;
  assigneeName: string | null;
  fileName: string | null;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function many(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : value.split(",");
}

export function parseDashboardFilters(
  raw: Record<string, string | string[] | undefined>,
): DashboardFilters {
  const statuses = many(raw.status).filter((value): value is RequestStatus =>
    (REQUEST_STATUSES as readonly string[]).includes(value),
  );
  const materialValue = one(raw.material);
  const material = (MATERIAL_KINDS as readonly string[]).includes(materialValue ?? "")
    ? (materialValue as MaterialKind)
    : undefined;
  const createdFromValue = one(raw.from);
  const createdToValue = one(raw.to);
  const searchMatch = one(raw.search)?.trim().match(/^CBSS-([0-9]{1,4})$/i);
  const searchValue = searchMatch
    ? `CBSS-${searchMatch[1].padStart(4, "0")}`
    : undefined;
  const sortValue = one(raw.sort);
  const directionValue = one(raw.direction);

  return {
    statuses: [...new Set(statuses)],
    material,
    createdFrom: createdFromValue && DATE_ONLY.test(createdFromValue) ? createdFromValue : undefined,
    createdTo: createdToValue && DATE_ONLY.test(createdToValue) ? createdToValue : undefined,
    search: searchValue || undefined,
    sort: ["created", "deadline", "quantity", "status"].includes(sortValue ?? "")
      ? (sortValue as QueueSort)
      : "created",
    direction: directionValue === "asc" ? "asc" : "desc",
  };
}

function pipelineConditions(filters: DashboardFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.statuses.length) {
    conditions.push(inArray(printRequest.currentStatus, filters.statuses));
  }
  if (filters.material) conditions.push(eq(printRequest.material, filters.material));
  if (filters.createdFrom) {
    conditions.push(
      sql`(${printRequest.createdAt} at time zone 'America/Vancouver')::date >= ${filters.createdFrom}::date`,
    );
  }
  if (filters.createdTo) {
    conditions.push(
      sql`(${printRequest.createdAt} at time zone 'America/Vancouver')::date <= ${filters.createdTo}::date`,
    );
  }
  if (filters.search) {
    conditions.push(eq(printRequest.ref, filters.search));
  }
  return conditions;
}

async function listPipeline(filters: DashboardFilters): Promise<PipelineRow[]> {
  const database = getDatabase();
  const conditions = pipelineConditions(filters);
  const column = {
    created: printRequest.createdAt,
    deadline: printRequest.deadline,
    quantity: printRequest.quantity,
    status: printRequest.currentStatus,
  }[filters.sort];
  const order = filters.direction === "asc" ? asc(column) : desc(column);

  return database
    .select({
      id: printRequest.id,
      ref: printRequest.ref,
      requesterName: printRequest.requesterName,
      requesterEmail: printRequest.requesterEmail,
      createdAt: printRequest.createdAt,
      deadline: printRequest.deadline,
      quantity: printRequest.quantity,
      material: printRequest.material,
      colors: printRequest.colors,
      currentStatus: printRequest.currentStatus,
      version: printRequest.version,
      assigneeName: adminUser.displayName,
      fileName: requestFile.originalName,
    })
    .from(printRequest)
    .leftJoin(adminUser, eq(adminUser.id, printRequest.assigneeId))
    .leftJoin(requestFile, eq(requestFile.requestId, printRequest.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(order, desc(printRequest.createdAt), asc(printRequest.ref))
    .limit(250);
}

async function dashboardMetrics() {
  const database = getDatabase();
  const chartStart = new Date(Date.now() - 29 * 24 * 60 * 60 * 1_000);
  const requestDay = sql<string>`to_char(date_trunc('day', ${printRequest.createdAt} at time zone 'America/Vancouver'), 'YYYY-MM-DD')`;

  const [statsRows, medianRows, requestsOverTime, materialSplit, statusDistribution, failureReasons] =
    await Promise.all([
      database
        .select({
          open: sql<number>`count(*) filter (where ${printRequest.currentStatus} not in ('declined', 'picked_up'))::int`,
          inProgress: sql<number>`count(*) filter (where ${printRequest.currentStatus} in ('queued', 'printing'))::int`,
          ready: sql<number>`count(*) filter (where ${printRequest.currentStatus} = 'ready_for_pickup')::int`,
          completedThisMonth: sql<number>`(
            select count(distinct completed.request_id)::int
            from request_event completed
            where completed.to_status = 'picked_up'
              and completed.from_status = 'ready_for_pickup'
              and (completed.created_at at time zone 'America/Vancouver') >=
                date_trunc('month', now() at time zone 'America/Vancouver')
          )`,
        })
        .from(printRequest),
      database
        .select({
          medianDays: sql<number | null>`percentile_cont(0.5) within group (order by extract(epoch from (${requestEvent.createdAt} - ${printRequest.createdAt})) / 86400.0)`,
        })
        .from(requestEvent)
        .innerJoin(printRequest, eq(printRequest.id, requestEvent.requestId))
        .where(
          and(
            eq(requestEvent.toStatus, "picked_up"),
            eq(requestEvent.fromStatus, "ready_for_pickup"),
          ),
        ),
      database
        .select({ label: requestDay, value: sql<number>`count(*)::int` })
        .from(printRequest)
        .where(gte(printRequest.createdAt, chartStart))
        .groupBy(requestDay)
        .orderBy(asc(requestDay)),
      database
        .select({ label: printRequest.material, value: sql<number>`count(*)::int` })
        .from(printRequest)
        .groupBy(printRequest.material)
        .orderBy(desc(sql`count(*)`)),
      database
        .select({ label: printRequest.currentStatus, value: sql<number>`count(*)::int` })
        .from(printRequest)
        .groupBy(printRequest.currentStatus)
        .orderBy(desc(sql`count(*)`)),
      database
        .select({ label: requestEvent.reasonKey, value: sql<number>`count(*)::int` })
        .from(requestEvent)
        .where(eq(requestEvent.toStatus, "print_failed"))
        .groupBy(requestEvent.reasonKey)
        .orderBy(desc(sql`count(*)`)),
    ]);

  return {
    stats: {
      open: statsRows[0]?.open ?? 0,
      inProgress: statsRows[0]?.inProgress ?? 0,
      ready: statsRows[0]?.ready ?? 0,
      completedThisMonth: statsRows[0]?.completedThisMonth ?? 0,
      medianDays: medianRows[0]?.medianDays == null ? null : Number(medianRows[0].medianDays),
    },
    charts: {
      requestsOverTime,
      materialSplit,
      statusDistribution,
      failureReasons: failureReasons.filter(
        (item): item is { label: string; value: number } => Boolean(item.label),
      ),
    },
  };
}
export async function getAdminDashboard(filters: DashboardFilters) {
  const admin = await requireAdmin();
  const [pipeline, metrics] = await Promise.all([
    listPipeline(filters),
    dashboardMetrics(),
  ]);
  return { admin, pipeline, ...metrics };
}

export async function getAdminRequestDetail(requestId: string) {
  const admin = await requireAdmin();
  const database = getDatabase();
  const [requestRows, eventRows, admins] = await Promise.all([
    database
      .select({
        request: printRequest,
        file: requestFile,
        assigneeName: adminUser.displayName,
        assigneeLogin: adminUser.githubLogin,
      })
      .from(printRequest)
      .leftJoin(requestFile, eq(requestFile.requestId, printRequest.id))
      .leftJoin(adminUser, eq(adminUser.id, printRequest.assigneeId))
      .where(eq(printRequest.id, requestId))
      .limit(1),
    database
      .select({ event: requestEvent, delivery: emailDelivery })
      .from(requestEvent)
      .leftJoin(emailDelivery, eq(emailDelivery.eventId, requestEvent.id))
      .where(eq(requestEvent.requestId, requestId))
      .orderBy(
        asc(requestEvent.createdAt),
        asc(requestEvent.id),
        asc(emailDelivery.recipientKind),
      ),
    database
      .select()
      .from(adminUser)
      .where(eq(adminUser.active, true))
      .orderBy(asc(adminUser.displayName), asc(adminUser.githubLogin)),
  ]);

  const events = eventRows.reduce<
    Array<{
      event: typeof requestEvent.$inferSelect;
      deliveries: Array<typeof emailDelivery.$inferSelect>;
    }>
  >((grouped, row) => {
    const current = grouped.at(-1);
    if (!current || current.event.id !== row.event.id) {
      grouped.push({ event: row.event, deliveries: row.delivery ? [row.delivery] : [] });
    } else if (row.delivery) {
      current.deliveries.push(row.delivery);
    }
    return grouped;
  }, []);

  return { admin, detail: requestRows[0] ?? null, events, admins };
}
