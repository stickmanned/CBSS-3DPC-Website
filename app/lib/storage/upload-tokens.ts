import { z } from "zod";
import {
  assertNotExpired,
  createPrivacyHmac,
  InvalidTokenError,
  randomTokenNonce,
  signHmacToken,
  verifyHmacTokenPayload,
} from "@/app/lib/security/hmac-token";
import {
  MAX_UPLOAD_BYTES,
  sanitizeFilename,
  uploadFormatSchema,
  type UploadFormat,
} from "./upload-policy";

const TOKEN_VERSION = 1 as const;
const INTENT_TTL_SECONDS = 15 * 60;
const VERIFIED_FILE_TTL_SECONDS = 30 * 60;

const keySchema = z
  .string()
  .min(20)
  .max(220)
  .regex(/^uploads\/(?:temp|final)\/[A-Za-z0-9_-]+\.(?:stl|3mf)$/);

const baseSchema = z.object({
  v: z.literal(TOKEN_VERSION),
  iat: z.number().int().positive(),
  exp: z.number().int().positive(),
  nonce: z.string().min(20).max(100).regex(/^[A-Za-z0-9_-]+$/),
  tempKey: keySchema.refine((value) => value.startsWith("uploads/temp/")),
  finalKey: keySchema.refine((value) => value.startsWith("uploads/final/")),
  name: z.string().min(1).max(120),
  contentType: z.enum(["model/stl", "model/3mf"]),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  format: uploadFormatSchema,
  emailHash: z.string().length(43).regex(/^[A-Za-z0-9_-]+$/),
});

export const uploadIntentPayloadSchema = baseSchema.extend({
  kind: z.literal("upload-intent"),
  etag: z.null(),
});

export const verifiedFilePayloadSchema = baseSchema.extend({
  kind: z.literal("verified-file"),
  etag: z.string().min(1).max(200).regex(/^[A-Za-z0-9/+_=-]+$/),
});

export type UploadIntentPayload = z.infer<typeof uploadIntentPayloadSchema>;
export type VerifiedFilePayload = z.infer<typeof verifiedFilePayloadSchema>;

function nowSeconds(now: number): number {
  return Math.floor(now / 1_000);
}

export function emailBinding(email: string): string {
  return createPrivacyHmac("upload-email", email.trim().toLowerCase());
}

export function createUploadIntent(input: {
  name: string;
  contentType: "model/stl" | "model/3mf";
  size: number;
  format: UploadFormat;
  email: string;
  now?: number;
}): { token: string; payload: UploadIntentPayload } {
  const issuedAt = nowSeconds(input.now ?? Date.now());
  const nonce = randomTokenNonce();
  const finalNonce = randomTokenNonce();
  const payload = uploadIntentPayloadSchema.parse({
    kind: "upload-intent",
    v: TOKEN_VERSION,
    iat: issuedAt,
    exp: issuedAt + INTENT_TTL_SECONDS,
    nonce,
    tempKey: `uploads/temp/${nonce}.${input.format}`,
    finalKey: `uploads/final/${finalNonce}.${input.format}`,
    name: sanitizeFilename(input.name),
    contentType: input.contentType,
    size: input.size,
    format: input.format,
    emailHash: emailBinding(input.email),
    etag: null,
  });
  return { payload, token: signHmacToken(payload) };
}

function parseAndValidate<T>(
  token: string,
  schema: z.ZodType<T>,
  now = Date.now(),
): T {
  try {
    const parsed = schema.parse(verifyHmacTokenPayload(token));
    const timing = parsed as { iat: number; exp: number };
    assertNotExpired(timing.exp, now);
    if (timing.iat > Math.floor(now / 1_000) + 30) throw new InvalidTokenError();
    return parsed;
  } catch (error) {
    if (error instanceof InvalidTokenError) throw error;
    throw new InvalidTokenError();
  }
}

export function verifyUploadIntentToken(
  token: string,
  now = Date.now(),
): UploadIntentPayload {
  return parseAndValidate(token, uploadIntentPayloadSchema, now);
}

export function createVerifiedFileToken(
  intent: UploadIntentPayload,
  etag: string,
  now = Date.now(),
): { token: string; payload: VerifiedFilePayload } {
  const issuedAt = nowSeconds(now);
  const payload = verifiedFilePayloadSchema.parse({
    ...intent,
    kind: "verified-file",
    iat: issuedAt,
    exp: issuedAt + VERIFIED_FILE_TTL_SECONDS,
    etag,
  });
  return { payload, token: signHmacToken(payload) };
}

export function verifyVerifiedFileTokenSignature(
  token: string,
  now = Date.now(),
): VerifiedFilePayload {
  return parseAndValidate(token, verifiedFilePayloadSchema, now);
}
