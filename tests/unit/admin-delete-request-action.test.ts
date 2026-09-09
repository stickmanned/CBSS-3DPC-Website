import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getDatabase: vi.fn(),
  transaction: vi.fn(),
  select: vi.fn(),
  selectFrom: vi.fn(),
  selectLeftJoin: vi.fn(),
  selectWhere: vi.fn(),
  selectLimit: vi.fn(),
  selectForUpdate: vi.fn(),
  deleteRequest: vi.fn(),
  deleteWhere: vi.fn(),
  deleteReturning: vi.fn(),
  deleteRetainedModelObject: vi.fn(),
  revalidatePath: vi.fn(),
  events: [] as string[],
}));

vi.mock("server-only", () => ({}));

vi.mock("@/app/lib/auth", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/app/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/lib/db")>();
  return { ...actual, getDatabase: mocks.getDatabase };
});

vi.mock("@/app/lib/storage/retention", () => ({
  deleteRetainedModelObject: mocks.deleteRetainedModelObject,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import {
  deleteRequestAction,
  type AdminActionState,
} from "@/app/admin/actions";

const REQUEST_ID = "c0a80101-1234-4abc-8def-1234567890ab";
const REQUEST_REF = "CBSS-0123";
const FINAL_STORAGE_KEY = "uploads/final/server-owned-model.3mf";
const INITIAL_STATE: AdminActionState = { tone: "idle", message: "" };

type SelectQueryDouble = {
  from: (table: unknown) => SelectQueryDouble;
  leftJoin: (table: unknown, condition: unknown) => SelectQueryDouble;
  where: (condition: unknown) => SelectQueryDouble;
  limit: (count: number) => SelectQueryDouble;
  for: (strength: string, config: unknown) => Promise<unknown[]>;
};

function createTransactionDouble() {
  const selectQuery: SelectQueryDouble = {
    from: (table) => {
      mocks.selectFrom(table);
      return selectQuery;
    },
    leftJoin: (table, condition) => {
      mocks.selectLeftJoin(table, condition);
      return selectQuery;
    },
    where: (condition) => {
      mocks.selectWhere(condition);
      return selectQuery;
    },
    limit: (count) => {
      mocks.selectLimit(count);
      return selectQuery;
    },
    for: (strength, config) => mocks.selectForUpdate(strength, config),
  };
  const deleteQuery = {
    where: (condition: unknown) => {
      mocks.deleteWhere(condition);
      return { returning: (fields: unknown) => mocks.deleteReturning(fields) };
    },
  };

  mocks.select.mockImplementation(() => selectQuery);
  mocks.deleteRequest.mockImplementation(() => deleteQuery);
  return { select: mocks.select, delete: mocks.deleteRequest };
}

function actionForm(
  requestId = REQUEST_ID,
  expectedVersion: string | number = 7,
  confirmationRef = REQUEST_REF,
): FormData {
  const formData = new FormData();
  formData.set("requestId", requestId);
  formData.set("expectedVersion", String(expectedVersion));
  formData.set("confirmationRef", confirmationRef);
  return formData;
}

beforeEach(() => {
  for (const mock of [
    mocks.requireAdmin,
    mocks.getDatabase,
    mocks.transaction,
    mocks.select,
    mocks.selectFrom,
    mocks.selectLeftJoin,
    mocks.selectWhere,
    mocks.selectLimit,
    mocks.selectForUpdate,
    mocks.deleteRequest,
    mocks.deleteWhere,
    mocks.deleteReturning,
    mocks.deleteRetainedModelObject,
    mocks.revalidatePath,
  ]) {
    mock.mockReset();
  }
  mocks.events.length = 0;

  const transactionDouble = createTransactionDouble();
  mocks.requireAdmin.mockResolvedValue({ githubLogin: "active-admin" });
  mocks.getDatabase.mockReturnValue({ transaction: mocks.transaction });
  mocks.transaction.mockImplementation(async (callback) => {
    const result = await callback(transactionDouble);
    mocks.events.push("commit");
    return result;
  });
  mocks.selectForUpdate.mockResolvedValue([]);
  mocks.deleteReturning.mockResolvedValue([]);
  mocks.deleteRetainedModelObject.mockImplementation(async () => {
    mocks.events.push("r2");
  });
});

describe("deleteRequestAction", () => {
  it("short-circuits before validation, database access, or storage access for a revoked admin", async () => {
    const revoked = new Error("revoked");
    mocks.requireAdmin.mockRejectedValue(revoked);

    await expect(
      deleteRequestAction(INITIAL_STATE, actionForm("invalid", -1)),
    ).rejects.toBe(revoked);

    expect(mocks.getDatabase).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.deleteRetainedModelObject).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["not a UUID", actionForm("not-a-uuid", 7)],
    ["a missing version", actionForm(REQUEST_ID, "")],
    ["a negative version", actionForm(REQUEST_ID, -1)],
    ["a fractional version", actionForm(REQUEST_ID, "1.5")],
    ["a malformed confirmation reference", actionForm(REQUEST_ID, 7, "cbss-123")],
  ])("rejects %s before opening a database transaction", async (_label, formData) => {
    await expect(deleteRequestAction(INITIAL_STATE, formData)).resolves.toEqual({
      tone: "error",
      message:
        "Deletion details were invalid. Refresh the dashboard and enter the request reference exactly as shown.",
    });

    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.getDatabase).not.toHaveBeenCalled();
    expect(mocks.deleteRetainedModelObject).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does not delete or touch storage when the request is missing or already stale", async () => {
    mocks.selectForUpdate.mockResolvedValue([]);

    await expect(deleteRequestAction(INITIAL_STATE, actionForm())).resolves.toEqual({
      tone: "warning",
      message:
        "This request changed or no longer exists. Refresh the dashboard before deleting it.",
    });

    expect(mocks.selectLimit).toHaveBeenCalledWith(1);
    expect(mocks.selectForUpdate).toHaveBeenCalledWith(
      "update",
      expect.objectContaining({ of: expect.anything() }),
    );
    expect(mocks.deleteRequest).not.toHaveBeenCalled();
    expect(mocks.deleteRetainedModelObject).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does not touch storage when a competing update wins the version-guarded delete", async () => {
    mocks.selectForUpdate.mockResolvedValue([
      { id: REQUEST_ID, ref: REQUEST_REF, storageKey: FINAL_STORAGE_KEY, purgedAt: null },
    ]);
    mocks.deleteReturning.mockResolvedValue([]);

    const result = await deleteRequestAction(INITIAL_STATE, actionForm());

    expect(result.tone).toBe("warning");
    expect(mocks.deleteRequest).toHaveBeenCalledTimes(1);
    expect(mocks.deleteRetainedModelObject).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does not delete or touch storage when the typed reference differs from the stored reference", async () => {
    mocks.selectForUpdate.mockResolvedValue([
      { id: REQUEST_ID, ref: REQUEST_REF, storageKey: FINAL_STORAGE_KEY, purgedAt: null },
    ]);

    await expect(
      deleteRequestAction(INITIAL_STATE, actionForm(REQUEST_ID, 7, "CBSS-9999")),
    ).resolves.toEqual({
      tone: "error",
      message: "The confirmation reference did not match. Nothing was deleted.",
    });

    expect(mocks.deleteRequest).not.toHaveBeenCalled();
    expect(mocks.deleteRetainedModelObject).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("deletes one version-matching request before cleaning up its exact unpurged object", async () => {
    mocks.selectForUpdate.mockResolvedValue([
      { id: REQUEST_ID, ref: REQUEST_REF, storageKey: FINAL_STORAGE_KEY, purgedAt: null },
    ]);
    mocks.deleteReturning.mockResolvedValue([{ id: REQUEST_ID }]);

    await expect(deleteRequestAction(INITIAL_STATE, actionForm())).resolves.toEqual({
      tone: "success",
      message: "Print request deleted.",
    });

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.deleteRequest).toHaveBeenCalledTimes(1);
    expect(mocks.deleteRetainedModelObject).toHaveBeenCalledOnce();
    expect(mocks.deleteRetainedModelObject).toHaveBeenCalledWith(FINAL_STORAGE_KEY);
    expect(mocks.events).toEqual(["commit", "r2"]);
    expect(mocks.revalidatePath).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin");

    const dialect = new PgDialect();
    const deleteCondition = mocks.deleteWhere.mock.calls[0]?.[0] as SQL;
    const query = dialect.sqlToQuery(deleteCondition);
    expect(query.params).toEqual([REQUEST_ID, 7, REQUEST_REF]);
    expect(query.sql).toContain('"print_request"."id"');
    expect(query.sql).toContain('"print_request"."version"');
  });

  it("does not repeat storage cleanup for a file that was already purged", async () => {
    mocks.selectForUpdate.mockResolvedValue([
      {
        id: REQUEST_ID,
        ref: REQUEST_REF,
        storageKey: FINAL_STORAGE_KEY,
        purgedAt: new Date("2026-08-01T00:00:00Z"),
      },
    ]);
    mocks.deleteReturning.mockResolvedValue([{ id: REQUEST_ID }]);

    const result = await deleteRequestAction(INITIAL_STATE, actionForm());

    expect(result).toEqual({ tone: "success", message: "Print request deleted." });
    expect(mocks.deleteRetainedModelObject).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("reports a warning and still refreshes the dashboard when storage cleanup fails", async () => {
    mocks.selectForUpdate.mockResolvedValue([
      { id: REQUEST_ID, ref: REQUEST_REF, storageKey: FINAL_STORAGE_KEY, purgedAt: null },
    ]);
    mocks.deleteReturning.mockResolvedValue([{ id: REQUEST_ID }]);
    mocks.deleteRetainedModelObject.mockImplementation(async () => {
      mocks.events.push("r2");
      throw new Error("credentials included only in this test error");
    });

    await expect(deleteRequestAction(INITIAL_STATE, actionForm())).resolves.toEqual({
      tone: "warning",
      message:
        "Print request deleted, but its uploaded model could not be removed yet. Automatic storage cleanup will retry later.",
    });

    expect(mocks.events).toEqual(["commit", "r2"]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("returns a safe error and does not touch storage when the transaction fails", async () => {
    mocks.transaction.mockRejectedValue(
      new Error("postgres://user:secret@private-host/database"),
    );

    await expect(deleteRequestAction(INITIAL_STATE, actionForm())).resolves.toEqual({
      tone: "error",
      message: "The print request could not be deleted. No changes were made.",
    });

    expect(mocks.deleteRetainedModelObject).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
