import type { RequestStatus } from "@/app/lib/queue/domain";
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

export function statusPillClass(status: RequestStatus): string {
  if (status === "ready_for_pickup") return "border-signal bg-signal text-ink";
  if (status === "printing" || status === "queued") {
    return "border-navy bg-navy text-white";
  }
  if (status === "declined" || status === "print_failed") {
    return "border-ink/20 bg-ink text-white";
  }
  if (status === "picked_up") return "border-mist bg-cloud text-slate";
  return "border-navy/20 bg-white text-navy";
}

