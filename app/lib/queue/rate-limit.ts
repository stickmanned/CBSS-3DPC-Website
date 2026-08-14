import { and, lt, ne, sql } from "drizzle-orm";
import { getDatabase, type QueueDatabase } from "../db/client";
import { rateLimitBucket } from "../db/schema";
import { hashRateLimitIdentifier } from "./tokens";

export const UPLOAD_COMPLETION_LEASE_SCOPE = "upload-completion-lease";

export type RateLimitOptions = {
  scope: string;
  /** A 64-character lowercase hexadecimal HMAC; never a raw IP or email. */
  key: string;
  limit: number;
  windowSeconds: number;
  now?: Date;
};

export type RawRateLimitOptions = Omit<RateLimitOptions, "key"> & {
  rawIdentifier: string;
  hmacSecret: string;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
};

export function rateLimitWindow(now: Date, windowMs: number) {
  if (!Number.isSafeInteger(windowMs) || windowMs <= 0) {
    throw new RangeError("Rate-limit windowMs must be a positive safe integer.");
  }
  const startMs = Math.floor(now.getTime() / windowMs) * windowMs;
  return {
    windowStart: new Date(startMs),
    expiresAt: new Date(startMs + windowMs),
  };
}

/**
 * Uses one INSERT .. ON CONFLICT statement. Once a bucket reaches its limit,
 * the conflict update predicate returns no row, so parallel requests cannot
 * all pass a check-then-increment race.
 */
async function consumeHashedRateLimit(
  options: RateLimitOptions,
  database: QueueDatabase = getDatabase(),
): Promise<RateLimitResult> {
  if (!Number.isSafeInteger(options.limit) || options.limit <= 0) {
    throw new RangeError("Rate-limit limit must be a positive safe integer.");
  }

  if (!/^[0-9a-f]{64}$/.test(options.key)) {
    throw new Error("Rate-limit keys must be a lowercase hexadecimal HMAC.");
  }
  const scope = options.scope.trim();
  if (!scope) throw new Error("A rate-limit scope is required.");
  if (!Number.isSafeInteger(options.windowSeconds) || options.windowSeconds <= 0) {
    throw new RangeError("Rate-limit windowSeconds must be a positive safe integer.");
  }

  const now = options.now ?? new Date();
  const { windowStart, expiresAt } = rateLimitWindow(now, options.windowSeconds * 1_000);

  const [bucket] = await database
    .insert(rateLimitBucket)
    .values({
      scope,
      keyHmac: options.key,
      windowStart,
      expiresAt,
      requestCount: 1,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [rateLimitBucket.scope, rateLimitBucket.keyHmac, rateLimitBucket.windowStart],
      set: {
        requestCount: sql`${rateLimitBucket.requestCount} + 1`,
        expiresAt,
        updatedAt: now,
      },
      where: lt(rateLimitBucket.requestCount, options.limit),
    })
    .returning({ requestCount: rateLimitBucket.requestCount });

  if (!bucket) {
    return {
      allowed: false,
      limit: options.limit,
      remaining: 0,
      resetAt: expiresAt,
      retryAfterSeconds: Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1_000)),
    };
  }

  return {
    allowed: true,
    limit: options.limit,
    remaining: Math.max(0, options.limit - bucket.requestCount),
    resetAt: expiresAt,
    retryAfterSeconds: 0,
  };
}

export async function consumeRateLimit(
  options: RateLimitOptions,
  database: QueueDatabase = getDatabase(),
): Promise<RateLimitResult> {
  return consumeHashedRateLimit(options, database);
}

export async function consumeRawRateLimit(
  options: RawRateLimitOptions,
  database: QueueDatabase = getDatabase(),
): Promise<RateLimitResult> {
  const key = hashRateLimitIdentifier(
    options.scope.trim(),
    options.rawIdentifier,
    options.hmacSecret,
  );
  return consumeHashedRateLimit(
    {
      scope: options.scope.trim(),
      key,
      limit: options.limit,
      windowSeconds: options.windowSeconds,
      now: options.now,
    },
    database,
  );
}

export async function deleteExpiredRateLimitBuckets(
  now = new Date(),
  database: QueueDatabase = getDatabase(),
): Promise<number> {
  const deleted = await database
    .delete(rateLimitBucket)
    // Completion leases retain their monotonically increasing fencing value.
    // Deleting those rows would let the value return to 1 and create an ABA
    // race with a delayed worker release.
    .where(
      and(
        lt(rateLimitBucket.expiresAt, now),
        ne(rateLimitBucket.scope, UPLOAD_COMPLETION_LEASE_SCOPE),
      ),
    )
    .returning({ scope: rateLimitBucket.scope });
  return deleted.length;
}
