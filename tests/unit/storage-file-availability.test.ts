import { afterEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/lib/storage/r2", () => ({
  getR2Connection: () => ({ client: { send: sendMock }, bucket: "cbss-3dpc-uploads" }),
}));

import { modelObjectPresence } from "@/app/lib/storage/file-availability";

const KEY = "uploads/final/PSG8HEmYw71IX7Tcg4UgWSNBABuQBdzJ.3mf";

afterEach(() => {
  sendMock.mockReset();
  vi.restoreAllMocks();
});

describe("model object presence", () => {
  it("reports present when the bucket still holds the object", async () => {
    sendMock.mockResolvedValue({ ContentLength: 21866675 });
    await expect(modelObjectPresence(KEY)).resolves.toBe("present");
  });

  // The exact shape behind the broken admin page: the request_file row is
  // intact, purgedAt is null, and the object is simply not there.
  it("reports missing on a NotFound", async () => {
    sendMock.mockRejectedValue(Object.assign(new Error("not found"), { name: "NotFound" }));
    await expect(modelObjectPresence(KEY)).resolves.toBe("missing");
  });

  it("reports missing on a NoSuchKey", async () => {
    sendMock.mockRejectedValue(Object.assign(new Error("gone"), { name: "NoSuchKey" }));
    await expect(modelObjectPresence(KEY)).resolves.toBe("missing");
  });

  it("reports missing on a bare 404 with no recognisable name", async () => {
    sendMock.mockRejectedValue(
      Object.assign(new Error("?"), { name: "Weird", $metadata: { httpStatusCode: 404 } }),
    );
    await expect(modelObjectPresence(KEY)).resolves.toBe("missing");
  });

  // A credential or network fault must not masquerade as a deleted file:
  // hiding a working download is worse than offering one that might fail.
  it.each([
    ["AccessDenied", 403],
    ["NetworkingError", undefined],
    ["InternalError", 500],
  ])("reports unknown rather than missing for %s", async (name, httpStatusCode) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    sendMock.mockRejectedValue(
      Object.assign(new Error(name), { name, $metadata: { httpStatusCode } }),
    );
    await expect(modelObjectPresence(KEY)).resolves.toBe("unknown");
  });

  it("names the key in the log when presence cannot be determined", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    sendMock.mockRejectedValue(Object.assign(new Error("nope"), { name: "AccessDenied" }));
    await modelObjectPresence(KEY);
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining(KEY),
      expect.anything(),
    );
  });
});
