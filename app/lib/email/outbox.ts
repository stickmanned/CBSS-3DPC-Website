import "server-only";

import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { configuredSiteOrigin } from "@/app/lib/config/queue";
import { getDatabase } from "@/app/lib/db";
import {
  emailDelivery,
  printRequest,
  requestEvent,
  requestFile,
  type EmailDelivery,
} from "@/app/lib/db/schema";
import { modelNameFromFileOrUrl, renderSubmittedEmail } from "@/app/lib/email-templates";
import {
  evaluateOrderingSafely,
  requesterOrderingDisposition,
  type EmailDeliveryState,
  type EmailRecipientKind,
} from "@/app/lib/email/outbox-policy";
import { queueEmailTokens, transitionEmail, uncollectedEmail } from "@/app/lib/email/queue-message";
import {
  clubNotificationAddress,
  deliverQueueEmail,
  type QueueEmail,
} from "@/app/lib/email/sender";

const CLAIMABLE_STATES: EmailDeliveryState[] = ["pending", "failed"];

export type OutboxDispatchResult = {
  deliveryId: number;
  eventId: number;
  recipientKind: EmailRecipientKind;
  state: EmailDeliveryState;
};

type DeliveryContext = Awaited<ReturnType<typeof deliveryContext>>;

async function syncCompatibilityMarker(eventId: number): Promise<void> {
  const database = getDatabase();
  await database
    .update(requestEvent)
    .set({
      emailed: sql<boolean>`
        exists (
          select 1 from ${emailDelivery} delivery
          where delivery.event_id = ${eventId}
        )
        and not exists (
          select 1 from ${emailDelivery} delivery
          where delivery.event_id = ${eventId}
            and delivery.state <> 'sent'
        )
      `,
    })
    .where(eq(requestEvent.id, eventId));
}

async function deliveryContext(deliveryId: number) {
  const [row] = await getDatabase()
    .select({
      delivery: emailDelivery,
      event: requestEvent,
      request: printRequest,
      file: requestFile,
    })
    .from(emailDelivery)
    .innerJoin(requestEvent, eq(requestEvent.id, emailDelivery.eventId))
    .innerJoin(printRequest, eq(printRequest.id, requestEvent.requestId))
    .leftJoin(requestFile, eq(requestFile.requestId, printRequest.id))
    .where(eq(emailDelivery.id, deliveryId))
    .limit(1);
  return row ?? null;
}

async function claimDelivery(deliveryId: number): Promise<EmailDelivery | null> {
  const now = new Date();
  const [claimed] = await getDatabase()
    .update(emailDelivery)
    .set({
      state: "sending",
      attemptCount: sql`${emailDelivery.attemptCount} + 1`,
      providerId: null,
      lastErrorCode: null,
      claimedAt: now,
      lastAttemptAt: now,
      sentAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(emailDelivery.id, deliveryId),
        inArray(emailDelivery.state, CLAIMABLE_STATES),
      ),
    )
    .returning();
  return claimed ?? null;
}

async function currentState(deliveryId: number): Promise<EmailDelivery | null> {
  const [delivery] = await getDatabase()
    .select()
    .from(emailDelivery)
    .where(eq(emailDelivery.id, deliveryId))
    .limit(1);
  return delivery ?? null;
}

async function finishSent(
  delivery: EmailDelivery,
  providerId: string,
): Promise<EmailDeliveryState> {
  try {
    const now = new Date();
    const [updated] = await getDatabase()
      .update(emailDelivery)
      .set({
        state: "sent",
        providerId,
        lastErrorCode: null,
        sentAt: now,
        updatedAt: now,
      })
      .where(and(eq(emailDelivery.id, delivery.id), eq(emailDelivery.state, "sending")))
      .returning({ state: emailDelivery.state });
    if (!updated) return (await currentState(delivery.id))?.state ?? "uncertain";
    try {
      await syncCompatibilityMarker(delivery.eventId);
    } catch {
      // The outbox row is authoritative. A later finalization can repair the
      // compatibility marker without changing the confirmed delivery state.
    }
    return "sent";
  } catch {
    // Provider acceptance followed by a lost database acknowledgement is
    // ambiguous. Preserve the provider ID when the database is still reachable.
    return finishUncertain(delivery, "finalization_ambiguous", providerId);
  }
}

async function finishFailed(
  delivery: EmailDelivery,
  errorCode: string,
): Promise<EmailDeliveryState> {
  try {
    const [updated] = await getDatabase()
      .update(emailDelivery)
      .set({
        state: "failed",
        lastErrorCode: errorCode,
        updatedAt: new Date(),
      })
      .where(and(eq(emailDelivery.id, delivery.id), eq(emailDelivery.state, "sending")))
      .returning({ state: emailDelivery.state });
    return updated?.state ?? (await currentState(delivery.id))?.state ?? "sending";
  } catch {
    // The provider definitively did not accept the message, but an ambiguous
    // database finalization remains `sending` for an administrator to resolve.
    return "sending";
  }
}

async function finishUncertain(
  delivery: EmailDelivery,
  errorCode: string,
  providerId: string | null = null,
): Promise<EmailDeliveryState> {
  try {
    const [updated] = await getDatabase()
      .update(emailDelivery)
      .set({
        state: "uncertain",
        providerId,
        lastErrorCode: errorCode,
        updatedAt: new Date(),
      })
      .where(and(eq(emailDelivery.id, delivery.id), eq(emailDelivery.state, "sending")))
      .returning({ state: emailDelivery.state });
    if (updated) return updated.state;
    return (await currentState(delivery.id))?.state ?? "uncertain";
  } catch {
    // A `sending` row is itself a durable uncertainty marker and is excluded
    // from automatic claims.
    return "sending";
  }
}

async function finishObsolete(
  delivery: EmailDelivery,
  allowedStates: EmailDeliveryState[] = ["sending"],
): Promise<EmailDeliveryState> {
  try {
    const [updated] = await getDatabase()
      .update(emailDelivery)
      .set({
        state: "obsolete",
        lastErrorCode: "superseded",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(emailDelivery.id, delivery.id),
          inArray(emailDelivery.state, allowedStates),
        ),
      )
      .returning({ state: emailDelivery.state });
    if (updated) {
      try {
        await syncCompatibilityMarker(delivery.eventId);
      } catch {
        // The per-recipient state remains authoritative.
      }
      return updated.state;
    }
    return (await currentState(delivery.id))?.state ?? "obsolete";
  } catch {
    return delivery.state;
  }
}

async function deliveryDisposition(
  row: NonNullable<DeliveryContext>,
): Promise<"send" | "blocked" | "obsolete"> {
  if (row.delivery.recipientKind === "club") {
    return row.event.toStatus === "submitted" && row.request.currentStatus === "submitted"
      ? "send"
      : "obsolete";
  }

  if (row.event.toStatus === "submitted" && row.event.reasonKey === "submitted") {
    const [laterSent] = await getDatabase()
      .select({ id: emailDelivery.id })
      .from(emailDelivery)
      .innerJoin(requestEvent, eq(requestEvent.id, emailDelivery.eventId))
      .where(
        and(
          eq(requestEvent.requestId, row.request.id),
          eq(emailDelivery.recipientKind, "requester"),
          eq(emailDelivery.state, "sent"),
          sql`${requestEvent.id} > ${row.event.id}`,
        ),
      )
      .limit(1);
    // Submitted carries the requester's first private status link. It remains
    // deliverable through no-email states such as Under review. Only a legacy
    // later delivery already confirmed sent can make it obsolete.
    return requesterOrderingDisposition({
      eventStatus: row.event.toStatus,
      reasonKey: row.event.reasonKey,
      currentStatus: row.request.currentStatus,
      laterRequesterDeliverySent: Boolean(laterSent),
      submittedRequesterState: row.delivery.state,
      isLatestRequesterEvent: true,
    });
  }

  const [submitted] = await getDatabase()
    .select({ state: emailDelivery.state })
    .from(emailDelivery)
    .innerJoin(requestEvent, eq(requestEvent.id, emailDelivery.eventId))
    .where(
      and(
        eq(requestEvent.requestId, row.request.id),
        eq(requestEvent.toStatus, "submitted"),
        eq(requestEvent.reasonKey, "submitted"),
        eq(emailDelivery.recipientKind, "requester"),
      ),
    )
    .limit(1);
  const [latest] = await getDatabase()
    .select({ eventId: requestEvent.id })
    .from(emailDelivery)
    .innerJoin(requestEvent, eq(requestEvent.id, emailDelivery.eventId))
    .where(
      and(
        eq(requestEvent.requestId, row.request.id),
        eq(emailDelivery.recipientKind, "requester"),
      ),
    )
    .orderBy(desc(requestEvent.createdAt), desc(requestEvent.id))
    .limit(1);
  return requesterOrderingDisposition({
    eventStatus: row.event.toStatus,
    reasonKey: row.event.reasonKey,
    currentStatus: row.request.currentStatus,
    laterRequesterDeliverySent: false,
    submittedRequesterState: submitted?.state ?? null,
    isLatestRequesterEvent: latest?.eventId === row.event.id,
  });
}

function messageForDelivery(
  row: NonNullable<DeliveryContext>,
  origin: string,
): { message: QueueEmail | null; errorCode?: string } {
  const idempotencyKey = `queue-event-${row.event.id}-${row.delivery.recipientKind}`;

  if (row.delivery.recipientKind === "club") {
    const clubAddress = clubNotificationAddress();
    if (!clubAddress) return { message: null, errorCode: "recipient_not_configured" };
    const modelName = modelNameFromFileOrUrl(
      row.file?.originalName ?? null,
      row.request.modelUrl,
    );
    return {
      message: {
        to: clubAddress,
        subject: `New print request — ${row.request.ref}`,
        body: `A new print request is ready for review.\n\nReference: ${row.request.ref}\nRequester: ${row.request.requesterName} <${row.request.requesterEmail}>\nModel: ${modelName}\nMaterial: ${row.request.material.toUpperCase()}\nCopies: ${row.request.quantity}\n\nReview it here: ${origin}/admin/requests/${row.request.id}`,
        idempotencyKey,
        tags: { queue_event: "club_notification" },
      },
    };
  }

  const template =
    row.event.toStatus === "submitted"
      ? renderSubmittedEmail(queueEmailTokens(row.request, row.file, origin))
      : row.event.reasonKey === "uncollected_14d"
        ? uncollectedEmail(row.request, row.file, origin)
        : transitionEmail(
            row.request,
            row.file,
            row.event.toStatus,
            row.event.reasonKey ?? undefined,
            origin,
          );
  if (!template) return { message: null, errorCode: "message_not_available" };
  return {
    message: {
      to: row.request.requesterEmail,
      subject: template.subject,
      body: template.text,
      idempotencyKey,
      tags: { queue_event: row.event.reasonKey ?? row.event.toStatus },
    },
  };
}

export async function dispatchEmailDelivery(
  deliveryId: number,
  origin = configuredSiteOrigin(),
): Promise<OutboxDispatchResult | null> {
  let delivery: EmailDelivery | null;
  try {
    delivery = await claimDelivery(deliveryId);
  } catch {
    return null;
  }

  if (!delivery) {
    const existing = await currentState(deliveryId).catch(() => null);
    return existing
      ? {
          deliveryId: existing.id,
          eventId: existing.eventId,
          recipientKind: existing.recipientKind,
          state: existing.state,
        }
      : null;
  }

  const context = await deliveryContext(delivery.id).catch(() => null);
  if (!context) {
    const state = await finishUncertain(delivery, "context_unavailable");
    return { deliveryId, eventId: delivery.eventId, recipientKind: delivery.recipientKind, state };
  }

  const disposition = await evaluateOrderingSafely(() => deliveryDisposition(context));
  if (disposition === "uncertain") {
    const state = await finishUncertain(delivery, "ordering_check_unavailable");
    return { deliveryId, eventId: delivery.eventId, recipientKind: delivery.recipientKind, state };
  }
  if (disposition === "obsolete") {
    const state = await finishObsolete(delivery);
    return { deliveryId, eventId: delivery.eventId, recipientKind: delivery.recipientKind, state };
  }
  if (disposition === "blocked") {
    const state = await finishFailed(delivery, "blocked_by_submitted");
    return { deliveryId, eventId: delivery.eventId, recipientKind: delivery.recipientKind, state };
  }

  if (!origin) {
    const state = await finishFailed(delivery, "site_origin_not_configured");
    return { deliveryId, eventId: delivery.eventId, recipientKind: delivery.recipientKind, state };
  }

  const built = messageForDelivery(context, origin);
  if (!built.message) {
    const state = await finishFailed(delivery, built.errorCode ?? "message_not_available");
    return { deliveryId, eventId: delivery.eventId, recipientKind: delivery.recipientKind, state };
  }

  const provider = await deliverQueueEmail(built.message);
  const state = provider.ok
    ? await finishSent(delivery, provider.providerId)
    : provider.certainty === "uncertain"
      ? await finishUncertain(delivery, provider.reason)
      : await finishFailed(delivery, provider.reason);
  return { deliveryId, eventId: delivery.eventId, recipientKind: delivery.recipientKind, state };
}

export async function dispatchEventRecipient(
  eventId: number,
  recipientKind: EmailRecipientKind,
  origin = configuredSiteOrigin(),
): Promise<OutboxDispatchResult | null> {
  const [delivery] = await getDatabase()
    .select({ id: emailDelivery.id })
    .from(emailDelivery)
    .where(
      and(
        eq(emailDelivery.eventId, eventId),
        eq(emailDelivery.recipientKind, recipientKind),
      ),
    )
    .limit(1);
  return delivery ? dispatchEmailDelivery(delivery.id, origin) : null;
}

export async function supersedeOlderRequesterDeliveries(
  requestId: string,
  currentEventId: number,
): Promise<number> {
  const rows = await getDatabase()
    .select({ delivery: emailDelivery })
    .from(emailDelivery)
    .innerJoin(requestEvent, eq(requestEvent.id, emailDelivery.eventId))
    .where(
      and(
        eq(requestEvent.requestId, requestId),
        sql`${requestEvent.id} < ${currentEventId}`,
        ne(requestEvent.toStatus, "submitted"),
        eq(emailDelivery.recipientKind, "requester"),
        inArray(emailDelivery.state, CLAIMABLE_STATES),
      ),
    )
    .orderBy(asc(requestEvent.id));

  let obsolete = 0;
  for (const row of rows) {
    const state = await finishObsolete(row.delivery, CLAIMABLE_STATES);
    if (state === "obsolete") obsolete += 1;
  }
  return obsolete;
}

async function obsoleteOutOfOrderDeliveries(): Promise<number> {
  const rows = await getDatabase()
    .select({ delivery: emailDelivery, event: requestEvent, request: printRequest })
    .from(emailDelivery)
    .innerJoin(requestEvent, eq(requestEvent.id, emailDelivery.eventId))
    .innerJoin(printRequest, eq(printRequest.id, requestEvent.requestId))
    .where(inArray(emailDelivery.state, CLAIMABLE_STATES))
    .orderBy(asc(requestEvent.requestId), desc(requestEvent.createdAt), desc(requestEvent.id))
    .limit(500);

  const latestRequesterEvent = new Map<string, number>();
  for (const row of rows) {
    if (
      row.delivery.recipientKind === "requester" &&
      row.event.toStatus === row.request.currentStatus &&
      !latestRequesterEvent.has(row.request.id)
    ) {
      latestRequesterEvent.set(row.request.id, row.event.id);
    }
  }

  let obsolete = 0;
  for (const row of rows) {
    const isSubmittedRequester =
      row.delivery.recipientKind === "requester" &&
      row.event.toStatus === "submitted" &&
      row.event.reasonKey === "submitted";
    const staleRequester =
      row.delivery.recipientKind === "requester" &&
      !isSubmittedRequester &&
      latestRequesterEvent.get(row.request.id) !== row.event.id;
    const staleClub =
      row.delivery.recipientKind === "club" && row.request.currentStatus !== "submitted";
    if (!staleRequester && !staleClub) continue;
    const state = await finishObsolete(row.delivery, CLAIMABLE_STATES);
    if (state === "obsolete") obsolete += 1;
  }
  return obsolete;
}

export type OutboxProcessingSummary = {
  sent: number;
  failed: number;
  uncertain: number;
  obsolete: number;
};

export async function processEmailOutbox(
  origin = configuredSiteOrigin(),
): Promise<OutboxProcessingSummary> {
  const summary: OutboxProcessingSummary = {
    sent: 0,
    failed: 0,
    uncertain: 0,
    obsolete: await obsoleteOutOfOrderDeliveries(),
  };

  const requesterPhases = ["submitted", "current"] as const;
  for (const phase of requesterPhases) {
    const candidates = await getDatabase()
      .select({ id: emailDelivery.id })
      .from(emailDelivery)
      .innerJoin(requestEvent, eq(requestEvent.id, emailDelivery.eventId))
      .where(
        and(
          eq(emailDelivery.recipientKind, "requester"),
          inArray(emailDelivery.state, CLAIMABLE_STATES),
          phase === "submitted"
            ? and(eq(requestEvent.toStatus, "submitted"), eq(requestEvent.reasonKey, "submitted"))
            : ne(requestEvent.toStatus, "submitted"),
        ),
      )
      .orderBy(
        phase === "submitted" ? asc(requestEvent.createdAt) : desc(requestEvent.createdAt),
        phase === "submitted" ? asc(requestEvent.id) : desc(requestEvent.id),
      )
      .limit(50);

    for (const candidate of candidates) {
      const result = await dispatchEmailDelivery(candidate.id, origin);
      if (!result) {
        summary.uncertain += 1;
      } else if (result.state === "sent") {
        summary.sent += 1;
      } else if (result.state === "failed") {
        summary.failed += 1;
      } else if (result.state === "obsolete") {
        summary.obsolete += 1;
      } else if (result.state === "sending" || result.state === "uncertain") {
        summary.uncertain += 1;
      }
    }
  }

  const clubCandidates = await getDatabase()
    .select({ id: emailDelivery.id })
    .from(emailDelivery)
    .innerJoin(requestEvent, eq(requestEvent.id, emailDelivery.eventId))
    .where(
      and(
        eq(emailDelivery.recipientKind, "club"),
        inArray(emailDelivery.state, CLAIMABLE_STATES),
      ),
    )
    .orderBy(asc(requestEvent.createdAt), asc(requestEvent.id))
    .limit(25);

  for (const candidate of clubCandidates) {
    const result = await dispatchEmailDelivery(candidate.id, origin);
    if (!result) {
      summary.uncertain += 1;
    } else if (result.state === "sent") {
      summary.sent += 1;
    } else if (result.state === "failed") {
      summary.failed += 1;
    } else if (result.state === "obsolete") {
      summary.obsolete += 1;
    } else if (result.state === "sending" || result.state === "uncertain") {
      summary.uncertain += 1;
    }
  }

  return summary;
}
