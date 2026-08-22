import { describe, expect, it } from "vitest";
import { describeWidgetError } from "@/app/lib/security/turnstile-errors";

describe("Turnstile widget error classification", () => {
  // 110200 is the code that took the live form down: the sitekey was never
  // added to Hostname Management for 3dprintingclub.org. No amount of retrying
  // clears it, so the requester must be pointed at the club instead.
  it.each(["110100", "110110", "110200", "400020", "400070"])(
    "treats sitekey fault %s as ours and not retryable",
    (code) => {
      const failure = describeWidgetError(code);
      expect(failure.retryable).toBe(false);
      expect(failure.message).toMatch(/on our end/i);
    },
  );

  // The earlier /^11[06]/ shape swept these in with the sitekey faults, which
  // would have told a visitor the site was broken when a retry was all it took.
  it.each(["110600", "110620"])("treats timeout %s as retryable", (code) => {
    expect(describeWidgetError(code).retryable).toBe(true);
  });

  it("names the clock as the cause for 200100", () => {
    const failure = describeWidgetError("200100");
    expect(failure.retryable).toBe(true);
    expect(failure.message).toMatch(/clock/i);
  });

  it("names the blocked challenge host for 200500", () => {
    const failure = describeWidgetError("200500");
    expect(failure.retryable).toBe(true);
    expect(failure.message).toContain("challenges.cloudflare.com");
  });

  it.each(["300010", "600001", "unknown", ""])(
    "falls back to a retryable message for %s",
    (code) => {
      expect(describeWidgetError(code).retryable).toBe(true);
    },
  );

  it("never blames the visitor for a sitekey fault", () => {
    expect(describeWidgetError("110200").message).not.toMatch(
      /your (network|browser|device|connection)/i,
    );
  });
});
