import { afterEach, describe, expect, it, vi } from "vitest";
import {
  genericError,
  readJsonBody,
  requireSameOrigin,
  UnsafeRequestError,
} from "@/app/lib/security/request-security";

describe("mutation request security", () => {
  afterEach(() => {
    delete process.env.APP_ORIGIN;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("records the cause of a generic response without disclosing it", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = genericError(400, {
      route: "uploads/complete",
      error: new RangeError("central directory offset mismatch"),
    });

    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining("central directory offset mismatch"),
    );
    expect(logged.mock.calls[0]![0]).toContain("uploads/complete");
    // The requester still learns nothing beyond the refusal itself.
    await expect(response.json()).resolves.toEqual({
      error: "Request could not be processed.",
    });
  });

  it("logs nothing when a caller passes no cause", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    genericError(429);
    expect(logged).not.toHaveBeenCalled();
  });

  it("requires the canonical HTTPS origin in production and rejects forged hosts", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() =>
      requireSameOrigin(
        new Request("https://forged.example/api/uploads/presign", {
          method: "POST",
          headers: { origin: "https://forged.example" },
        }),
      ),
    ).toThrow(UnsafeRequestError);

    vi.stubEnv("APP_ORIGIN", "https://queue.example");
    expect(() =>
      requireSameOrigin(
        new Request("https://forged.example/api/uploads/presign", {
          method: "POST",
          headers: { origin: "https://forged.example" },
        }),
      ),
    ).toThrow(UnsafeRequestError);
  });

  it("requires an exact browser origin", () => {
    const accepted = new Request("https://queue.example/api/uploads/presign", {
      method: "POST",
      headers: {
        origin: "https://queue.example",
        "sec-fetch-site": "same-origin",
      },
    });
    expect(() => requireSameOrigin(accepted)).not.toThrow();

    const crossOrigin = new Request("https://queue.example/api/uploads/presign", {
      method: "POST",
      headers: {
        origin: "https://attacker.example",
        "sec-fetch-site": "cross-site",
      },
    });
    expect(() => requireSameOrigin(crossOrigin)).toThrow(UnsafeRequestError);
  });

  it("rejects a JSON body beyond the endpoint limit", async () => {
    const request = new Request("https://queue.example/api/uploads/complete", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": "1000",
      },
      body: JSON.stringify({ token: "small" }),
    });
    await expect(readJsonBody(request, 100)).rejects.toBeInstanceOf(
      UnsafeRequestError,
    );
  });
});
