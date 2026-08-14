import "server-only";

import { Resend } from "resend";

export type QueueEmail = {
  to: string | readonly string[];
  subject: string;
  body: string;
  idempotencyKey: string;
  tags?: Readonly<Record<string, string>>;
};

export type EmailDeliveryResult =
  | { ok: true; providerId: string }
  | {
      ok: false;
      certainty: "definitive";
      reason: "not_configured" | "provider_rejected";
    }
  | {
      ok: false;
      certainty: "uncertain";
      reason: "provider_uncertain";
    };

type EmailConfiguration = {
  apiKey: string;
  from: string;
  replyTo?: string;
};

function emailConfiguration(): EmailConfiguration | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.QUEUE_EMAIL_FROM?.trim();
  const replyTo = process.env.QUEUE_EMAIL_REPLY_TO?.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from, replyTo: replyTo || undefined };
}

export function isEmailConfigured(): boolean {
  return emailConfiguration() !== null;
}

export function clubNotificationAddress(): string | null {
  return process.env.QUEUE_NOTIFICATION_EMAIL?.trim() || null;
}

export async function deliverQueueEmail(message: QueueEmail): Promise<EmailDeliveryResult> {
  const configuration = emailConfiguration();
  if (!configuration) {
    return { ok: false, certainty: "definitive", reason: "not_configured" };
  }

  const tags = Object.entries(message.tags ?? {}).map(([name, value]) => ({ name, value }));

  try {
    const response = await new Resend(configuration.apiKey).emails.send(
      {
        from: configuration.from,
        to: [...(typeof message.to === "string" ? [message.to] : message.to)],
        subject: message.subject,
        text: message.body,
        replyTo: configuration.replyTo,
        tags,
      },
      { idempotencyKey: message.idempotencyKey },
    );

    if (response.error) {
      return { ok: false, certainty: "definitive", reason: "provider_rejected" };
    }
    if (!response.data?.id) {
      return { ok: false, certainty: "uncertain", reason: "provider_uncertain" };
    }
    return { ok: true, providerId: response.data.id };
  } catch {
    // A timeout or dropped response does not prove that the provider rejected
    // the request. The outbox must hold this for review, never blindly resend.
    return { ok: false, certainty: "uncertain", reason: "provider_uncertain" };
  }
}
