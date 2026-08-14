export const MATERIAL_KINDS = ["pla", "petg", "asa"] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];

export const FILE_KINDS = ["stl", "3mf"] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export const REQUEST_STATUSES = [
  "submitted",
  "under_review",
  "approved",
  "needs_changes",
  "declined",
  "queued",
  "printing",
  "ready_for_pickup",
  "print_failed",
  "picked_up",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const PRINT_FAILED_REASON_KEYS = [
  "came_off_plate",
  "ran_out_of_filament",
  "layer_shift",
  "supports_collapsed",
  "warped",
  "nozzle_clogged",
] as const;
export type PrintFailedReasonKey = (typeof PRINT_FAILED_REASON_KEYS)[number];

export const NEEDS_CHANGES_REASON_KEYS = [
  "too_large",
  "thin_walls",
  "broken_mesh",
  "heavy_overhangs",
  "cant_access_link",
  "scale_looks_off",
] as const;
export type NeedsChangesReasonKey = (typeof NEEDS_CHANGES_REASON_KEYS)[number];

export const DECLINED_REASON_KEYS = [
  "against_school_policy",
  "too_big_a_job",
  "licensing",
  "not_printable",
] as const;
export type DeclinedReasonKey = (typeof DECLINED_REASON_KEYS)[number];

export type QueueReasonKey =
  | PrintFailedReasonKey
  | NeedsChangesReasonKey
  | DeclinedReasonKey
  | "submitted"
  | "status_updated";

export const REQUEST_TRANSITIONS: Readonly<Record<RequestStatus, readonly RequestStatus[]>> = {
  submitted: ["under_review", "declined"],
  under_review: ["approved", "needs_changes", "declined"],
  approved: ["queued", "needs_changes", "declined"],
  needs_changes: ["under_review", "declined"],
  queued: ["printing", "declined"],
  printing: ["ready_for_pickup", "print_failed"],
  print_failed: ["queued", "declined"],
  ready_for_pickup: ["picked_up"],
  declined: [],
  picked_up: [],
};

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return REQUEST_TRANSITIONS[from].includes(to);
}

export function requiredReasonGroup(
  to: RequestStatus,
): "print_failed" | "needs_changes" | "declined" | null {
  if (to === "print_failed" || to === "needs_changes" || to === "declined") return to;
  return null;
}

export function isPrintFailedReason(value: string): value is PrintFailedReasonKey {
  return (PRINT_FAILED_REASON_KEYS as readonly string[]).includes(value);
}

export function isNeedsChangesReason(value: string): value is NeedsChangesReasonKey {
  return (NEEDS_CHANGES_REASON_KEYS as readonly string[]).includes(value);
}

export function isDeclinedReason(value: string): value is DeclinedReasonKey {
  return (DECLINED_REASON_KEYS as readonly string[]).includes(value);
}
