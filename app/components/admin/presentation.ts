import type { RequestStatus } from "@/app/lib/queue/domain";
import type { DeadlineRisk } from "@/app/lib/admin/dashboard";
import { STATUS_PRESENTATION } from "@/app/components/StatusTimeline";

export function statusLabel(status: RequestStatus): string {
  return STATUS_PRESENTATION[status].label;
}

export function words(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatAdminDate(value: string | Date, includeTime = false): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
    timeZone: "America/Vancouver",
  }).format(new Date(value));
}

/**
 * Status is identity, not alarm, so most pills stay recessive. Signal is spent on
 * `ready_for_pickup` alone — the one state that needs a person to physically do
 * something — and problem states are outlined rather than filled so a bad week
 * doesn't turn the table into a wall of colour.
 */
export function statusPillClass(status: RequestStatus): string {
  if (status === "ready_for_pickup") return "border-signal bg-signal text-ink";
  if (status === "printing" || status === "queued") return "border-navy bg-navy text-snow";
  if (status === "needs_changes" || status === "print_failed") {
    return "border-terracotta/45 bg-paper text-terracotta";
  }
  if (status === "declined") return "border-mist bg-cloud text-slate";
  if (status === "picked_up") return "border-mist bg-cloud text-slate";
  return "border-navy/25 bg-snow text-navy";
}

export type DeadlinePresentation = {
  label: string;
  className: string;
};

/**
 * Colour never carries the meaning on its own here — the label always says what
 * the state is. Mandarin and mint are deliberately unused: both fall under 3:1
 * against the paper ground, so neither is legible as text.
 */
export function deadlinePresentation(
  risk: DeadlineRisk,
  deadline: string | null,
): DeadlinePresentation {
  if (!deadline || risk === "none") {
    return { label: "No deadline", className: "text-slate" };
  }
  const date = formatAdminDate(`${deadline}T12:00:00-07:00`);
  if (risk === "overdue") {
    return { label: `Overdue · ${date}`, className: "font-bold text-terracotta" };
  }
  if (risk === "soon") {
    return { label: `Due soon · ${date}`, className: "font-bold text-ink" };
  }
  return { label: `Due ${date}`, className: "text-slate" };
}

export function ageClass(untouchedDays: number, staleAfterDays: number): string {
  return untouchedDays >= staleAfterDays ? "font-bold text-ink" : "text-slate";
}
