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

  function post(url: string, headers: Record<string, string>) {
    return new Request(url, { method: "POST", headers });
  }

  // The production outage, pinned. APP_ORIGIN was left on the Vercel preview
  // domain, so every submission from the real site was refused on the first
  // line of the upload route and surfaced as "Request could not be processed."
  // The domain the browser actually reached is now what decides.
  it("accepts the domain the browser reached even when APP_ORIGIN names another", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "https://cbss-3dpc-website.vercel.app");

    expect(() =>
      requireSameOrigin(
        post("https://3dprintingclub.org/api/uploads/presign", {
          origin: "https://3dprintingclub.org",
          "sec-fetch-site": "same-origin",
        }),
      ),
    ).not.toThrow();
  });

  it("accepts every alias of the site, not just the one that was configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "https://3dprintingclub.org");

    for (const host of [
      "https://www.3dprintingclub.org",
      "https://cbss-3dpc-website.vercel.app",
    ]) {
      expect(() =>
        requireSameOrigin(post(`${host}/api/uploads/presign`, { origin: host })),
      ).not.toThrow();
    }
  });

  it("still refuses a cross-site POST, which is the check that carries the weight", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "https://3dprintingclub.org");

    expect(() =>
      requireSameOrigin(
        post("https://3dprintingclub.org/api/uploads/presign", {
          origin: "https://attacker.example",
        }),
      ),
    ).toThrow(UnsafeRequestError);
  });

  it("refuses a plaintext origin in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() =>
      requireSameOrigin(
        post("http://3dprintingclub.org/api/uploads/presign", {
          origin: "http://3dprintingclub.org",
        }),
      ),
    ).toThrow(UnsafeRequestError);
  });

  it("leaves local development on http working", () => {
    expect(() =>
      requireSameOrigin(
        post("http://localhost:3000/api/uploads/presign", {
          origin: "http://localhost:3000",
        }),
      ),
    ).not.toThrow();
  });

  it("requires an Origin header at all", () => {
    expect(() =>
      requireSameOrigin(post("https://3dprintingclub.org/api/uploads/presign", {})),
    ).toThrow(UnsafeRequestError);
  });

  // A typo in configuration is a warning, never an outage.
  it("survives an unusable APP_ORIGIN instead of failing the request", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "not a url");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() =>
      requireSameOrigin(
        post("https://3dprintingclub.org/api/uploads/presign", {
          origin: "https://3dprintingclub.org",
        }),
      ),
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("not a url"));
  });

  it("names an unlisted origin in the log without refusing it", () => {
    vi.stubEnv("APP_ORIGIN", "https://3dprintingclub.org");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    requireSameOrigin(
      post("https://staging.3dprintingclub.org/api/uploads/presign", {
        origin: "https://staging.3dprintingclub.org",
      }),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("https://staging.3dprintingclub.org"),
    );
  });

  it("refuses a request the browser itself labels cross-site", () => {
    expect(() =>
      requireSameOrigin(
        post("https://3dprintingclub.org/api/uploads/presign", {
          origin: "https://3dprintingclub.org",
          "sec-fetch-site": "cross-site",
        }),
      ),
    ).toThrow(UnsafeRequestError);
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
