import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  evaluateOrderingSafely,
  isAutomaticallyClaimable,
  recipientsForQueueEvent,
  requesterOrderingDisposition,
} from "../../app/lib/email/outbox-policy";

describe("email outbox policy", () => {
  it("creates independent requester and club deliveries for Submitted", () => {
    expect(recipientsForQueueEvent("submitted", "submitted")).toEqual([
      "requester",
      "club",
    ]);
    expect(recipientsForQueueEvent("approved", null)).toEqual(["requester"]);
    expect(recipientsForQueueEvent("picked_up", "file_purged_90d")).toEqual([]);
  });

  it("retries a failed Submitted confirmation after moving to Under review", () => {
    expect(
      requesterOrderingDisposition({
        eventStatus: "submitted",
        reasonKey: "submitted",
        currentStatus: "under_review",
        laterRequesterDeliverySent: false,
        submittedRequesterState: "failed",
        isLatestRequesterEvent: false,
      }),
    ).toBe("send");
  });

  it("does not let a later status email overtake Submitted", () => {
    expect(
      requesterOrderingDisposition({
        eventStatus: "approved",
        reasonKey: null,
        currentStatus: "approved",
        laterRequesterDeliverySent: false,
        submittedRequesterState: "failed",
        isLatestRequesterEvent: true,
      }),
    ).toBe("blocked");
  });

  it("never auto-claims sending or uncertain outcomes", () => {
    expect(isAutomaticallyClaimable("pending")).toBe(true);
    expect(isAutomaticallyClaimable("failed")).toBe(true);
    expect(isAutomaticallyClaimable("sending")).toBe(false);
    expect(isAutomaticallyClaimable("uncertain")).toBe(false);
  });

  it("turns an ordering-query failure into uncertainty, not obsolescence", async () => {
    const currentnessQuery = vi.fn().mockRejectedValue(new Error("database unavailable"));
    await expect(evaluateOrderingSafely(currentnessQuery)).resolves.toBe("uncertain");
    expect(currentnessQuery).toHaveBeenCalledOnce();
  });
});

describe("email outbox migration", () => {
  const migration = readFileSync(
    resolve(process.cwd(), "drizzle/0001_email_delivery_outbox.sql"),
    "utf8",
  );
  const repository = readFileSync(
    resolve(process.cwd(), "app/lib/queue/repository.ts"),
    "utf8",
  );

  it("uses a per-event recipient key and review-safe explicit states", () => {
    expect(migration).toContain("email_delivery_event_recipient_uidx");
    expect(migration).toContain("'pending'");
    expect(migration).toContain("'sending'");
    expect(migration).toContain("'sent'");
    expect(migration).toContain("'failed'");
    expect(migration).toContain("'uncertain'");
    expect(migration).toContain("'obsolete'");
    expect(migration).toContain("legacy_delivery_ambiguous");
  });

  it("enqueues recipients inside both event-creation transactions", () => {
    expect(repository.match(/transaction\.insert\(emailDelivery\)/g)).toHaveLength(2);
    expect(repository).toContain("recipientsForQueueEvent(event.toStatus, event.reasonKey)");
  });
});
