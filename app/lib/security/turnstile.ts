import { z } from "zod";
import { turnstileDisabled } from "./turnstile-config";

const turnstileResponseSchema = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
  // Cloudflare returns the actual cause here. Dropping it left every failure
  // — expired token, wrong secret, unlisted hostname — looking identical in
  // production, which is the one shape no bug report can act on.
  "error-codes": z.array(z.string()).optional(),
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

/**
 * Strips the port, lowercases, and folds `www.` into the apex so the three
 * spellings of one site compare equal.
 */
function normalizeHostname(value: string | undefined): string {
  const bare = (value ?? "").toLowerCase().trim().split(":")[0] ?? "";
  return bare.startsWith("www.") ? bare.slice(4) : bare;
}

/**
 * Which hostnames may have minted the token.
 *
 * The request's own hostname is always accepted, and that is the check that
 * actually matters: it proves the challenge was solved on the site now
 * spending the token, which is the replay this guard exists to stop. It also
 * cannot go stale. A single pinned env value could and did — set to the Vercel
 * preview domain, it rejected every token minted on the real domain and turned
 * the whole upload path into "Request could not be processed." Configuration
 * now only ever *widens* the set, so a forgotten value cannot take the site
 * down again.
 */
function allowedHostnames(requestHostname?: string): string[] {
  const configured = (process.env.TURNSTILE_EXPECTED_HOSTNAME ?? "")
    .split(",")
    .map(normalizeHostname)
    .filter(Boolean);
  const own = normalizeHostname(requestHostname);
  return own ? [own, ...configured] : configured;
}

export async function verifyTurnstile(
  token: string | undefined,
  remoteIp?: string,
  requestHostname?: string,
): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Deliberately first, and a skip rather than a throw. This used to reject
  // whenever the keys were also present, so the operator reaching for the
  // switch during an outage took the form from degraded to entirely down.
  if (turnstileDisabled()) {
    console.warn(
      "[turnstile] disabled by configuration; this request was accepted on the" +
        " honeypot, fill-time, form-age and rate-limit checks alone",
    );
    return;
  }

  if (!secret && !siteKey) {
    // Missing configuration is not the same as configuration that says "off",
    // so production still fails closed here rather than silently unprotected.
    if (process.env.NODE_ENV === "production") {
      throw new TurnstileConfigurationError();
    }
    return;
  }
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
  } catch (error) {
    console.error(
      "[turnstile] siteverify unreachable:",
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
    throw new TurnstileVerificationError();
  }

  const allowed = allowedHostnames(requestHostname);
  const expectedAction = process.env.TURNSTILE_EXPECTED_ACTION ?? "print-request";
  const hostnameMismatch =
    allowed.length > 0 && !allowed.includes(normalizeHostname(result.hostname));
  const actionMismatch = Boolean(expectedAction) && result.action !== expectedAction;

  if (!result.success || hostnameMismatch || actionMismatch) {
    // Server-side only. The requester still sees one generic message, but a
    // misconfigured TURNSTILE_EXPECTED_HOSTNAME and a genuinely failed
    // challenge are no longer indistinguishable to whoever reads the logs.
    console.error(
      `[turnstile] rejected success=${result.success}` +
        ` codes=[${result["error-codes"]?.join(",") ?? ""}]` +
        ` hostname=${result.hostname ?? "?"}${hostnameMismatch ? ` (allowed ${allowed.join("|")})` : ""}` +
        ` action=${result.action ?? "?"}${actionMismatch ? ` (expected ${expectedAction})` : ""}`,
    );
    throw new TurnstileVerificationError();
  }
}
