import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  sql,
  type AnyColumn,
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

export type QueueSort = "urgency" | "created" | "deadline" | "quantity" | "status";
export type SortDirection = "asc" | "desc";
export type DeadlineRisk = "overdue" | "soon" | "clear" | "none";

/** Everything an administrator can still act on. Closed states are excluded. */
export const ACTIONABLE_STATUSES: readonly RequestStatus[] = [
  "submitted",
  "under_review",
  "approved",
  "needs_changes",
  "queued",
  "printing",
  "print_failed",
  "ready_for_pickup",
];

/**
 * How long an open request may sit untouched before the dashboard calls it out.
 * Chosen so a request submitted on a Friday surfaces by the club's Tuesday
 * meeting; there is no external policy behind it, so it is safe to change.
 */
export const STALE_AFTER_DAYS = 3;

/** A deadline this close counts as at-risk rather than comfortable. */
export const DEADLINE_SOON_DAYS = 3;

export const PIPELINE_LIMIT = 250;

export const PRESET_VIEWS = ["focus", "triage", "printing", "ready", "overdue", "all"] as const;
export type PresetView = (typeof PRESET_VIEWS)[number] | "custom";

const VIEW_STATUSES: Record<(typeof PRESET_VIEWS)[number], readonly RequestStatus[]> = {
  focus: ACTIONABLE_STATUSES,
  triage: ["submitted", "under_review", "needs_changes"],
  printing: ["approved", "queued", "printing", "print_failed"],
  ready: ["ready_for_pickup"],
  overdue: ACTIONABLE_STATUSES,
  all: [],
};

export type DashboardFilters = {
  statuses: RequestStatus[];
  material?: MaterialKind;
  createdFrom?: string;
  createdTo?: string;
  search?: string;
  overdueOnly: boolean;
  stalledOnly: boolean;
  sort: QueueSort;
  direction: SortDirection;
  view: PresetView;
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
  ageDays: number;
  untouchedDays: number;
  deadlineRisk: DeadlineRisk;
};

export type DeliveryReviewRow = {
  deliveryId: number;
  requestId: string;
  ref: string;
  recipientKind: "requester" | "club";
  state: "sending" | "uncertain";
  updatedAt: Date;
};

export type AttentionSummary = {
  awaitingTriage: number;
  stalled: number;
  overdue: number;
  deliveriesNeedingReview: number;
  deliveryReviewRows: DeliveryReviewRow[];
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Today in the club's timezone, as a bare date — the anchor for every deadline comparison. */
const LOCAL_TODAY = sql`(now() at time zone 'America/Vancouver')::date`;

const WHOLE_DAYS_SINCE = (column: AnyColumn) =>
  sql<number>`greatest(0, floor(extract(epoch from (now() - ${column})) / 86400)::int)`;

/** Null deadlines and closed requests carry no risk; everything else is dated. */
const DEADLINE_RISK = sql<DeadlineRisk>`
  case
    when ${printRequest.deadline} is null then 'none'
    when ${printRequest.currentStatus} in ('picked_up', 'declined') then 'none'
    when ${printRequest.deadline} < ${LOCAL_TODAY} then 'overdue'
    when ${printRequest.deadline} <= ${LOCAL_TODAY} + ${DEADLINE_SOON_DAYS}::int then 'soon'
    else 'clear'
  end
`;

const IS_OVERDUE = sql`
  ${printRequest.deadline} is not null
    and ${printRequest.currentStatus} not in ('picked_up', 'declined')
    and ${printRequest.deadline} < ${LOCAL_TODAY}
`;

/** Open, but nobody has moved it or written a note in STALE_AFTER_DAYS. */
const IS_STALLED = sql`
  ${printRequest.currentStatus} not in ('picked_up', 'declined')
    and ${printRequest.updatedAt} <= now() - make_interval(days => ${STALE_AFTER_DAYS}::int)
`;

/** Overdue first, then soonest deadline, then oldest — the order work should be picked up in. */
const URGENCY_ORDER = sql`
  case
    when ${printRequest.currentStatus} in ('picked_up', 'declined') then 3
    when ${printRequest.deadline} is null then 2
    when ${printRequest.deadline} < ${LOCAL_TODAY} then 0
    else 1
  end
`;

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
  const explicitStatuses = [
    ...new Set(
      many(raw.status).filter((value): value is RequestStatus =>
        (REQUEST_STATUSES as readonly string[]).includes(value),
      ),
    ),
  ];
  const viewValue = one(raw.view);
  const preset = (PRESET_VIEWS as readonly string[]).includes(viewValue ?? "")
    ? (viewValue as (typeof PRESET_VIEWS)[number])
    : undefined;

  // An explicit status selection always wins; otherwise a preset decides, and
  // the default is the actionable set rather than every request ever filed.
  const view: PresetView = explicitStatuses.length ? "custom" : (preset ?? "focus");
  const statuses = explicitStatuses.length
    ? explicitStatuses
    : [...VIEW_STATUSES[preset ?? "focus"]];

  const materialValue = one(raw.material);
  const material = (MATERIAL_KINDS as readonly string[]).includes(materialValue ?? "")
    ? (materialValue as MaterialKind)
    : undefined;
  const createdFromValue = one(raw.from);
  const createdToValue = one(raw.to);
  const searchMatch = one(raw.search)?.trim().match(/^CBSS-([0-9]{1,4})$/i);
  const searchValue = searchMatch ? `CBSS-${searchMatch[1].padStart(4, "0")}` : undefined;
  const sortValue = one(raw.sort);
  const directionValue = one(raw.direction);

  return {
    statuses,
    material,
    createdFrom: createdFromValue && DATE_ONLY.test(createdFromValue) ? createdFromValue : undefined,
    createdTo: createdToValue && DATE_ONLY.test(createdToValue) ? createdToValue : undefined,
    search: searchValue || undefined,
    overdueOnly: view === "overdue" || one(raw.overdue) === "1",
    stalledOnly: one(raw.stale) === "1",
    sort: ["urgency", "created", "deadline", "quantity", "status"].includes(sortValue ?? "")
      ? (sortValue as QueueSort)
      : "urgency",
    direction: directionValue === "asc" ? "asc" : "desc",
    view,
  };
}

function pipelineConditions(filters: DashboardFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.statuses.length) {
    conditions.push(inArray(printRequest.currentStatus, filters.statuses));
  }
  if (filters.material) conditions.push(eq(printRequest.material, filters.material));
  if (filters.overdueOnly) conditions.push(IS_OVERDUE);
  if (filters.stalledOnly) conditions.push(IS_STALLED);
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

  const ordering =
    filters.sort === "urgency"
      ? [
          // Urgency is a fixed triage order, so the direction toggle does not apply.
          asc(URGENCY_ORDER),
          asc(printRequest.deadline),
          asc(printRequest.createdAt),
        ]
      : [
          filters.direction === "asc"
            ? asc(
                {
                  created: printRequest.createdAt,
                  deadline: printRequest.deadline,
                  quantity: printRequest.quantity,
                  status: printRequest.currentStatus,
                }[filters.sort],
              )
            : desc(
                {
                  created: printRequest.createdAt,
                  deadline: printRequest.deadline,
                  quantity: printRequest.quantity,
                  status: printRequest.currentStatus,
                }[filters.sort],
              ),
          desc(printRequest.createdAt),
        ];

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
      ageDays: WHOLE_DAYS_SINCE(printRequest.createdAt),
      untouchedDays: WHOLE_DAYS_SINCE(printRequest.updatedAt),
      deadlineRisk: DEADLINE_RISK,
    })
    .from(printRequest)
    .leftJoin(adminUser, eq(adminUser.id, printRequest.assigneeId))
    .leftJoin(requestFile, eq(requestFile.requestId, printRequest.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(...ordering, asc(printRequest.ref))
    .limit(PIPELINE_LIMIT);
}

async function attentionSummary(): Promise<AttentionSummary> {
  const database = getDatabase();
  const reviewStates = ["sending", "uncertain"] as const;

  const [counts, deliveryCount, deliveryRows] = await Promise.all([
    database
      .select({
        awaitingTriage: sql<number>`count(*) filter (where ${printRequest.currentStatus} = 'submitted')::int`,
        stalled: sql<number>`count(*) filter (where ${IS_STALLED})::int`,
        overdue: sql<number>`count(*) filter (where ${IS_OVERDUE})::int`,
      })
      .from(printRequest),
    database
      .select({ total: sql<number>`count(*)::int` })
      .from(emailDelivery)
      .where(inArray(emailDelivery.state, [...reviewStates])),
    database
      .select({
        deliveryId: emailDelivery.id,
        requestId: printRequest.id,
        ref: printRequest.ref,
        recipientKind: emailDelivery.recipientKind,
        state: emailDelivery.state,
        updatedAt: emailDelivery.updatedAt,
      })
      .from(emailDelivery)
      .innerJoin(requestEvent, eq(requestEvent.id, emailDelivery.eventId))
      .innerJoin(printRequest, eq(printRequest.id, requestEvent.requestId))
      .where(inArray(emailDelivery.state, [...reviewStates]))
      .orderBy(asc(emailDelivery.updatedAt))
      .limit(6),
  ]);

  return {
    awaitingTriage: counts[0]?.awaitingTriage ?? 0,
    stalled: counts[0]?.stalled ?? 0,
    overdue: counts[0]?.overdue ?? 0,
    deliveriesNeedingReview: deliveryCount[0]?.total ?? 0,
    deliveryReviewRows: deliveryRows as DeliveryReviewRow[],
  };
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
  const [pipeline, attention, metrics] = await Promise.all([
    listPipeline(filters),
    attentionSummary(),
    dashboardMetrics(),
  ]);
  return { admin, pipeline, attention, ...metrics };
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
