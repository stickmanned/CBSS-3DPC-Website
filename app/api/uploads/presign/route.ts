import { z } from "zod";
import {
  clientIp,
  genericError,
  readJsonBody,
  requireJsonRequest,
  requireSameOrigin,
  UnsafeRequestError,
} from "@/app/lib/security/request-security";
import {
  consumeUploadPresignEmailLimit,
  consumeUploadPresignIpLimit,
  RateLimitConfigurationError,
} from "@/app/lib/security/upload-rate-limit";
import {
  TurnstileConfigurationError,
  TurnstileVerificationError,
  verifyTurnstile,
} from "@/app/lib/security/turnstile";
import { TokenConfigurationError } from "@/app/lib/security/hmac-token";
import { StorageConfigurationError } from "@/app/lib/storage/r2";
import { presignModelUpload } from "@/app/lib/storage/upload-lifecycle";
import {
  assertHumanTiming,
  canonicalContentType,
  formatFromFilename,
  presignRequestSchema,
  sanitizeFilename,
  UploadPolicyError,
} from "@/app/lib/storage/upload-policy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    requireJsonRequest(request);
    const parsed = presignRequestSchema.parse(await readJsonBody(request, 32 * 1024));
    assertHumanTiming(parsed.website, parsed.formStartedAt);

    const ip = clientIp(request);
    const ipLimit = await consumeUploadPresignIpLimit(ip);
    if (!ipLimit.allowed) {
      const response = genericError(429);
      response.headers.set("Retry-After", String(ipLimit.retryAfterSeconds));
      return response;
    }

    await verifyTurnstile(parsed.turnstileToken, ip);
    // Do not let bogus challenges consume an arbitrary victim email's daily
    // allowance. The address limiter runs only after human verification.
    const emailLimit = await consumeUploadPresignEmailLimit(parsed.email);
    if (!emailLimit.allowed) {
      const response = genericError(429);
      response.headers.set("Retry-After", String(emailLimit.retryAfterSeconds));
      return response;
    }
    const name = sanitizeFilename(parsed.name);
    const format = formatFromFilename(name);
    const contentType = canonicalContentType(format, parsed.type);
    const result = await presignModelUpload({
      name,
      contentType: contentType as "model/stl" | "model/3mf",
      size: parsed.size,
      format,
      email: parsed.email,
    });

    return Response.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (
      error instanceof z.ZodError ||
      error instanceof UnsafeRequestError ||
      error instanceof UploadPolicyError ||
      error instanceof TurnstileVerificationError
    ) {
      return genericError(400);
    }
    if (
      error instanceof StorageConfigurationError ||
      error instanceof TokenConfigurationError ||
      error instanceof TurnstileConfigurationError ||
      error instanceof RateLimitConfigurationError
    ) {
      return genericError(503);
    }
    return genericError(503);
  }
}
