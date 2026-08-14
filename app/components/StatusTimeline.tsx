import type { RequestStatus } from "@/app/lib/queue/domain";

export const STATUS_PRESENTATION: Record<
  RequestStatus,
  { label: string; description: string }
> = {
  submitted: {
    label: "Submitted",
    description: "The club received the request.",
  },
  under_review: {
    label: "Under review",
    description: "A club member is checking the model and request details.",
  },
  approved: {
    label: "Approved",
    description: "The model has passed review.",
  },
  needs_changes: {
    label: "Needs changes",
    description: "The club needs more information or an updated model before printing.",
  },
  declined: {
    label: "Declined",
    description: "The club cannot take on this request in its current form.",
  },
  queued: {
    label: "Queued",
    description: "The request is approved and waiting for a printer.",
  },
  printing: {
    label: "Printing",
    description: "The model is on the printer now.",
  },
  ready_for_pickup: {
    label: "Ready for pickup",
    description: "The finished print is ready in Room 113 (Drafting).",
  },
  print_failed: {
    label: "Print failed",
    description: "A print attempt did not finish. Check the latest update below.",
  },
  picked_up: {
    label: "Picked up",
    description: "The request is complete.",
  },
};

export type PublicStatusEvent = {
  id: number;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  reasonKey: string | null;
  requesterVisibleNote: string | null;
  createdAt: Date;
};

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Vancouver",
  }).format(value);
}

function reasonLabel(reason: string) {
  if (reason === "uncollected_14d") return "Pickup reminder";
  if (reason === "file_purged_90d") return "File retention";
  return reason
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function StatusTimeline({ events }: { events: PublicStatusEvent[] }) {
  return (
    <ol className="mt-6 border-t border-mist" aria-label="Request history">
      {[...events].reverse().map((event, index) => {
        const presentation = STATUS_PRESENTATION[event.toStatus];
        const showReason =
          event.reasonKey && !["submitted", "status_updated"].includes(event.reasonKey);
        return (
          <li
            key={event.id}
            className="relative grid grid-cols-[2rem_1fr] gap-4 border-b border-mist py-5"
          >
            <span
              className={`mt-0.5 grid size-8 place-items-center rounded-full border font-mono text-xs font-bold ${
                index === 0
                  ? "border-signal bg-signal text-ink"
                  : "border-mist bg-cloud text-slate"
              }`}
              aria-hidden="true"
            >
              {index === 0 ? "●" : "✓"}
            </span>
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-xl text-ink">{presentation.label}</h3>
                <time className="font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-slate">
                  {formatDateTime(event.createdAt)}
                </time>
              </div>
              <p className="mt-2 text-sm text-slate">{presentation.description}</p>
              {showReason && (
                <p className="mt-3 font-display text-sm font-bold text-navy">
                  Reason: {reasonLabel(event.reasonKey!)}
                </p>
              )}
              {event.requesterVisibleNote && (
                <p className="mt-3 rounded-xl bg-cloud px-4 py-3 text-sm text-ink">
                  {event.requesterVisibleNote}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
