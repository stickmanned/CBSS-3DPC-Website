import { and, eq, inArray } from "drizzle-orm";
import { requireAdmin, AuthConfigurationError } from "@/app/lib/auth";
import { getDatabase, requestEvent } from "@/app/lib/db";
import { createQueueRepository } from "@/app/lib/queue/repository";
import { csvFilterSchema } from "@/app/lib/queue/schemas";

export const runtime = "nodejs";

function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  text = text.replace(/\0/g, "").replace(/\r?\n/g, " ");
  if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function vancouverDate() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Vancouver",
  }).format(new Date());
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const filters = csvFilterSchema.parse({
      // Reporting exports are deliberately limited to picked-up requests.
      statuses: ["picked_up"],
      createdFrom: url.searchParams.get("from") || undefined,
      createdTo: url.searchParams.get("to") || undefined,
      assigneeId: url.searchParams.get("assignee") || undefined,
      search: url.searchParams.get("search") || undefined,
    });
    const requests = await createQueueRepository().listForCsv(filters);
    const requestIds = requests.map((item) => item.id);
    const completions = requestIds.length
      ? await getDatabase()
          .select({
            requestId: requestEvent.requestId,
            completedAt: requestEvent.createdAt,
          })
          .from(requestEvent)
          .where(
            and(
              inArray(requestEvent.requestId, requestIds),
              eq(requestEvent.toStatus, "picked_up"),
              eq(requestEvent.fromStatus, "ready_for_pickup"),
            ),
          )
      : [];
    const completedByRequest = new Map(
      completions.map((event) => [event.requestId, event.completedAt]),
    );

    const header = [
      "reference",
      "submitted_at",
      "picked_up_at",
      "days_to_completion",
      "material",
      "ordered_colors",
      "quantity",
      "requested_deadline",
    ];
    const rows = requests.map((item) => {
      const completedAt = completedByRequest.get(item.id) ?? item.updatedAt;
      const days = Math.max(
        0,
        (completedAt.getTime() - item.createdAt.getTime()) / (24 * 60 * 60 * 1_000),
      );
      return [
        item.ref,
        item.createdAt.toISOString(),
        completedAt.toISOString(),
        days.toFixed(2),
        item.material,
        item.colors.join(" | ") || "club's choice",
        item.quantity,
        item.deadline ?? "",
      ];
    });
    const csv = [header, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");

    return new Response(`\uFEFF${csv}\r\n`, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="cbss-completed-prints-${vancouverDate()}.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return Response.json(
        { error: "Administrative export is unavailable." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(
      { error: "Export not available." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
}
