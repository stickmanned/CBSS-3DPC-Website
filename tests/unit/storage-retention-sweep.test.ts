import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn(), select: vi.fn() }));

// retention.ts is server-only; the package has no runtime body to resolve here.
vi.mock("server-only", () => ({}));

vi.mock("@/app/lib/db", () => ({
  getDatabase: () => ({
    select: () => ({ from: () => ({ where: mocks.select }) }),
  }),
  requestFile: { storageKey: "storage_key" },
}));

vi.mock("drizzle-orm", () => ({ inArray: (_c: unknown, v: unknown) => v }));

import { deleteAbandonedUploadObjects } from "@/app/lib/storage/retention";
import { isServerOwnedKey } from "@/app/lib/storage/r2";

vi.mock("@/app/lib/storage/r2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/lib/storage/r2")>();
  return {
    ...actual,
    getR2Connection: () => ({ client: { send: mocks.send }, bucket: "cbss-3dpc-uploads" }),
  };
});

const OLD = new Date("2026-08-01T00:00:00Z");

beforeEach(() => {
  mocks.send.mockReset();
  mocks.select.mockReset();
  mocks.select.mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());

describe("server-owned key recognition", () => {
  it.each([
    ["uploads/final/AbC-123_x.3mf", "final", true],
    ["uploads/temp/AbC-123_x.stl", "temp", true],
    // The diagnostic object left behind by the bucket-lock verification.
    ["uploads/final/.locktest-protected", "final", false],
    ["uploads/final/nested/thing.3mf", "final", false],
    ["uploads/final/no-extension", "final", false],
    ["uploads/final/thing.zip", "final", false],
  ])("%s in %s -> %s", (key, area, expected) => {
    expect(isServerOwnedKey(key, area as "temp" | "final")).toBe(expected);
  });
});

describe("abandoned upload sweep", () => {
  // Before this, one foreign key threw and aborted the sweep, so nothing was
  // ever cleaned up again. A locked diagnostic object made that concrete.
  it("skips a foreign key and still deletes the app's own abandoned objects", async () => {
    mocks.send.mockImplementation(async (command: { constructor: { name: string } }) => {
      if (command.constructor.name === "ListObjectsV2Command") {
        return {
          Contents: [
            { Key: "uploads/final/.locktest-protected", LastModified: OLD },
            { Key: "uploads/final/RealAbandoned_1.3mf", LastModified: OLD },
          ],
          IsTruncated: false,
        };
      }
      return {};
    });

    const result = await deleteAbandonedUploadObjects(new Date("2026-09-01T00:00:00Z"));

    const deleted = mocks.send.mock.calls
      .map(([c]) => c)
      .filter((c) => c.constructor.name === "DeleteObjectCommand")
      .map((c) => c.input.Key);

    expect(deleted).toContain("uploads/final/RealAbandoned_1.3mf");
    expect(deleted).not.toContain("uploads/final/.locktest-protected");
    expect(result.failures).toBe(0);
  });
});
