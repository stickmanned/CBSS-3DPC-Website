import "server-only";

import type { PrintRequest, RequestFile } from "@/app/lib/db/schema";
import {
  firstName,
  modelNameFromFileOrUrl,
  renderApprovedEmail,
  renderDeclinedEmail,
  renderNeedsChangesEmail,
  renderPrintingEmail,
  renderPrintFailedEmail,
  renderReadyForPickupEmail,
  renderUncollectedEmail,
  type EmailTemplate,
  type QueueEmailTokens,
} from "@/app/lib/email-templates";
import { FILAMENT_COLORS } from "@/app/lib/filament-colors";
import {
  isDeclinedReason,
  isNeedsChangesReason,
  isPrintFailedReason,
  type RequestStatus,
} from "@/app/lib/queue/domain";
import { deriveRequesterToken } from "@/app/lib/queue/tokens";
import { getQueueSecrets } from "@/app/lib/config/queue";
import { privateStatusUrl } from "@/app/lib/queue/status-access";

function statusUrl(request: PrintRequest, origin: string) {
  const rawToken = deriveRequesterToken(
    request.idempotencyKey,
    getQueueSecrets().requesterTokenSecret,
  );
  return privateStatusUrl(origin, request.ref, rawToken);
}

export function queueEmailTokens(
  request: PrintRequest,
  file: RequestFile | null,
  origin: string,
): QueueEmailTokens {
  const bySlug = new Map(FILAMENT_COLORS.map((color) => [color.slug, color.name]));
  return {
    first_name: firstName(request.requesterName),
    ref: request.ref,
    model_name: modelNameFromFileOrUrl(file?.originalName ?? null, request.modelUrl),
    material: request.material,
    colors: request.colors.map((slug) => bySlug.get(slug) ?? slug),
    quantity: request.quantity,
    bbox: file?.bboxMm ?? null,
    status_url: statusUrl(request, origin),
  };
}

export function transitionEmail(
  request: PrintRequest,
  file: RequestFile | null,
  toStatus: RequestStatus,
  reasonKey: string | undefined,
  origin: string,
): EmailTemplate | null {
  const tokens = queueEmailTokens(request, file, origin);
  switch (toStatus) {
    case "approved":
      return renderApprovedEmail(tokens);
    case "printing":
      return renderPrintingEmail(tokens);
    case "ready_for_pickup":
      return renderReadyForPickupEmail(tokens);
    case "print_failed":
      return reasonKey && isPrintFailedReason(reasonKey)
        ? renderPrintFailedEmail(tokens, reasonKey)
        : null;
    case "needs_changes":
      return reasonKey && isNeedsChangesReason(reasonKey)
        ? renderNeedsChangesEmail(tokens, reasonKey)
        : null;
    case "declined":
      return reasonKey && isDeclinedReason(reasonKey)
        ? renderDeclinedEmail(tokens, reasonKey)
        : null;
    default:
      return null;
  }
}

export function uncollectedEmail(
  request: PrintRequest,
  file: RequestFile | null,
  origin: string,
): EmailTemplate {
  return renderUncollectedEmail(queueEmailTokens(request, file, origin));
}
