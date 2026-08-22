import { isIP } from "node:net";
import { NextResponse } from "next/server";

/**
 * The `reason` never reaches the client — `genericError` still answers with the
 * same opaque body. It exists so the server-side log names which check refused
 * the request; without it every rejection here is indistinguishable from the
 * others and an operator has nothing to act on.
 */
export class UnsafeRequestError extends Error {
  constructor(readonly reason = "unspecified") {
    super(`The request could not be accepted (${reason}).`);
    this.name = "UnsafeRequestError";
  }
}

/**
 * Origins this app also answers to, beyond the one it was reached on.
 *
 * Comma-separated, and entirely optional. A value here can only ever *widen*
 * what is recognised: it is read for logging and for deliberate multi-origin
 * setups, and an unusable entry is dropped with a warning instead of thrown.
 * Nothing on the request path depends on it being correct — which is the whole
 * point, and is explained in `requireSameOrigin`.
 */
function configuredOrigins(): string[] {
  const raw = process.env.APP_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const origins: string[] = [];

  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    try {
      const url = new URL(trimmed);
      if (url.username || url.password) throw new Error("credentials in origin");
      origins.push(url.origin);
    } catch {
      console.warn(`[request-security] ignoring unusable configured origin: ${trimmed}`);
    }
  }

  return origins;
}

/**
 * Refuses any request the browser did not make from this exact site.
 *
 * The guarantee is `Origin` equals the origin actually reached, and on its own
 * that is the whole of the CSRF defence. A page on another site can make a
 * visitor's browser POST here, but it cannot make that browser lie about
 * `Origin`; the two disagree and the request dies. It needs no configuration,
 * and that turns out to matter more than it sounds.
 *
 * A comparison against a single pinned `APP_ORIGIN` used to sit beside it. It
 * bought nothing: matching a forged `Host` to a forged `Origin` means sending
 * the request yourself, which is not CSRF and gains an attacker nothing they
 * could not get by calling the endpoint directly — and a Host not assigned to
 * the project never reaches this code on Vercel anyway. What it did do was
 * take the live site down. Pinned to the preview domain, it refused every
 * request from the real one on the first line of the upload route; requesters
 * saw "Request could not be processed." and the Turnstile logs showed nothing
 * at all, because execution never got that far. A check that can only subtract
 * is a check that can only fail closed on the domain people actually use, so
 * it no longer decides this.
 */
export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) throw new UnsafeRequestError("missing-origin-header");

  let suppliedOrigin: string;
  let requestUrl: URL;
  try {
    suppliedOrigin = new URL(origin).origin;
    requestUrl = new URL(request.url);
  } catch {
    throw new UnsafeRequestError("unparsable-origin");
  }

  if (suppliedOrigin !== requestUrl.origin) {
    // Origins are not secrets, and naming both is the only way to tell a
    // cross-site POST apart from a proxy rewriting the request URL.
    throw new UnsafeRequestError(
      `origin-mismatch browser=${suppliedOrigin} request-url=${requestUrl.origin}`,
    );
  }

  const loopback =
    requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1";
  if (
    requestUrl.protocol !== "https:" &&
    !(loopback && process.env.NODE_ENV !== "production")
  ) {
    throw new UnsafeRequestError(`insecure-origin ${requestUrl.origin}`);
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    throw new UnsafeRequestError(`cross-site-fetch sec-fetch-site=${fetchSite}`);
  }

  // Deliberately not a gate. An unlisted origin is worth an operator noticing
  // and is never worth refusing a legitimate request over.
  const configured = configuredOrigins();
  if (configured.length > 0 && !configured.includes(requestUrl.origin)) {
    console.warn(
      `[request-security] serving ${requestUrl.origin}, absent from APP_ORIGIN` +
        ` (${configured.join("|")}); accepted on same-origin proof`,
    );
  }
}

export function requireJsonRequest(request: Request): void {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim();
  if (contentType !== "application/json") throw new UnsafeRequestError();
}

export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new UnsafeRequestError();
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
    throw new UnsafeRequestError();
  }

  const reader = request.body?.getReader();
  if (!reader) throw new UnsafeRequestError();

  const decoder = new TextDecoder("utf-8", { fatal: true });
  let decoded = "";
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new UnsafeRequestError();
      }
      decoded += decoder.decode(value, { stream: true });
    }
    decoded += decoder.decode();
    if (!received) throw new UnsafeRequestError();
    return JSON.parse(decoded);
  } catch {
    throw new UnsafeRequestError();
  }
}

export function clientIp(request: Request): string {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "";
  const candidate = forwarded.split(",", 1)[0]?.trim();
  return candidate && isIP(candidate) ? candidate : "unknown";
}

/**
 * The body stays deliberately vague so a caller cannot probe the queue with it.
 * That vagueness is only safe if the real cause survives somewhere, so every
 * generic response records one server-side: this is the single point where a
 * failure stops being specific, and an unlogged one leaves an operator staring
 * at "Request could not be processed." with nothing to act on.
 */
export function logRequestFailure(
  route: string,
  status: number,
  error: unknown,
): void {
  const detail =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error(`[${route}] ${status} ${detail}`);
  // An unrecognized failure is a bug rather than a rejected input, so keep the
  // stack that identifies it.
  if (status >= 500 && error instanceof Error && error.stack) {
    console.error(error.stack);
  }
}

export function genericError(
  status: 400 | 403 | 404 | 409 | 413 | 429 | 503,
  cause?: { route: string; error?: unknown },
) {
  if (cause) logRequestFailure(cause.route, status, cause.error);

  const response = NextResponse.json(
    {
      error:
        status === 429
          ? "Too many requests. Try again later."
          : "Request could not be processed.",
    },
    { status },
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
