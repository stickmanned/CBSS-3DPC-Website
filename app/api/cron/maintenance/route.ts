import { timingSafeEqual } from "node:crypto";
import {
  and,
  asc,
  eq,
  isNull,
  notExists,
  sql,
} from "drizzle-orm";
import { configuredSiteOrigin } from "@/app/lib/config/queue";
import {
  emailDelivery,
  getDatabase,
  printRequest,
  requestEvent,
  requestFile,
} from "@/app/lib/db";
import { processEmailOutbox } from "@/app/lib/email/outbox";
import { deleteExpiredRateLimitBuckets } from "@/app/lib/queue/rate-limit";
import {
  deleteAbandonedUploadObjects,
  deleteRetainedModelObject,
} from "@/app/lib/storage/retention";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || secret.length < 16) return false;
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const supplied = Buffer.from(header, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

async function createDuePickupReminders(now: Date): Promise<number> {
  const database = getDatabase();
  const cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1_000);
  const readyAt = sql<Date>`(
    select max(status_event.created_at)
    from request_event status_event
    where status_event.request_id = ${printRequest.id}
      and status_event.to_status = 'ready_for_pickup'
  )`;
  const candidates = await database
    .select({ id: printRequest.id })
    .from(printRequest)
    .where(
      and(
        eq(printRequest.currentStatus, "ready_for_pickup"),
        sql`${readyAt} <= ${cutoff}`,
        notExists(
          database
            .select({ one: sql<number>`1` })
            .from(requestEvent)
            .where(
              and(
                eq(requestEvent.requestId, printRequest.id),
                eq(requestEvent.reasonKey, "uncollected_14d"),
              ),
            ),
        ),
      ),
    )
    .orderBy(asc(readyAt))
    .limit(50);

  let created = 0;
  for (const candidate of candidates) {
    await database.transaction(async (transaction) => {
      const [event] = await transaction
        .insert(requestEvent)
        .values({
          requestId: candidate.id,
          fromStatus: null,
          toStatus: "ready_for_pickup",
          reasonKey: "uncollected_14d",
          requesterVisibleNote: "Your print is still waiting for pickup.",
          actor: "system",
        })
        .onConflictDoNothing()
        .returning({ id: requestEvent.id });
      if (!event) return;
      await transaction.insert(emailDelivery).values({
        eventId: event.id,
        recipientKind: "requester",
      });
      created += 1;
    });
  }
  return created;
}

async function purgeExpiredFiles(now: Date) {
  const database = getDatabase();
  const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1_000);
  const pickedUpAt = sql<Date>`(
    select max(status_event.created_at)
    from request_event status_event
    where status_event.request_id = ${printRequest.id}
      and status_event.to_status = 'picked_up'
  )`;
  const rows = await database
    .select({ file: requestFile, requestId: printRequest.id })
    .from(requestFile)
    .innerJoin(printRequest, eq(printRequest.id, requestFile.requestId))
    .where(
      and(
        isNull(requestFile.purgedAt),
        eq(printRequest.currentStatus, "picked_up"),
        sql`${pickedUpAt} <= ${cutoff}`,
      ),
    )
    .orderBy(asc(pickedUpAt))
    .limit(25);

  let purged = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await deleteRetainedModelObject(row.file.storageKey);
      await database.transaction(async (transaction) => {
        const [updated] = await transaction
          .update(requestFile)
          .set({ purgedAt: now })
          .where(and(eq(requestFile.id, row.file.id), isNull(requestFile.purgedAt)))
          .returning({ id: requestFile.id });
        if (!updated) return;
        await transaction
          .insert(requestEvent)
          .values({
            requestId: row.requestId,
            fromStatus: null,
            toStatus: "picked_up",
            reasonKey: "file_purged_90d",
            requesterVisibleNote:
              "The uploaded model file was deleted under the 90-day retention policy.",
            actor: "system",
          })
          .onConflictDoNothing();
        purged += 1;
      });
    } catch {
      failed += 1;
    }
  }
  return { purged, failed };
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const now = new Date();
    const origin = configuredSiteOrigin();
    const remindersCreated = await createDuePickupReminders(now);
    const [
      outbox,
      retention,
      abandonedUploads,
      expiredRateBuckets,
    ] =
      await Promise.all([
        processEmailOutbox(origin),
        purgeExpiredFiles(now),
        deleteAbandonedUploadObjects(now),
        deleteExpiredRateLimitBuckets(now),
      ]);
    return Response.json(
      {
        ok: true,
        remindersCreated,
        emailsSent: outbox.sent,
        emailFailures: outbox.failed,
        emailsNeedingReview: outbox.uncertain,
        obsoleteEmailsClosed: outbox.obsolete,
        filesPurged: retention.purged,
        filePurgeFailures: retention.failed,
        abandonedTempFilesPurged: abandonedUploads.tempDeleted,
        abandonedFinalFilesPurged: abandonedUploads.finalDeleted,
        abandonedFilePurgeFailures: abandonedUploads.failures,
        expiredRateBuckets,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { ok: false, error: "Maintenance did not complete." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
