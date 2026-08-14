"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/app/lib/auth";
import { getQueueSecrets } from "@/app/lib/config/queue";
import { getDatabase } from "@/app/lib/db";
import {
  adminUser,
  printRequest,
} from "@/app/lib/db/schema";
import {
  dispatchEventRecipient,
  supersedeOlderRequesterDeliveries,
} from "@/app/lib/email/outbox";
import {
  REQUEST_STATUSES,
  type RequestStatus,
} from "@/app/lib/queue/domain";
import {
  IllegalQueueTransitionError,
  QueueConflictError,
  QueueNotFoundError,
} from "@/app/lib/queue/errors";
import { createQueueRepository } from "@/app/lib/queue/repository";
import { QueueService } from "@/app/lib/queue/service";

export type AdminActionState = {
  tone: "idle" | "success" | "warning" | "error";
  message: string;
};

const UUID = z.string().uuid();
const EMAIL_STATUSES = new Set<RequestStatus>([
  "approved",
  "needs_changes",
  "declined",
  "printing",
  "ready_for_pickup",
  "print_failed",
]);

function value(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw : "";
}

function safeActionError(error: unknown): AdminActionState {
  if (error instanceof QueueConflictError) {
    return {
      tone: "warning",
      message: "This request changed in another tab. Refresh and try the update again.",
    };
  }
  if (error instanceof IllegalQueueTransitionError) {
    return {
      tone: "warning",
      message: "That status change is no longer available. Refresh to see the current queue.",
    };
  }
  if (error instanceof QueueNotFoundError) {
    return { tone: "error", message: "That request could not be found." };
  }
  if (error instanceof z.ZodError) {
    return { tone: "error", message: "Check the highlighted choices and try again." };
  }
  return {
    tone: "error",
    message: "The update could not be saved. No additional changes were made.",
  };
}

type EmailAttempt = "not_needed" | "sent" | "failed" | "uncertain";

async function sendRequesterTransitionEmail(
  requestId: string,
  eventId: number,
  status: RequestStatus,
): Promise<EmailAttempt> {
  if (!EMAIL_STATUSES.has(status)) return "not_needed";

  try {
    await supersedeOlderRequesterDeliveries(requestId, eventId);
    const delivered = await dispatchEventRecipient(eventId, "requester");
    if (!delivered) return "uncertain";
    if (delivered.state === "sent") return "sent";
    if (delivered.state === "sending" || delivered.state === "uncertain") {
      return "uncertain";
    }
    return "failed";
  } catch {
    return "uncertain";
  }
}

export async function transitionRequestAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();

  try {
    const service = new QueueService(createQueueRepository(), getQueueSecrets());
    const reasonKey = value(formData, "reasonKey").trim() || undefined;
    const result = await service.transition(
      {
        requestId: value(formData, "requestId"),
        expectedVersion: value(formData, "expectedVersion"),
        toStatus: value(formData, "toStatus"),
        reasonKey,
        requesterVisibleNote: value(formData, "requesterVisibleNote"),
      },
      `admin:${admin.githubLogin}`,
    );

    const email = await sendRequesterTransitionEmail(
      result.request.id,
      result.event.id,
      result.request.currentStatus,
    );

    revalidatePath("/admin");
    revalidatePath(`/admin/requests/${result.request.id}`);

    if (email === "failed") {
      return {
        tone: "warning",
        message:
          "Status saved. The requester email was not sent and is queued for a safe retry; their private status page is up to date.",
      };
    }
    if (email === "uncertain") {
      return {
        tone: "warning",
        message:
          "Status saved. Email delivery needs administrator review and will not retry automatically; the private status page is up to date.",
      };
    }
    if (email === "sent") {
      return { tone: "success", message: "Status saved and the requester email was sent." };
    }
    return { tone: "success", message: "Status saved. This step does not send an email." };
  } catch (error) {
    return safeActionError(error);
  }
}

const rowSelectionSchema = z.object({
  requestId: UUID,
  expectedVersion: z.coerce.number().int().nonnegative(),
});

function parseRowSelection(raw: string) {
  const separator = raw.lastIndexOf(":");
  if (separator < 0) return null;
  const parsed = rowSelectionSchema.safeParse({
    requestId: raw.slice(0, separator),
    expectedVersion: raw.slice(separator + 1),
  });
  return parsed.success ? parsed.data : null;
}

export async function bulkTransitionAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const selected = formData
    .getAll("requests")
    .filter((item): item is string => typeof item === "string");

  if (!selected.length) {
    return { tone: "error", message: "Choose at least one request to update." };
  }
  if (selected.length > 50) {
    return { tone: "error", message: "Update no more than 50 requests at once." };
  }

  const target = z.enum(REQUEST_STATUSES).safeParse(value(formData, "toStatus"));
  if (!target.success) {
    return { tone: "error", message: "Choose a valid new status." };
  }

  let service: QueueService;
  try {
    service = new QueueService(createQueueRepository(), getQueueSecrets());
  } catch {
    return {
      tone: "error",
      message: "Queue updates are unavailable until the site configuration is complete.",
    };
  }

  const reasonKey = value(formData, "reasonKey").trim() || undefined;
  const requesterVisibleNote = value(formData, "requesterVisibleNote");
  const seen = new Set<string>();
  let updated = 0;
  let skipped = 0;
  let emailFailures = 0;
  let emailUncertain = 0;

  for (const raw of selected) {
    const row = parseRowSelection(raw);
    if (!row || seen.has(row.requestId)) {
      skipped += 1;
      continue;
    }
    seen.add(row.requestId);

    try {
      const result = await service.transition(
        {
          ...row,
          toStatus: target.data,
          reasonKey,
          requesterVisibleNote,
        },
        `admin:${admin.githubLogin}`,
      );
      updated += 1;
      const email = await sendRequesterTransitionEmail(
        result.request.id,
        result.event.id,
        target.data,
      );
      if (email === "failed") emailFailures += 1;
      if (email === "uncertain") emailUncertain += 1;
      revalidatePath(`/admin/requests/${result.request.id}`);
    } catch {
      // Illegal transitions, stale versions, and invalid rows are reported as
      // skipped without exposing request data or interrupting the remaining rows.
      skipped += 1;
    }
  }

  revalidatePath("/admin");
  const pieces = [`Updated ${updated}.`, `Skipped ${skipped}.`];
  if (emailFailures) pieces.push(`Requester email failed for ${emailFailures}.`);
  if (emailUncertain) pieces.push(`Email delivery needs review for ${emailUncertain}.`);

  return {
    tone: updated ? (skipped || emailFailures || emailUncertain ? "warning" : "success") : "error",
    message: pieces.join(" "),
  };
}

const metadataSchema = z.object({
  requestId: UUID,
  expectedVersion: z.coerce.number().int().nonnegative(),
  adminNotes: z
    .string()
    .trim()
    .max(10_000)
    .transform((notes) => notes || null),
  assigneeId: z.preprocess(
    (input) => (typeof input === "string" && input.trim() === "" ? null : input),
    z.string().uuid().nullable(),
  ),
});

export async function updateRequestMetadataAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();

  const parsed = metadataSchema.safeParse({
    requestId: value(formData, "requestId"),
    expectedVersion: value(formData, "expectedVersion"),
    adminNotes: value(formData, "adminNotes"),
    assigneeId: value(formData, "assigneeId"),
  });
  if (!parsed.success) {
    return { tone: "error", message: "Check the notes and assignee, then try again." };
  }

  try {
    const database = getDatabase();
    if (parsed.data.assigneeId) {
      const [activeAssignee] = await database
        .select({ id: adminUser.id })
        .from(adminUser)
        .where(
          and(
            eq(adminUser.id, parsed.data.assigneeId),
            eq(adminUser.active, true),
          ),
        )
        .limit(1);
      if (!activeAssignee) {
        return { tone: "error", message: "Choose an active club administrator." };
      }
    }

    const [updated] = await database
      .update(printRequest)
      .set({
        adminNotes: parsed.data.adminNotes,
        assigneeId: parsed.data.assigneeId,
        updatedAt: new Date(),
        version: sql`${printRequest.version} + 1`,
      })
      .where(
        and(
          eq(printRequest.id, parsed.data.requestId),
          eq(printRequest.version, parsed.data.expectedVersion),
        ),
      )
      .returning({ id: printRequest.id });

    if (!updated) {
      return {
        tone: "warning",
        message: "This request changed in another tab. Refresh before saving again.",
      };
    }

    revalidatePath("/admin");
    revalidatePath(`/admin/requests/${updated.id}`);
    return { tone: "success", message: "Assignment and private notes saved." };
  } catch {
    return { tone: "error", message: "The assignment and notes could not be saved." };
  }
}
