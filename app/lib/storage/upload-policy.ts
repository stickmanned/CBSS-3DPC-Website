import path from "node:path";
import { z } from "zod";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MIN_FORM_FILL_MS = 1_500;
export const MAX_FORM_AGE_MS = 2 * 60 * 60 * 1_000;

export const uploadFormatSchema = z.enum(["stl", "3mf"]);
export type UploadFormat = z.infer<typeof uploadFormatSchema>;

const acceptedClaimedTypes: Record<UploadFormat, ReadonlySet<string>> = {
  stl: new Set([
    "",
    "application/octet-stream",
    "application/sla",
    "application/vnd.ms-pki.stl",
    "model/stl",
  ]),
  "3mf": new Set([
    "",
    "application/octet-stream",
    "application/zip",
    "application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
    "model/3mf",
  ]),
};

const canonicalTypes: Record<UploadFormat, string> = {
  stl: "model/stl",
  "3mf": "model/3mf",
};

export const presignRequestSchema = z.object({
  name: z.string().trim().min(1).max(255),
  type: z.string().trim().toLowerCase().max(100).default(""),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  email: z.string().trim().toLowerCase().email().max(254),
  website: z.string().max(500).optional().default(""),
  formStartedAt: z.number().int().positive(),
  turnstileToken: z.string().max(4_096).optional(),
});

export type PresignRequest = z.infer<typeof presignRequestSchema>;

export class UploadPolicyError extends Error {
  constructor() {
    super("The selected file cannot be uploaded.");
    this.name = "UploadPolicyError";
  }
}

export function sanitizeFilename(input: string): string {
  const basename = path.basename(input.replaceAll("\\", "/"));
  const normalized = basename
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim();

  if (!normalized) throw new UploadPolicyError();

  const extension = path.extname(normalized).toLowerCase();
  const stem = normalized.slice(0, Math.max(0, normalized.length - extension.length));
  const maxStemLength = Math.max(1, 120 - extension.length);
  return `${stem.slice(0, maxStemLength).replace(/[ .]+$/g, "") || "model"}${extension}`;
}

export function formatFromFilename(filename: string): UploadFormat {
  const extension = path.extname(filename).toLowerCase();
  if (extension === ".stl") return "stl";
  if (extension === ".3mf") return "3mf";
  throw new UploadPolicyError();
}

export function canonicalContentType(
  format: UploadFormat,
  claimedType: string,
): string {
  const normalized = claimedType.trim().toLowerCase();
  if (!acceptedClaimedTypes[format].has(normalized)) throw new UploadPolicyError();
  return canonicalTypes[format];
}

export function assertHumanTiming(
  website: string,
  formStartedAt: number,
  now = Date.now(),
): void {
  if (website.trim()) throw new UploadPolicyError();

  const age = now - formStartedAt;
  if (
    !Number.isSafeInteger(formStartedAt) ||
    age < MIN_FORM_FILL_MS ||
    age > MAX_FORM_AGE_MS
  ) {
    throw new UploadPolicyError();
  }
}

export function normalizeEtag(etag: string | undefined): string {
  const normalized = etag?.trim().replace(/^"|"$/g, "");
  if (!normalized || normalized.length > 200 || !/^[A-Za-z0-9/+_=-]+$/.test(normalized)) {
    throw new UploadPolicyError();
  }
  return normalized;
}

export function downloadContentDisposition(filename: string): string {
  const safe = sanitizeFilename(filename);
  const ascii = safe.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}
