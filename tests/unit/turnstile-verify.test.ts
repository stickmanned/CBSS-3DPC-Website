import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TurnstileConfigurationError,
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
