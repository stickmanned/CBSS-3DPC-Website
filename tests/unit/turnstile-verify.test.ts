import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TurnstileConfigurationError,
  TurnstileVerificationError,
  verifyTurnstile,
} from "@/app/lib/security/turnstile";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function withKeys() {
  vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "0xSITEKEY");
}

describe("verifyTurnstile", () => {
  // The regression that matters: the old code threw whenever the switch was on
  // and the keys were still set, so an operator disabling Turnstile during an
  // outage turned every submission into a 503 instead of letting it through.
  it("skips verification when disabled even though the keys are present", async () => {
    withKeys();
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_DISABLED", "true");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(verifyTurnstile(undefined)).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("says so in the log when it lets a request through unchallenged", async () => {
    withKeys();
    vi.stubEnv("TURNSTILE_DISABLED", "true");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await verifyTurnstile(undefined);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[turnstile] disabled"));
  });

  // Absent configuration is not the same as configuration that says "off".
  it("still fails closed in production when the keys are simply missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_DISABLED", "");
    vi.stubEnv("TURNSTILE_DISABLED", "");

    await expect(verifyTurnstile(undefined)).rejects.toBeInstanceOf(
      TurnstileConfigurationError,
    );
  });

  it("rejects a half-configured pair", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_DISABLED", "");
    vi.stubEnv("TURNSTILE_DISABLED", "");

    await expect(verifyTurnstile("token")).rejects.toBeInstanceOf(
      TurnstileConfigurationError,
    );
  });
});

function siteverifyReturns(payload: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, action: "print-request", ...payload }),
    }),
  );
}

describe("verifyTurnstile hostname binding", () => {
  function configured(value: string) {
    withKeys();
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_DISABLED", "");
    vi.stubEnv("TURNSTILE_DISABLED", "");
    vi.stubEnv("TURNSTILE_EXPECTED_HOSTNAME", value);
    vi.spyOn(console, "error").mockImplementation(() => {});
  }

  it("accepts a token solved on the host the request arrived at", async () => {
    configured("");
    siteverifyReturns({ hostname: "3dprintingclub.org" });

    await expect(
      verifyTurnstile("token", undefined, "3dprintingclub.org"),
    ).resolves.toBeUndefined();
  });

  // The exact production failure: TURNSTILE_EXPECTED_HOSTNAME was pinned to the
  // Vercel preview domain, so every token minted on the real domain was thrown
  // out. Configuration must only widen the set, never replace it.
  it("accepts the request's own host even when config names a different one", async () => {
    configured("cbss-3dpc-website.vercel.app");
    siteverifyReturns({ hostname: "3dprintingclub.org" });

    await expect(
      verifyTurnstile("token", undefined, "3dprintingclub.org"),
    ).resolves.toBeUndefined();
  });

  it("still accepts the extra hostnames configuration lists", async () => {
    configured("cbss-3dpc-website.vercel.app");
    siteverifyReturns({ hostname: "cbss-3dpc-website.vercel.app" });

    await expect(
      verifyTurnstile("token", undefined, "3dprintingclub.org"),
    ).resolves.toBeUndefined();
  });

  it("rejects a token minted on some other site", async () => {
    configured("");
    siteverifyReturns({ hostname: "attacker.example" });

    await expect(
      verifyTurnstile("token", undefined, "3dprintingclub.org"),
    ).rejects.toBeInstanceOf(TurnstileVerificationError);
  });

  it.each([
    ["www.3dprintingclub.org", "3dprintingclub.org"],
    ["3dprintingclub.org", "www.3dprintingclub.org"],
    ["localhost", "localhost:3000"],
  ])("treats %o and %o as the same site", async (tokenHost, requestHost) => {
    configured("");
    siteverifyReturns({ hostname: tokenHost });

    await expect(
      verifyTurnstile("token", undefined, requestHost),
    ).resolves.toBeUndefined();
  });

  it("still enforces the action", async () => {
    configured("");
    siteverifyReturns({ hostname: "3dprintingclub.org", action: "something-else" });

    await expect(
      verifyTurnstile("token", undefined, "3dprintingclub.org"),
    ).rejects.toBeInstanceOf(TurnstileVerificationError);
  });
});

describe("verifyTurnstile action binding", () => {
  // Same failure shape as the pinned hostname and the pinned origin: a single
  // env value that could only ever contradict the literal the widget stamps.
  // The widget and the verifier now import one constant, so the only way to
  // disagree is deliberate.
  it("accepts the action the widget stamps even when config names another", async () => {
    withKeys();
    vi.stubEnv("TURNSTILE_EXPECTED_ACTION", "some-stale-action");
    siteverifyReturns({ hostname: "3dprintingclub.org", action: "print-request" });

    await expect(
      verifyTurnstile("token", undefined, "3dprintingclub.org"),
    ).resolves.toBeUndefined();
  });

  it("treats a configured action as an addition, not a replacement", async () => {
    withKeys();
    vi.stubEnv("TURNSTILE_EXPECTED_ACTION", "newsletter-signup");
    siteverifyReturns({ hostname: "3dprintingclub.org", action: "newsletter-signup" });

    await expect(
      verifyTurnstile("token", undefined, "3dprintingclub.org"),
    ).resolves.toBeUndefined();
  });

  it("still rejects a token minted for something else entirely", async () => {
    withKeys();
    vi.stubEnv("TURNSTILE_EXPECTED_ACTION", "");
    siteverifyReturns({ hostname: "3dprintingclub.org", action: "login" });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      verifyTurnstile("token", undefined, "3dprintingclub.org"),
    ).rejects.toBeInstanceOf(TurnstileVerificationError);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("action=login"));
  });

  it("rejects a response carrying no action at all", async () => {
    withKeys();
    vi.stubEnv("TURNSTILE_EXPECTED_ACTION", "");
    siteverifyReturns({ hostname: "3dprintingclub.org", action: undefined });
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      verifyTurnstile("token", undefined, "3dprintingclub.org"),
    ).rejects.toBeInstanceOf(TurnstileVerificationError);
  });
});
