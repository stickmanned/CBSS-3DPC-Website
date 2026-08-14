import type { RequestStatus } from "@/app/lib/queue/domain";

export const EMAIL_RECIPIENT_KINDS = ["requester", "club"] as const;
export type EmailRecipientKind = (typeof EMAIL_RECIPIENT_KINDS)[number];

export const EMAIL_DELIVERY_STATES = [
  "pending",
  "sending",
  "sent",
  "failed",
  "uncertain",
  "obsolete",
] as const;
export type EmailDeliveryState = (typeof EMAIL_DELIVERY_STATES)[number];
export type DeliveryOrderingDisposition = "send" | "blocked" | "obsolete";

const REQUESTER_EMAIL_STATUSES = new Set<RequestStatus>([
  "approved",
  "needs_changes",
  "declined",
  "printing",
  "ready_for_pickup",
  "print_failed",
]);

/**
 * Returns the durable deliveries that belong to an event. This policy is used
 * while the event transaction is still open, so an event and its intended
 * recipients can never be committed separately.
 */
export function recipientsForQueueEvent(
  toStatus: RequestStatus,
  reasonKey: string | null | undefined,
): readonly EmailRecipientKind[] {
  if (toStatus === "submitted" && reasonKey === "submitted") {
    return EMAIL_RECIPIENT_KINDS;
  }
  if (toStatus === "ready_for_pickup" && reasonKey === "uncollected_14d") {
    return ["requester"];
  }
  if (REQUESTER_EMAIL_STATUSES.has(toStatus)) return ["requester"];
  return [];
}

export function isAutomaticallyClaimable(state: EmailDeliveryState): boolean {
  return state === "pending" || state === "failed";
}

export function isHumanReviewState(state: EmailDeliveryState): boolean {
  return state === "sending" || state === "uncertain";
}

export function requesterOrderingDisposition(input: {
  eventStatus: RequestStatus;
  reasonKey: string | null;
  currentStatus: RequestStatus;
  laterRequesterDeliverySent: boolean;
  submittedRequesterState: EmailDeliveryState | null;
  isLatestRequesterEvent: boolean;
}): DeliveryOrderingDisposition {
  const isSubmitted = input.eventStatus === "submitted" && input.reasonKey === "submitted";
  if (isSubmitted) return input.laterRequesterDeliverySent ? "obsolete" : "send";
  if (input.submittedRequesterState && input.submittedRequesterState !== "sent") {
    return "blocked";
  }
  if (input.eventStatus !== input.currentStatus || !input.isLatestRequesterEvent) {
    return "obsolete";
  }
  return "send";
}

export async function evaluateOrderingSafely(
  check: () => Promise<DeliveryOrderingDisposition>,
): Promise<DeliveryOrderingDisposition | "uncertain"> {
  try {
    return await check();
  } catch {
    return "uncertain";
  }
}

export function emailDeliveryStateLabel(state: EmailDeliveryState): string {
  switch (state) {
    case "pending":
      return "Waiting to send";
    case "sending":
      return "Send outcome unknown";
    case "sent":
      return "Sent";
    case "failed":
      return "Failed; will retry";
    case "uncertain":
      return "Needs delivery review";
    case "obsolete":
      return "Not sent; superseded";
  }
}
