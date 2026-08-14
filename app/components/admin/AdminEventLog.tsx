import type { EmailDelivery, RequestEvent } from "@/app/lib/db/schema";
import { emailDeliveryStateLabel, isHumanReviewState } from "@/app/lib/email/outbox-policy";
import { statusLabel, words, formatAdminDate } from "./presentation";

type EventWithDeliveries = {
  event: RequestEvent;
  deliveries: EmailDelivery[];
};

function recipientLabel(recipient: EmailDelivery["recipientKind"]): string {
  return recipient === "requester" ? "Requester email" : "Club notification";
}

export default function AdminEventLog({ events }: { events: EventWithDeliveries[] }) {
  return (
    <section className="rounded-[20px] border border-mist bg-white p-5 sm:p-6">
      <p className="eyebrow text-slate">Audit trail</p>
      <h2 className="mt-3 text-2xl text-ink">Request events</h2>
      <ol className="mt-5 divide-y divide-mist border-y border-mist">
        {[...events].reverse().map(({ event, deliveries }) => {
          return (
            <li key={event.id} className="grid gap-3 py-5 sm:grid-cols-[1fr_auto]">
              <div>
                <p className="font-display text-base font-bold text-ink">
                  {event.fromStatus ? `${statusLabel(event.fromStatus)} → ` : ""}
                  {statusLabel(event.toStatus)}
                </p>
                {event.reasonKey && !["submitted", "status_updated"].includes(event.reasonKey) && (
                  <p className="mt-1 text-sm text-navy">Reason: {words(event.reasonKey)}</p>
                )}
                {event.requesterVisibleNote && (
                  <p className="mt-3 rounded-xl bg-cloud px-4 py-3 text-sm text-ink">
                    {event.requesterVisibleNote}
                  </p>
                )}
                <p className="mt-2 text-xs text-slate">
                  Actor: {event.actor}
                </p>
                {deliveries.length ? (
                  <ul className="mt-3 space-y-2" aria-label="Email delivery states">
                    {deliveries.map((delivery) => (
                      <li
                        key={delivery.id}
                        className={`rounded-xl border px-3 py-2 text-xs ${
                          isHumanReviewState(delivery.state)
                            ? "border-signal bg-[#fff9e8] text-ink"
                            : "border-mist bg-cloud text-slate"
                        }`}
                      >
                        <span className="font-semibold text-ink">
                          {recipientLabel(delivery.recipientKind)}: {emailDeliveryStateLabel(delivery.state)}
                        </span>
                        <span className="mt-1 block">
                          Attempts: {delivery.attemptCount}
                          {delivery.lastAttemptAt
                            ? ` · Last attempt ${formatAdminDate(delivery.lastAttemptAt, true)}`
                            : ""}
                          {delivery.providerId ? ` · Provider ID ${delivery.providerId}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-slate">No email by design</p>
                )}
              </div>
              <time className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.04em] text-slate">
                {formatAdminDate(event.createdAt, true)}
              </time>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
