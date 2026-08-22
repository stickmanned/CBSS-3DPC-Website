"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { configuredSiteOrigin, getQueueSecrets, QueueConfigurationError } from "@/app/lib/config/queue";
import { dispatchEventRecipient } from "@/app/lib/email/outbox";
import { FILAMENT_COLORS } from "@/app/lib/filament-colors";
import {
  InvalidQueueTokenError,
  QueueConflictError,
} from "@/app/lib/queue/errors";
import { consumeRawRateLimit } from "@/app/lib/queue/rate-limit";
import { createQueueRepository } from "@/app/lib/queue/repository";
import { submissionSchema, uploadMetadataSchema } from "@/app/lib/queue/schemas";
import { QueueService } from "@/app/lib/queue/service";
import { privateStatusUrl } from "@/app/lib/queue/status-access";
import {
  InvalidTokenError,
  TokenConfigurationError,
} from "@/app/lib/security/hmac-token";
import {
  clientIp,
  logRequestFailure,
  requireSameOrigin,
  UnsafeRequestError,
} from "@/app/lib/security/request-security";
import {
  TurnstileConfigurationError,
  TurnstileVerificationError,
  verifyTurnstile,
} from "@/app/lib/security/turnstile";
import { verifyVerifiedFileToken } from "@/app/lib/storage/upload-lifecycle";
import {
  StorageConfigurationError,
  StorageVerificationError,
} from "@/app/lib/storage/r2";

const SUBMISSION_IP_LIMIT = process.env.NODE_ENV !== "production" ? 500 : 60;
const SUBMISSION_EMAIL_LIMIT = process.env.NODE_ENV !== "production" ? 250 : 30;
const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;
const MIN_FILL_MS = 1_500;
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1_000;

export type SubmitPrintRequestResult = {
  ok: boolean;
  fieldErrors?: Record<string, string | string[]>;
  formError?: string;
  statusUrl?: string;
  ref?: string;
  emailSent?: boolean;
  emailState?: "sent" | "failed" | "uncertain";
};

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function requestFromHeaders(headerList: Headers): Request {
  const suppliedOrigin = headerList.get("origin");
  const forwardedHost = headerList.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  const host = forwardedHost || headerList.get("host")?.trim();
  if (!suppliedOrigin || !host) throw new UnsafeRequestError();

  let suppliedUrl: URL;
  try {
    suppliedUrl = new URL(suppliedOrigin);
  } catch {
    throw new UnsafeRequestError();
  }
  const protocol =
    headerList.get("x-forwarded-proto")?.split(",", 1)[0]?.trim() ||
    suppliedUrl.protocol.replace(":", "");
  if (protocol !== "http" && protocol !== "https") throw new UnsafeRequestError();

  return new Request(`${protocol}://${host}/request`, { headers: headerList });
}

function assertHumanSubmission(formData: FormData) {
  if (formString(formData, "website").trim()) throw new UnsafeRequestError();
  const startedAt = Number(formString(formData, "formStartedAt"));
  const age = Date.now() - startedAt;
  if (!Number.isSafeInteger(startedAt) || age < MIN_FILL_MS || age > MAX_FORM_AGE_MS) {
    throw new UnsafeRequestError();
  }
}

function parseColorSlugs(value: string): string[] {
  if (value.length > 4_096) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function parseBbox(value: string): [number, number, number] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    const values = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object"
        ? [
            (parsed as Record<string, unknown>).x,
            (parsed as Record<string, unknown>).y,
            (parsed as Record<string, unknown>).z,
          ]
        : [];
    if (
      values.length !== 3 ||
      !values.every(
        (item) => typeof item === "number" && Number.isFinite(item) && item > 0 && item <= 1_000_000,
      )
    ) {
      return null;
    }
    return values as [number, number, number];
  } catch {
    return null;
  }
}

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const flattened = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  return Object.fromEntries(
    Object.entries(flattened)
      .filter((entry): entry is [string, string[]] => Boolean(entry[1]?.length))
      .map(([field, messages]) => [
        field === "colors"
          ? "colorSlugs"
          : field === "fileToken"
            ? "verifiedFileToken"
            : field,
        messages,
      ]),
  );
}

function publicOrigin(request: Request): string {
  return configuredSiteOrigin() ?? new URL(request.url).origin;
}

async function consumeSubmissionIpLimit(ip: string, secret: string) {
  return consumeRawRateLimit({
    scope: "request-submit-ip",
    rawIdentifier: ip,
    hmacSecret: secret,
    limit: SUBMISSION_IP_LIMIT,
    windowSeconds: HOUR_SECONDS,
  });
}

async function consumeSubmissionEmailLimit(email: string, secret: string) {
  return consumeRawRateLimit({
    scope: "request-submit-email",
    rawIdentifier: email,
    hmacSecret: secret,
    limit: SUBMISSION_EMAIL_LIMIT,
    windowSeconds: DAY_SECONDS,
  });
}

export async function submitPrintRequest(formData: FormData): Promise<SubmitPrintRequestResult> {
  try {
    const incomingHeaders = new Headers(await headers());
    const request = requestFromHeaders(incomingHeaders);
    requireSameOrigin(request);
    assertHumanSubmission(formData);

    const verifiedFileToken = formString(formData, "verifiedFileToken").trim();
    const rawInput = {
      requesterName: formString(formData, "requesterName"),
      requesterEmail: formString(formData, "requesterEmail"),
      quantity: formString(formData, "quantity"),
      deadline: formString(formData, "deadline"),
      purpose: formString(formData, "purpose"),
      material: formString(formData, "material"),
      colors: parseColorSlugs(formString(formData, "colorSlugs")),
      modelUrl: formString(formData, "modelUrl"),
      fileToken: verifiedFileToken,
      idempotencyKey: formString(formData, "idempotencyKey"),
    };
    const parsed = submissionSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: fieldErrors(parsed.error),
        formError: "Check the highlighted fields before sending your request.",
      };
    }

    const colorsBySlug = new Map(FILAMENT_COLORS.map((color) => [color.slug, color]));
    const invalidColor = parsed.data.colors.find((slug) => {
      const color = colorsBySlug.get(slug);
      return !color || !color.materials.includes(parsed.data.material.toUpperCase() as "PLA" | "PETG" | "ASA");
    });
    if (invalidColor) {
      return {
        ok: false,
        fieldErrors: { colorSlugs: ["Choose colors available for the selected material."] },
      };
    }

    const secrets = getQueueSecrets();
    const ip = clientIp(request);
    const ipLimit = await consumeSubmissionIpLimit(ip, secrets.identifierHmacSecret);
    if (!ipLimit.allowed) {
      return {
        ok: false,
        formError: "Too many requests were sent recently. Try again later.",
      };
    }

    // A verified file token proves the presign endpoint already completed the
    // configured Turnstile check. Link-only submissions verify it here.
    if (!verifiedFileToken) {
      await verifyTurnstile(formString(formData, "cf-turnstile-response") || undefined, ip);
    }

    let verifiedFile;
    if (verifiedFileToken) {
      const payload = await verifyVerifiedFileToken(
        verifiedFileToken,
        parsed.data.requesterEmail,
      );
      const thumbnail = formString(formData, "thumbnail").trim() || null;
      const bboxMm = parseBbox(formString(formData, "bboxMm"));
      verifiedFile = uploadMetadataSchema.parse({
        storageKey: payload.finalKey,
        originalName: payload.name,
        verifiedByteSize: payload.size,
        fileKind: payload.format,
        thumbnailDataUri: thumbnail,
        bboxMm,
        etag: payload.etag,
      });
    }

    // Only a human-verified or email-bound submission can spend a requester's
    // email quota. Keep this directly in front of the queue mutation.
    const emailLimit = await consumeSubmissionEmailLimit(
      parsed.data.requesterEmail,
      secrets.identifierHmacSecret,
    );
    if (!emailLimit.allowed) {
      return {
        ok: false,
        formError: "Too many requests were sent recently. Try again later.",
      };
    }

    const repository = createQueueRepository();
    const service = new QueueService(repository, secrets);
    const result = await service.submit(parsed.data, {
      submitterIp: ip,
      verifiedFile,
    });

    const origin = publicOrigin(request);
    const statusUrl = privateStatusUrl(
      origin,
      result.request.ref,
      result.requesterToken,
    );
    const requesterDelivery = await dispatchEventRecipient(
      result.event.id,
      "requester",
      origin,
    ).catch(() => null);
    // The club delivery has its own row and never changes the requester result.
    await dispatchEventRecipient(result.event.id, "club", origin).catch(() => null);
    const emailState =
      requesterDelivery?.state === "sent"
        ? "sent"
        : requesterDelivery?.state === "sending" || requesterDelivery?.state === "uncertain"
          ? "uncertain"
          : "failed";

    return {
      ok: true,
      statusUrl,
      ref: result.request.ref,
      emailSent: emailState === "sent",
      emailState,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, fieldErrors: fieldErrors(error) };
    }
    if (
      error instanceof InvalidTokenError ||
      error instanceof InvalidQueueTokenError ||
      error instanceof StorageVerificationError
    ) {
      return {
        ok: false,
        fieldErrors: {
          verifiedFileToken: ["The uploaded model verification expired. Upload the file again."],
        },
      };
    }
    if (error instanceof TurnstileVerificationError) {
      return { ok: false, formError: "Complete the security check and try again." };
    }
    if (error instanceof QueueConflictError) {
      return {
        ok: false,
        formError: "This request changed while it was being saved. Refresh the page and try again.",
      };
    }
    if (error instanceof UnsafeRequestError) {
      return { ok: false, formError: "This request could not be accepted. Refresh and try again." };
    }
    if (
      error instanceof QueueConfigurationError ||
      error instanceof TokenConfigurationError ||
      error instanceof TurnstileConfigurationError ||
      error instanceof StorageConfigurationError
    ) {
      logRequestFailure("request/submit", 503, error);
      return {
        ok: false,
        formError: "The print queue is temporarily unavailable. Your form details are still here.",
      };
    }
    // Anything reaching here is unclassified: without a record of it, a
    // requester's "it just says try again" is unreproducible.
    logRequestFailure("request/submit", 500, error);
    return {
      ok: false,
      formError: "The request could not be saved. Your form details are still here; try again.",
    };
  }
}
