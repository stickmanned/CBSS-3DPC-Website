const STATUS_REF_PATTERN = /^CBSS-[0-9]{4}$/;

export const STATUS_SESSION_SECONDS = 8 * 60 * 60;

export function normalizeStatusRef(ref: string): string {
  const normalized = ref.trim().toUpperCase();
  if (!STATUS_REF_PATTERN.test(normalized)) throw new Error("Invalid request reference.");
  return normalized;
}

export function statusCookieName(ref: string): string {
  return `cbss_status_${normalizeStatusRef(ref).toLowerCase().replace("-", "_")}`;
}

export function statusRoutePath(ref: string): string {
  return `/status/${encodeURIComponent(normalizeStatusRef(ref))}`;
}

/** The fragment is not included in HTTP requests, referrers, or platform paths. */
export function privateStatusUrl(origin: string, ref: string, token: string): string {
  const safeOrigin = new URL(origin).origin;
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) throw new Error("Invalid status token.");
  return `${safeOrigin}${statusRoutePath(ref)}#${encodeURIComponent(token)}`;
}
