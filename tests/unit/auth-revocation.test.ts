import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findAdmin: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
  isAuthConfigured: () => true,
}));

vi.mock("@/app/lib/auth/admin-store", () => ({
  findActiveAdminByGithubId: mocks.findAdmin,
}));

import {
  AdminAuthorizationError,
  requireAdmin,
} from "@/app/lib/auth/require-admin";

describe("requireAdmin", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.findAdmin.mockReset();
    mocks.auth.mockResolvedValue({ user: { githubId: "12345" } });
  });

  it("re-checks the database and immediately rejects a removed admin", async () => {
    mocks.findAdmin
      .mockResolvedValueOnce({
        id: "admin-id",
        githubId: "12345",
        githubLogin: "maker",
        displayName: null,
      })
      .mockResolvedValueOnce(null);

    await expect(requireAdmin()).resolves.toMatchObject({ githubId: "12345" });
    await expect(requireAdmin()).rejects.toBeInstanceOf(AdminAuthorizationError);
    expect(mocks.findAdmin).toHaveBeenCalledTimes(2);
  });
});
