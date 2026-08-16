import { z } from "zod";
import {
  clientIp,
  genericError,
  logRequestFailure,
  readJsonBody,
  requireJsonRequest,
  requireSameOrigin,
  UnsafeRequestError,
} from "@/app/lib/security/request-security";
import {
  acquireUploadCompletionLease,
  consumeUploadCompletionIpLimit,
  RateLimitConfigurationError,
  releaseUploadCompletionLease,
} from "@/app/lib/security/upload-rate-limit";
import {
  InvalidTokenError,
  TokenConfigurationError,
} from "@/app/lib/security/hmac-token";
import {
  CompletionInProgressError,
  completeModelUpload,
} from "@/app/lib/storage/upload-lifecycle";
import {
  StorageConfigurationError,
  StorageVerificationError,
} from "@/app/lib/storage/r2";

const thumbnailSchema = z
  .string()
  .max(512 * 1024)
  .regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
  .nullable()
  .optional();

const completionRequestSchema = z.object({
  intentToken: z.string().min(32).max(16_384),
  thumbnail: thumbnailSchema,
  bboxMm: z
    .object({
      x: z.number().finite().positive().max(1_000_000),
      y: z.number().finite().positive().max(1_000_000),
      z: z.number().finite().positive().max(1_000_000),
    })
    .optional(),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    requireJsonRequest(request);
    const body = completionRequestSchema.parse(
      await readJsonBody(request, 768 * 1024),
    );

    const rateLimit = await consumeUploadCompletionIpLimit(clientIp(request));
    if (!rateLimit.allowed) {
      const response = genericError(429);
      response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
      return response;
    }

    const completed = await completeModelUpload(
      body.intentToken,
      {
        acquire: acquireUploadCompletionLease,
        release: releaseUploadCompletionLease,
      },
    );

    return Response.json(
      {
        verifiedFileToken: completed.token,
        file: {
          ...completed.file,
          ...(body.bboxMm ? { bboxMm: body.bboxMm } : {}),
          thumbnail: body.thumbnail ?? null,
        },
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const cause = { route: "uploads/complete", error };
    if (error instanceof CompletionInProgressError) {
      const response = genericError(409, cause);
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
      return response;
    }
    // A model this endpoint cannot read back is the one failure the requester
    // can actually act on, and the generic wording sent them nowhere. Naming it
    // reveals no more than the checks the browser already runs before upload.
    if (error instanceof StorageVerificationError) {
      logRequestFailure(cause.route, 400, error);
      const response = Response.json(
        {
          error:
            "This model file could not be verified after upload. Re-export it as STL or 3MF and try again, or send the model link instead.",
        },
        { status: 400 },
      );
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
    if (
      error instanceof z.ZodError ||
      error instanceof UnsafeRequestError ||
      error instanceof InvalidTokenError
    ) {
      return genericError(400, cause);
    }
    if (
      error instanceof StorageConfigurationError ||
      error instanceof TokenConfigurationError ||
      error instanceof RateLimitConfigurationError
    ) {
      return genericError(503, cause);
    }
    return genericError(503, cause);
  }
}
