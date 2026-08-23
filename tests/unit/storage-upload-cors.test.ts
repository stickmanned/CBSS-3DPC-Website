import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/lib/storage/r2", () => ({
  getR2Connection: () => ({ client: {}, bucket: "cbss-3dpc-uploads" }),
  r2Endpoint: () => "https://acct.r2.cloudflarestorage.com",
}));

import {
  bucketAcceptsUploadsFrom,
  resetUploadCorsCacheForTests,
} from "@/app/lib/storage/upload-cors";

function preflightReturns(allowOrigin: string | null) {
  const fetchSpy = vi.fn().mockResolvedValue({
    headers: new Headers(allowOrigin ? { "access-control-allow-origin": allowOrigin } : {}),
  });
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

beforeEach(() => resetUploadCorsCacheForTests());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("browser upload origin check", () => {
  it("reports allowed when R2 echoes the origin back", async () => {
    preflightReturns("https://3dprintingclub.org");
    await expect(bucketAcceptsUploadsFrom("https://3dprintingclub.org")).resolves.toBe(
      "allowed",
    );
  });

  // The production failure: the bucket listed the preview URL and localhost,
  // so the apex got a 403 with no allow-origin and the browser killed the PUT
  // before sending it.
  it("reports refused when R2 answers without an allow-origin header", async () => {
    preflightReturns(null);
    await expect(bucketAcceptsUploadsFrom("https://3dprintingclub.org")).resolves.toBe(
      "refused",
    );
  });

  it("asks the same question the browser asks", async () => {
    const fetchSpy = preflightReturns("https://3dprintingclub.org");
    await bucketAcceptsUploadsFrom("https://3dprintingclub.org");

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://acct.r2.cloudflarestorage.com/cbss-3dpc-uploads/uploads/temp/.cors-probe");
    expect(init.method).toBe("OPTIONS");
    expect(init.headers.origin).toBe("https://3dprintingclub.org");
    expect(init.headers["access-control-request-method"]).toBe("PUT");
    expect(init.headers["access-control-request-headers"]).toContain("x-amz-meta-upload-nonce");
  });

  // Never blocks. A check that could refuse traffic on its own fault would be
  // repeating the mistake it exists to catch.
  it("fails open to unknown when the probe itself cannot complete", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await expect(bucketAcceptsUploadsFrom("https://3dprintingclub.org")).resolves.toBe(
      "unknown",
    );
  });

  it("caches a settled verdict instead of probing per upload", async () => {
    const fetchSpy = preflightReturns("https://3dprintingclub.org");
    await bucketAcceptsUploadsFrom("https://3dprintingclub.org");
    await bucketAcceptsUploadsFrom("https://3dprintingclub.org");
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("re-probes for a different origin rather than reusing the answer", async () => {
    const fetchSpy = preflightReturns("https://3dprintingclub.org");
    await bucketAcceptsUploadsFrom("https://3dprintingclub.org");
    await bucketAcceptsUploadsFrom("https://www.3dprintingclub.org");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("retries an unknown sooner than a settled verdict", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("blip")));
    const t0 = 1_000_000;
    await bucketAcceptsUploadsFrom("https://3dprintingclub.org", t0);

    preflightReturns("https://3dprintingclub.org");
    // 31s later: past the unknown TTL, far short of the settled one.
    await expect(
      bucketAcceptsUploadsFrom("https://3dprintingclub.org", t0 + 31_000),
    ).resolves.toBe("allowed");
  });
});
