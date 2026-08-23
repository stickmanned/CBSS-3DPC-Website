import { getR2Connection, r2Endpoint } from "./r2";

/**
 * Whether the bucket will accept a browser upload from this site.
 *
 * Uploads go straight from the browser to R2, so the bucket's CORS policy is
 * the one gate in the whole path that the app cannot see. When the policy did
 * not list the real domain, the browser refused the PUT before it left, XHR
 * reported the failure with no status and no body — the browser deliberately
 * hides the reason from the page — and the requester was told "The upload lost
 * its connection. Try again." That message sent everyone chasing a network
 * problem for four sessions. It was a domain allowlist naming the preview URL
 * and not the production one, for the fourth time.
 *
 * The server can ask the exact question the browser asks. R2 decides the
 * preflight purely from the Origin header, so a probe from here predicts the
 * browser's outcome faithfully, and one cached answer per origin costs nothing.
 *
 * It never blocks an upload. A probe that cannot complete returns "unknown" and
 * the upload proceeds as before: this exists to explain a failure, and a check
 * that could itself refuse traffic would be repeating the mistake it was
 * written to catch.
 */
export type UploadOriginVerdict = "allowed" | "refused" | "unknown";

/** Kept in step with the headers presignModelUpload actually sends. */
export const UPLOAD_PREFLIGHT_HEADERS = [
  "content-type",
  "x-amz-meta-upload-nonce",
  "x-amz-meta-declared-size",
  "x-amz-meta-file-format",
] as const;

const SETTLED_TTL_MS = 5 * 60 * 1000;
// A probe that failed is not evidence about the policy, so re-ask sooner.
const UNKNOWN_TTL_MS = 30 * 1000;
const PROBE_TIMEOUT_MS = 4_000;

let cache: { origin: string; verdict: UploadOriginVerdict; at: number } | undefined;

export function resetUploadCorsCacheForTests(): void {
  cache = undefined;
}

export async function bucketAcceptsUploadsFrom(
  origin: string,
  now = Date.now(),
): Promise<UploadOriginVerdict> {
  if (cache && cache.origin === origin) {
    const ttl = cache.verdict === "unknown" ? UNKNOWN_TTL_MS : SETTLED_TTL_MS;
    if (now - cache.at < ttl) return cache.verdict;
  }

  let verdict: UploadOriginVerdict = "unknown";
  try {
    const { bucket } = getR2Connection();
    const response = await fetch(`${r2Endpoint()}/${bucket}/uploads/temp/.cors-probe`, {
      method: "OPTIONS",
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: {
        origin,
        "access-control-request-method": "PUT",
        "access-control-request-headers": UPLOAD_PREFLIGHT_HEADERS.join(","),
      },
    });
    verdict = response.headers.get("access-control-allow-origin") ? "allowed" : "refused";
  } catch {
    verdict = "unknown";
  }

  cache = { origin, verdict, at: now };
  return verdict;
}
