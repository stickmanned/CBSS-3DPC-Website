import EmailLink from "@/app/components/EmailLink";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import AdminEventLog from "@/app/components/admin/AdminEventLog";
import AdminHeader from "@/app/components/admin/AdminHeader";
import AdminModelViewer from "@/app/components/admin/AdminModelViewer";
import { PREVIEW_MAX_BYTES } from "@/app/lib/storage/upload-policy";
import DetailMetadataForm from "@/app/components/admin/DetailMetadataForm";
import TransitionComposer, {
  type EmailPreview,
  type TransitionChoice,
} from "@/app/components/admin/TransitionComposer";
import {
  formatAdminDate,
  statusLabel,
  statusPillClass,
  words,
} from "@/app/components/admin/presentation";
import { getAdminRequestDetail } from "@/app/lib/admin/dashboard";
import { requireAdmin } from "@/app/lib/auth";
import { configuredSiteOrigin } from "@/app/lib/config/queue";
import type { PrintRequest, RequestFile } from "@/app/lib/db/schema";
import { transitionEmail } from "@/app/lib/email/queue-message";
import { FILAMENT_COLORS } from "@/app/lib/filament-colors";
import {
  DECLINED_REASON_KEYS,
  NEEDS_CHANGES_REASON_KEYS,
  PRINT_FAILED_REASON_KEYS,
  REQUEST_TRANSITIONS,
  type RequestStatus,
} from "@/app/lib/queue/domain";

export const dynamic = "force-dynamic";

const EMAIL_STATUSES = new Set<RequestStatus>([
  "approved",
  "needs_changes",
  "declined",
  "printing",
  "ready_for_pickup",
  "print_failed",
]);

function reasonKeys(status: RequestStatus): readonly string[] {
  if (status === "print_failed") return PRINT_FAILED_REASON_KEYS;
  if (status === "needs_changes") return NEEDS_CHANGES_REASON_KEYS;
  if (status === "declined") return DECLINED_REASON_KEYS;
  return [];
}

function previewFor(
  request: PrintRequest,
  file: RequestFile | null,
  status: RequestStatus,
  reasonKey: string | undefined,
  origin: string | null,
): EmailPreview | null {
  if (!origin) return null;
  try {
    const email = transitionEmail(request, file, status, reasonKey, origin);
    return email ? { subject: email.subject, text: email.text } : null;
  } catch {
    return null;
  }
}

function transitionChoices(
  request: PrintRequest,
  file: RequestFile | null,
): TransitionChoice[] {
  const origin = configuredSiteOrigin();
  return REQUEST_TRANSITIONS[request.currentStatus].map((status) => {
    const reasons = reasonKeys(status);
    return {
      status,
      label: statusLabel(status),
      sendsEmail: EMAIL_STATUSES.has(status),
      email: reasons.length ? null : previewFor(request, file, status, undefined, origin),
      reasons: reasons.map((reason) => ({
        key: reason,
        label: words(reason),
        email: previewFor(request, file, status, reason, origin),
      })),
    };
  });
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function dimensionsLabel(bbox: number[] | null): string {
  if (!bbox || bbox.length !== 3) return "Not available";
  return `${bbox.map((value) => Number(value).toFixed(1)).join(" × ")} mm`;
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 border-t border-mist pt-4">
      <dt className="eyebrow text-slate">{label}</dt>
      <dd className="mt-2 break-words text-sm text-ink">{children}</dd>
    </div>
  );
}

export default async function AdminRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    await requireAdmin();
    notFound();
  }

  const result = await getAdminRequestDetail(id);
  if (!result.detail) notFound();
  const { request, file, assigneeName, assigneeLogin } = result.detail;
  const colorBySlug = new Map(FILAMENT_COLORS.map((color) => [color.slug, color]));
  // The requester's filaments, in rank order, for the 3D preview to paint with.
  const orderedColors = request.colors.flatMap((slug) => {
    const color = colorBySlug.get(slug);
    return color
      ? [{ slug: color.slug, name: color.name, hex: color.hex, swatch: color.swatch }]
      : [];
  });
  const choices = transitionChoices(request, file);

  return (
    <div className="min-w-0">
      <section className="build-grid-dark bg-ink px-5 py-9 text-white">
        <div className="mx-auto max-w-6xl">
          <AdminHeader admin={result.admin} backHref="/admin#requests" backLabel="Back to queue" />
          <div className="mt-9 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow text-signal">Print request</p>
              <h1 className="mt-3 text-[clamp(3rem,8vw,5.5rem)]">{request.ref}</h1>
            </div>
            <span
              className={`inline-flex w-fit rounded-full border px-4 py-2 text-sm font-bold ${statusPillClass(request.currentStatus)}`}
            >
              {statusLabel(request.currentStatus)}
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-8 px-5 py-10 sm:py-14">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,.85fr)]">
          <article className="rounded-[20px] border border-mist bg-white p-5 sm:p-6">
            <p className="eyebrow text-slate">Requester and model</p>
            <h2 className="mt-3 text-3xl text-ink">Request details</h2>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <DetailItem label="Requester">
                <span className="font-semibold">{request.requesterName}</span>
                <br />
                <EmailLink
                  address={request.requesterEmail}
                  className="text-navy underline underline-offset-4"
                />
              </DetailItem>
              <DetailItem label="Submitted">{formatAdminDate(request.createdAt, true)}</DetailItem>
              <DetailItem label="Material">{request.material.toUpperCase()}</DetailItem>
              <DetailItem label="Quantity">{request.quantity}</DetailItem>
              <DetailItem label="Preferred deadline">
                {request.deadline ? formatAdminDate(`${request.deadline}T12:00:00-07:00`) : "None"}
              </DetailItem>
              <DetailItem label="Assigned to">
                {assigneeName || assigneeLogin || "Unassigned"}
              </DetailItem>
              <DetailItem label="Browser-estimated dimensions">
                {dimensionsLabel(file?.bboxMm ?? null)}
                {file?.bboxMm ? (
                  <span className="mt-1 block text-xs text-slate">
                    Verify these untrusted preview measurements in the slicer before printing.
                  </span>
                ) : null}
              </DetailItem>
              <DetailItem label="Model source">
                {request.modelUrl ? (
                  <a
                    href={request.modelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-navy underline underline-offset-4"
                  >
                    Open submitted model link <span aria-hidden="true">↗</span>
                  </a>
                ) : (
                  "Uploaded file only"
                )}
              </DetailItem>
            </dl>

            <div className="mt-6 border-t border-mist pt-5">
              <h3 className="text-lg text-ink">Purpose and notes from requester</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate">
                {request.purpose}
              </p>
            </div>

            <div className="mt-6 border-t border-mist pt-5">
              <h3 className="text-lg text-ink">Ordered color preferences</h3>
              {request.colors.length ? (
                <ol className="mt-3 flex flex-wrap gap-3">
                  {request.colors.map((slug, index) => {
                    const color = colorBySlug.get(slug);
                    return (
                      <li key={`${slug}-${index}`} className="flex items-center gap-2 rounded-full border border-mist bg-cloud py-1.5 pl-1.5 pr-3 text-sm text-ink">
                        <span className="grid size-7 place-items-center rounded-full bg-ink font-mono text-[10px] font-bold text-white">
                          {index + 1}
                        </span>
                        <span
                          className="size-5 rounded-full border border-ink/20"
                          style={{ background: color?.swatch ?? color?.hex ?? "#e1e8f3" }}
                          aria-hidden="true"
                        />
                        <span>{color?.name ?? slug}</span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="mt-3 text-sm text-slate">No color preference; club choice.</p>
              )}
            </div>
          </article>

          <aside className="space-y-6">
            <section className="overflow-hidden rounded-[20px] border border-mist bg-white">
              {file && !file.purgedAt ? (
                <AdminModelViewer
                  src={`/api/admin/files/${file.id}/model`}
                  fileName={file.originalName}
                  fileKind={file.fileKind}
                  byteSize={file.verifiedByteSize}
                  previewMaxBytes={PREVIEW_MAX_BYTES}
                  colors={orderedColors}
                />
              ) : (
                <div className="grid aspect-[4/3] place-items-center bg-cloud p-5">
                  {file?.thumbnailDataUri ? (
                    // A purged file has no bytes left to render, but the
                    // requester's thumbnail survives as a record of what it was.
                    <Image
                      src={file.thumbnailDataUri}
                      alt={`Requester's thumbnail for ${request.ref}`}
                      width={720}
                      height={540}
                      unoptimized
                      className="max-h-full w-auto object-contain"
                    />
                  ) : (
                    <div className="text-center text-slate">
                      <span className="font-mono text-4xl" aria-hidden="true">◇</span>
                      <p className="mt-3 text-sm">No model file on this request</p>
                    </div>
                  )}
                </div>
              )}
              {/* The requester's own capture. It is re-taken whenever they repaint,
                  so it is the only record of a per-part arrangement — that mapping
                  is not submitted with the request. */}
              {file && !file.purgedAt && file.thumbnailDataUri && (
                <figure className="border-t border-mist p-5">
                  <figcaption className="text-xs text-slate">
                    As the requester arranged it
                  </figcaption>
                  <Image
                    src={file.thumbnailDataUri}
                    alt={`Requester's arrangement for ${request.ref}`}
                    width={720}
                    height={540}
                    unoptimized
                    className="mt-2 w-full rounded-[var(--radius-card)] border border-mist"
                  />
                </figure>
              )}
              <div className="p-5">
                <h2 className="text-xl text-ink">Private model file</h2>
                {file ? (
                  <>
                    <p className="mt-2 break-all text-sm text-slate">
                      {file.originalName} · {file.fileKind.toUpperCase()} · {fileSize(file.verifiedByteSize)}
                    </p>
                    {file.purgedAt ? (
                      <p className="mt-4 rounded-xl bg-cloud px-4 py-3 text-sm text-slate">
                        The retained file was purged {formatAdminDate(file.purgedAt)}.
                      </p>
                    ) : (
                      <>
                        <Link
                          href={`/api/admin/files/${file.id}`}
                          prefetch={false}
                          className="btn btn--dark mt-5 w-full whitespace-nowrap"
                        >
                          Download for slicing
                        </Link>
                        <p className="mt-3 text-xs text-slate">
                          Downloads straight from storage through a signed link that expires
                          shortly after it is issued.
                        </p>
                      </>
                    )}
                  </>
                ) : (
                  <p className="mt-2 text-sm text-slate">This request was submitted with a model link only.</p>
                )}
              </div>
            </section>
          </aside>
        </section>

        <TransitionComposer
          requestId={request.id}
          expectedVersion={request.version}
          choices={choices}
        />

        <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
          <DetailMetadataForm
            requestId={request.id}
            expectedVersion={request.version}
            notes={request.adminNotes}
            assigneeId={request.assigneeId}
            admins={result.admins.map((admin) => ({
              id: admin.id,
              label: admin.displayName?.trim() || admin.githubLogin,
            }))}
          />
          <AdminEventLog events={result.events} />
        </div>
      </div>
    </div>
  );
}
