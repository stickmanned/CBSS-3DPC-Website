import { createHmac, timingSafeEqual } from "node:crypto";
const MIN_SECRET_LENGTH = 32;

function assertSecret(secret: string) {
  if (Buffer.byteLength(secret, "utf8") < MIN_SECRET_LENGTH) {
    throw new Error(`Queue HMAC secrets must be at least ${MIN_SECRET_LENGTH} characters.`);
  }
}

function hmacBytes(secret: string, context: string, value: string): Buffer {
  assertSecret(secret);
  return createHmac("sha256", secret).update(context).update("\0").update(value).digest();
}

function hmacHex(secret: string, context: string, value: string): string {
  return hmacBytes(secret, context, value).toString("hex");
}

export function deriveRequesterToken(idempotencyKey: string, secret: string): string {
  return hmacBytes(secret, "requester-token-v1", idempotencyKey).toString("base64url");
}

export function hashRequesterToken(rawToken: string, secret: string): string {
  return hmacHex(secret, "requester-token-hash-v1", rawToken);
}

export function requesterTokenMatches(rawToken: string, expectedHash: string, secret: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(expectedHash)) return false;
  const actual = Buffer.from(hashRequesterToken(rawToken, secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function hashSubmitterIp(rawIp: string, secret: string): string {
  const normalized = rawIp.trim().toLowerCase();
  if (!normalized) throw new Error("A submitter IP is required.");
  return hmacHex(secret, "submitter-ip-v1", normalized);
}

export function hashRateLimitIdentifier(scope: string, rawIdentifier: string, secret: string): string {
  const normalized = rawIdentifier.trim().toLowerCase();
  if (!scope.trim() || !normalized) throw new Error("A rate-limit scope and identifier are required.");
  return hmacHex(secret, `rate-limit-v1:${scope.trim()}`, normalized);
}
