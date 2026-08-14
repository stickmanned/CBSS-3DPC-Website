import { isIP } from "node:net";
import { NextResponse } from "next/server";

export class UnsafeRequestError extends Error {
  constructor() {
    super("The request could not be accepted.");
    this.name = "UnsafeRequestError";
  }
}

function configuredOrigin(): string | null {
  const raw = process.env.APP_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) {
    if (process.env.NODE_ENV === "production") throw new UnsafeRequestError();
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
      throw new UnsafeRequestError();
    }
    return url.origin;
  } catch {
    throw new UnsafeRequestError();
  }
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) throw new UnsafeRequestError();

  let suppliedOrigin: string;
  let requestOrigin: string;
  try {
    suppliedOrigin = new URL(origin).origin;
    requestOrigin = new URL(request.url).origin;
  } catch {
    throw new UnsafeRequestError();
  }

  const expected = configuredOrigin() ?? requestOrigin;
  if (suppliedOrigin !== expected || suppliedOrigin !== requestOrigin) {
    throw new UnsafeRequestError();
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    throw new UnsafeRequestError();
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

export function genericError(status: 400 | 403 | 404 | 409 | 413 | 429 | 503) {
  const response = NextResponse.json(
    { error: status === 429 ? "Too many requests. Try again later." : "Request could not be processed." },
    { status },
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
