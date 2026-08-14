import { z } from "zod";

const turnstileResponseSchema = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
});

export class TurnstileVerificationError extends Error {
  constructor() {
    super("Human verification failed.");
    this.name = "TurnstileVerificationError";
  }
}

export class TurnstileConfigurationError extends Error {
  constructor() {
    super("Human verification is not configured correctly.");
    this.name = "TurnstileConfigurationError";
  }
}

export async function verifyTurnstile(
  token: string | undefined,
  remoteIp?: string,
): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const explicitlyDisabled = process.env.TURNSTILE_DISABLED === "true";
  if (!secret && !siteKey) {
    if (process.env.NODE_ENV === "production" && !explicitlyDisabled) {
      throw new TurnstileConfigurationError();
    }
    return;
  }
  if (explicitlyDisabled) throw new TurnstileConfigurationError();
  if (!secret || !siteKey) throw new TurnstileConfigurationError();
  if (!token) throw new TurnstileVerificationError();

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);

  let result: z.infer<typeof turnstileResponseSchema>;
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok) throw new Error("verification unavailable");
    result = turnstileResponseSchema.parse(await response.json());
  } catch {
    throw new TurnstileVerificationError();
  }

  const expectedHostname = process.env.TURNSTILE_EXPECTED_HOSTNAME?.toLowerCase();
  const expectedAction = process.env.TURNSTILE_EXPECTED_ACTION ?? "print-request";
  if (
    !result.success ||
    (expectedHostname && result.hostname?.toLowerCase() !== expectedHostname) ||
    (expectedAction && result.action !== expectedAction)
  ) {
    throw new TurnstileVerificationError();
  }
}
