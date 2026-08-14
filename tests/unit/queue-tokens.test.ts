import { describe, expect, it } from "vitest";
import {
  deriveRequesterToken,
  hashRateLimitIdentifier,
  hashRequesterToken,
  hashSubmitterIp,
  requesterTokenMatches,
} from "../../app/lib/queue/tokens";
import { rateLimitWindow } from "../../app/lib/queue/rate-limit";

const secret = "s".repeat(32);

describe("privacy-preserving queue tokens", () => {
  it("derives the same opaque requester token for an idempotent replay", () => {
    const first = deriveRequesterToken("request-12345678", secret);
    const replay = deriveRequesterToken("request-12345678", secret);
    expect(replay).toBe(first);
    expect(first).not.toContain("request-12345678");
  });

  it("persists only a verifiable HMAC of the requester token", () => {
    const token = deriveRequesterToken("request-12345678", secret);
    const hash = hashRequesterToken(token, secret);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(requesterTokenMatches(token, hash, secret)).toBe(true);
    expect(requesterTokenMatches(`${token}x`, hash, secret)).toBe(false);
  });

  it("never puts a raw IP or email into persisted helper values", () => {
    const ip = "203.0.113.42";
    const email = "Student@SD43.BC.CA";
    const ipHash = hashSubmitterIp(ip, secret);
    const emailHash = hashRateLimitIdentifier("submit-email", email, secret);
    expect(ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(emailHash).toMatch(/^[0-9a-f]{64}$/);
    expect(ipHash).not.toContain(ip);
    expect(emailHash).not.toContain(email.toLowerCase());
    expect(emailHash).toBe(hashRateLimitIdentifier("submit-email", email.toLowerCase(), secret));
  });

  it("aligns fixed rate-limit windows deterministically", () => {
    const now = new Date("2026-08-13T12:34:56.789Z");
    const window = rateLimitWindow(now, 60_000);
    expect(window.windowStart.toISOString()).toBe("2026-08-13T12:34:00.000Z");
    expect(window.expiresAt.toISOString()).toBe("2026-08-13T12:35:00.000Z");
  });
});
