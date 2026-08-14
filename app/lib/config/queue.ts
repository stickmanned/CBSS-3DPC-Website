import "server-only";

import type { QueueSecrets } from "@/app/lib/queue/service";

export class QueueConfigurationError extends Error {
  constructor() {
    super("The print queue is not configured.");
    this.name = "QueueConfigurationError";
  }
}

function strongSecret(value: string | undefined): value is string {
  return Boolean(value && Buffer.byteLength(value, "utf8") >= 32);
}

export function getQueueSecrets(): QueueSecrets {
  const requesterTokenSecret = process.env.REQUESTER_TOKEN_SECRET;
  const identifierHmacSecret =
    process.env.RATE_LIMIT_HMAC_SECRET ?? process.env.QUEUE_IDENTIFIER_HMAC_SECRET;

  if (!strongSecret(requesterTokenSecret) || !strongSecret(identifierHmacSecret)) {
    throw new QueueConfigurationError();
  }
  return { requesterTokenSecret, identifierHmacSecret };
}

export function configuredSiteOrigin(): string | null {
  const raw = process.env.APP_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

