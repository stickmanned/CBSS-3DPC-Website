import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "drizzle/0000_print_queue.sql"), "utf8");
const repository = readFileSync(
  resolve(process.cwd(), "app/lib/queue/repository.ts"),
  "utf8",
);
const rateLimit = readFileSync(
  resolve(process.cwd(), "app/lib/queue/rate-limit.ts"),
  "utf8",
);

describe("queue migration invariants", () => {
  it("defines checks, FK indexes, and core query indexes", () => {
    expect(migration).toContain("constraint print_request_quantity_range check");
    expect(migration).toContain("constraint print_request_colors_count check");
    expect(migration).toContain("references admin_user (id)");
    expect(migration).toContain("references print_request (id)");
    expect(migration).toContain("print_request_assignee_id_idx");
    expect(migration).toContain("request_file_request_id_uidx");
    expect(migration).toContain("request_event_request_id_created_at_idx");
    expect(migration).toContain("print_request_status_created_at_idx");
  });

  it("uses lowercase snake_case and contains no deployed secret", () => {
    expect(migration).not.toMatch(/create\s+(?:table|index|type)\s+"?[A-Z]/);
    expect(migration).not.toMatch(/DATABASE_URL|UPLOAD_TOKEN_SECRET|R2_SECRET_ACCESS_KEY/);
  });

  it("has database and repository guards for legal atomic transitions", () => {
    expect(migration).toContain("legal_request_status_transition");
    expect(migration).toContain("print_request_legal_status_transition");
    expect(repository).toContain("eq(printRequest.version, input.expectedVersion)");
    expect(repository).toContain("eq(printRequest.currentStatus, current.currentStatus)");
    expect(repository).toContain(".insert(requestEvent)");
  });

  it("makes request creation idempotent and identity-bound", () => {
    expect(migration).toContain("print_request_idempotency_key_uidx");
    expect(repository).toContain("pg_advisory_xact_lock");
    expect(repository).toContain("eq(printRequest.idempotencyKey, input.idempotencyKey)");
    expect(repository).toContain("existing.requesterEmail === input.requesterEmail");
    expect(repository).toContain("existing.submitterIpHmac === input.submitterIpHmac");
  });

  it("increments rate-limit buckets atomically without an in-memory map", () => {
    expect(rateLimit).toContain(".onConflictDoUpdate");
    expect(rateLimit).toContain("where: lt(rateLimitBucket.requestCount, options.limit)");
    expect(rateLimit).not.toContain("new Map");
  });
});
