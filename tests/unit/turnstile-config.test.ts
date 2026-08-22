import { afterEach, describe, expect, it, vi } from "vitest";
import { turnstileDisabled } from "@/app/lib/security/turnstile-config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("turnstileDisabled", () => {
  it("is off unless a flag says otherwise", () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_DISABLED", "");
    vi.stubEnv("TURNSTILE_DISABLED", "");
    expect(turnstileDisabled()).toBe(false);
  });

  it("honours the public flag both halves can read", () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_DISABLED", "true");
    expect(turnstileDisabled()).toBe(true);
  });

  it("still honours the server-only alias", () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_DISABLED", "");
    vi.stubEnv("TURNSTILE_DISABLED", "true");
    expect(turnstileDisabled()).toBe(true);
  });

  // "false", "1", "yes" and friends must not read as disabled: a typo here
  // would silently drop the challenge from every request.
  it.each(["false", "1", "yes", "TRUE", " true"])(
    "does not treat %o as disabled",
    (value) => {
      vi.stubEnv("NEXT_PUBLIC_TURNSTILE_DISABLED", value);
      vi.stubEnv("TURNSTILE_DISABLED", value);
      expect(turnstileDisabled()).toBe(false);
    },
  );
});
