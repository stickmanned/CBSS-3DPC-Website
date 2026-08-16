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

function configuredOrigin(): string | null {
  const raw = process.env.APP_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new UnsafeRequestError("app-origin-not-configured");
    }
    return null;
  }

  try {
    const url = new URL(raw);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (
      url.username ||
      url.password ||
      (url.protocol !== "https:" && !(local && process.env.NODE_ENV !== "production"))
    ) {
      throw new UnsafeRequestError(`app-origin-unusable value=${url.origin}`);
    }
    return url.origin;
  } catch (error) {
    if (error instanceof UnsafeRequestError) throw error;
    throw new UnsafeRequestError("app-origin-unparsable");
  }
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) throw new UnsafeRequestError("missing-origin-header");

  let suppliedOrigin: string;
  let requestOrigin: string;
  try {
    suppliedOrigin = new URL(origin).origin;
    requestOrigin = new URL(request.url).origin;
  } catch {
    throw new UnsafeRequestError("unparsable-origin");
  }

  const expected = configuredOrigin() ?? requestOrigin;
  if (suppliedOrigin !== expected || suppliedOrigin !== requestOrigin) {
    // Origins are not secrets and naming all three is the only way to tell a
    // misconfigured APP_ORIGIN apart from a proxy rewriting the request URL.
    throw new UnsafeRequestError(
      `origin-mismatch browser=${suppliedOrigin} configured=${expected} request-url=${requestOrigin}`,
    );
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    throw new UnsafeRequestError(`cross-site-fetch sec-fetch-site=${fetchSite}`);
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
