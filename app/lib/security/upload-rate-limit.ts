import { and, eq, lte, sql } from "drizzle-orm";
import { getDatabase, rateLimitBucket, type QueueDatabase } from "@/app/lib/db";
import {
  consumeRawRateLimit,
  UPLOAD_COMPLETION_LEASE_SCOPE,
} from "@/app/lib/queue/rate-limit";
import { hashRateLimitIdentifier } from "@/app/lib/queue/tokens";

// These pre-verification ceilings are intentionally NAT-safe for a classroom.
// Turnstile and the much tighter email-bound limit provide the finer control.
const PRESIGN_IP_LIMIT = 240;
const PRESIGN_EMAIL_LIMIT = 5;
const COMPLETION_IP_LIMIT = 240;
const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;
// R2 copies are server-side, but use a generous crash lease for the maximum
// accepted model size. A monotonically increasing fencing version prevents an
// expired worker from releasing a successor's lease.
const COMPLETION_LEASE_SECONDS = 5 * 60;
const COMPLETION_LEASE_WINDOW = new Date(0);

export class RateLimitConfigurationError extends Error {
  constructor() {
    super("Abuse protection is not configured.");
    this.name = "RateLimitConfigurationError";
  }
}

export type UploadRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

function hmacSecret(): string {
  const secret =
    process.env.RATE_LIMIT_HMAC_SECRET ?? process.env.QUEUE_IDENTIFIER_HMAC_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new RateLimitConfigurationError();
  }
  return secret;
}

function summarize(results: Array<{ allowed: boolean; resetAt: Date }>): UploadRateLimitResult {
  const denied = results.filter((result) => !result.allowed);
  if (!denied.length) return { allowed: true, retryAfterSeconds: 0 };
  const latestReset = Math.max(...denied.map((result) => result.resetAt.getTime()));
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((latestReset - Date.now()) / 1_000)),
  };
}

export async function consumeUploadPresignIpLimit(
  ip: string,
): Promise<UploadRateLimitResult> {
  const secret = hmacSecret();
  const result = await consumeRawRateLimit({
    scope: "upload-presign-ip",
    rawIdentifier: ip,
    hmacSecret: secret,
    limit: PRESIGN_IP_LIMIT,
    windowSeconds: HOUR_MS / 1_000,
  });
  return summarize([result]);
}

export async function consumeUploadPresignEmailLimit(
  normalizedEmail: string,
): Promise<UploadRateLimitResult> {
  const result = await consumeRawRateLimit({
    scope: "upload-presign-email",
    rawIdentifier: normalizedEmail,
    hmacSecret: hmacSecret(),
    limit: PRESIGN_EMAIL_LIMIT,
    windowSeconds: DAY_MS / 1_000,
  });
  return summarize([result]);
}

export async function consumeUploadCompletionIpLimit(
  ip: string,
): Promise<UploadRateLimitResult> {
  const result = await consumeRawRateLimit({
    scope: "upload-complete-ip",
    rawIdentifier: ip,
    hmacSecret: hmacSecret(),
    limit: COMPLETION_IP_LIMIT,
    windowSeconds: HOUR_MS / 1_000,
  });
  return summarize([result]);
}

/**
 * A short, renewable lease prevents two copies from racing while allowing an
 * immediate retry after a transient R2 failure. The nonce is HMAC'd at rest.
 */
export async function acquireUploadCompletionLease(
  nonce: string,
  database: QueueDatabase = getDatabase(),
): Promise<UploadRateLimitResult & { leaseVersion?: number }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + COMPLETION_LEASE_SECONDS * 1_000);
  const keyHmac = hashRateLimitIdentifier(
    UPLOAD_COMPLETION_LEASE_SCOPE,
    nonce,
    hmacSecret(),
  );
  const [lease] = await database
    .insert(rateLimitBucket)
    .values({
      scope: UPLOAD_COMPLETION_LEASE_SCOPE,
      keyHmac,
      windowStart: COMPLETION_LEASE_WINDOW,
      requestCount: 1,
      expiresAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        rateLimitBucket.scope,
        rateLimitBucket.keyHmac,
        rateLimitBucket.windowStart,
      ],
      set: {
        requestCount: sql`${rateLimitBucket.requestCount} + 1`,
        expiresAt,
        updatedAt: now,
      },
      where: lte(rateLimitBucket.expiresAt, now),
    })
    .returning({
      expiresAt: rateLimitBucket.expiresAt,
      leaseVersion: rateLimitBucket.requestCount,
    });

  if (lease) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
      leaseVersion: lease.leaseVersion,
    };
  }
  const [current] = await database
    .select({ expiresAt: rateLimitBucket.expiresAt })
    .from(rateLimitBucket)
    .where(
      and(
        eq(rateLimitBucket.scope, UPLOAD_COMPLETION_LEASE_SCOPE),
        eq(rateLimitBucket.keyHmac, keyHmac),
        eq(rateLimitBucket.windowStart, COMPLETION_LEASE_WINDOW),
      ),
    )
    .limit(1);
  return {
    allowed: false,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil(((current?.expiresAt ?? expiresAt).getTime() - now.getTime()) / 1_000),
    ),
  };
}

export async function releaseUploadCompletionLease(
  nonce: string,
  leaseVersion: number,
  database: QueueDatabase = getDatabase(),
): Promise<void> {
  const keyHmac = hashRateLimitIdentifier(
    UPLOAD_COMPLETION_LEASE_SCOPE,
    nonce,
    hmacSecret(),
  );
  await database
    .update(rateLimitBucket)
    .set({ expiresAt: COMPLETION_LEASE_WINDOW, updatedAt: new Date() })
    .where(
      and(
        eq(rateLimitBucket.scope, UPLOAD_COMPLETION_LEASE_SCOPE),
        eq(rateLimitBucket.keyHmac, keyHmac),
        eq(rateLimitBucket.windowStart, COMPLETION_LEASE_WINDOW),
        eq(rateLimitBucket.requestCount, leaseVersion),
      ),
    );
}
