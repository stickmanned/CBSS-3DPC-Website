import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findFile: vi.fn(),
  createDownload: vi.fn(),
}));

vi.mock("@/app/lib/auth/require-admin", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/app/lib/storage/file-store", () => ({
  findDownloadableRequestFile: mocks.findFile,
}));

vi.mock("@/app/lib/storage/upload-lifecycle", () => ({
  createPresignedDownload: mocks.createDownload,
}));

import { GET } from "@/app/api/admin/files/[fileId]/route";

const FILE_ID = "c0a80101-1234-4abc-8def-1234567890ab";

function requestFile() {
  return GET(new Request(`https://queue.example/api/admin/files/${FILE_ID}`), {
    params: Promise.resolve({ fileId: FILE_ID }),
  });
}

describe("admin file delivery", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockReset();
    mocks.findFile.mockReset();
    mocks.createDownload.mockReset();
    mocks.requireAdmin.mockResolvedValue({ githubId: "12345" });
  });

  it("does not query or sign a file for a revoked admin", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("revoked"));
    const response = await requestFile();
    expect(response.status).toBe(404);
    expect(mocks.findFile).not.toHaveBeenCalled();
    expect(mocks.createDownload).not.toHaveBeenCalled();
  });

  it("does not sign an object without an associated unpurged row", async () => {
    mocks.findFile.mockResolvedValue(null);
    const response = await requestFile();
    expect(response.status).toBe(404);
    expect(mocks.createDownload).not.toHaveBeenCalled();
  });

  it("redirects an active admin to the short-lived signed download", async () => {
    mocks.findFile.mockResolvedValue({
      id: FILE_ID,
      requestId: "c0a80101-1234-4abc-8def-1234567890ac",
      storageKey: "uploads/final/server-owned.stl",
      originalName: "student-part.stl",
      verifiedByteSize: 134,
      fileKind: "stl",
      etag: "etag",
    });
    mocks.createDownload.mockResolvedValue(
      "https://account.r2.cloudflarestorage.com/private?signature=secret",
    );

    const response = await requestFile();
    expect(response.status).toBe(307);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.createDownload).toHaveBeenCalledTimes(1);
  });
});
