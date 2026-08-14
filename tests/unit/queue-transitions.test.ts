import { describe, expect, it } from "vitest";
import {
  canTransition,
  REQUEST_STATUSES,
  REQUEST_TRANSITIONS,
} from "../../app/lib/queue/domain";

describe("request transition graph", () => {
  it("allows print_failed to re-enter the queue", () => {
    expect(canTransition("print_failed", "queued")).toBe(true);
  });

  it("keeps declined and picked_up terminal", () => {
    for (const status of REQUEST_STATUSES) {
      expect(canTransition("declined", status)).toBe(false);
      expect(canTransition("picked_up", status)).toBe(false);
    }
  });

  it("matches the authoritative graph exactly", () => {
    expect(REQUEST_TRANSITIONS).toEqual({
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
    });
  });
});
