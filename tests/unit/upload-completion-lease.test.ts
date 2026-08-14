import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { QueueDatabase } from "@/app/lib/db";
import {
  acquireUploadCompletionLease,
  releaseUploadCompletionLease,
} from "@/app/lib/security/upload-rate-limit";

type LeaseRow = {
  requestCount: number;
  expiresAt: Date;
};

function fakeLeaseDatabase() {
  let row: LeaseRow | null = null;
  const dialect = new PgDialect();

  const database = {
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoUpdate: () => ({
          returning: async () => {
            const now = values.updatedAt as Date;
            if (!row) {
              row = {
                requestCount: values.requestCount as number,
                expiresAt: values.expiresAt as Date,
              };
            } else if (row.expiresAt <= now) {
              row = {
                requestCount: row.requestCount + 1,
                expiresAt: values.expiresAt as Date,
              };
            } else {
              return [];
            }
            return [{
              expiresAt: row.expiresAt,
              leaseVersion: row.requestCount,
            }];
          },
        }),
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (row ? [{ expiresAt: row.expiresAt }] : []),
        }),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async (condition: Parameters<PgDialect["sqlToQuery"]>[0]) => {
          const query = dialect.sqlToQuery(condition);
          const leaseVersion = query.params.find(
            (parameter): parameter is number => typeof parameter === "number",
          );
          if (row && row.requestCount === leaseVersion) {
            row = { ...row, expiresAt: values.expiresAt as Date };
          }
        },
      }),
    }),
  } as unknown as QueueDatabase;

  return { database, current: () => row };
}

describe("upload completion lease fencing", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not let an expired worker release a successor lease, including after ABA", async () => {
    process.env.RATE_LIMIT_HMAC_SECRET =
      "test-only-rate-limit-secret-at-least-32-bytes";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-14T00:00:00.000Z"));
    const state = fakeLeaseDatabase();

    const workerA = await acquireUploadCompletionLease("nonce", state.database);
    expect(workerA).toMatchObject({ allowed: true, leaseVersion: 1 });

    vi.advanceTimersByTime(6 * 60 * 1_000);
    const workerB = await acquireUploadCompletionLease("nonce", state.database);
    expect(workerB).toMatchObject({ allowed: true, leaseVersion: 2 });

    await releaseUploadCompletionLease("nonce", workerA.leaseVersion!, state.database);
    expect(state.current()?.expiresAt.getTime()).toBeGreaterThan(Date.now());

    await releaseUploadCompletionLease("nonce", workerB.leaseVersion!, state.database);
    const workerC = await acquireUploadCompletionLease("nonce", state.database);
    expect(workerC).toMatchObject({ allowed: true, leaseVersion: 3 });

    await releaseUploadCompletionLease("nonce", workerA.leaseVersion!, state.database);
    expect(state.current()).toMatchObject({ requestCount: 3 });
    expect(state.current()?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
