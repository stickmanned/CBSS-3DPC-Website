import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import StatusTimeline, {
  STATUS_PRESENTATION,
  type PublicStatusEvent,
} from "@/app/components/StatusTimeline";
import { getQueueSecrets } from "@/app/lib/config/queue";
import { getDatabase, requestEvent } from "@/app/lib/db";
import { FILAMENT_COLORS } from "@/app/lib/filament-colors";
import { createQueueRepository } from "@/app/lib/queue/repository";
import { QueueService } from "@/app/lib/queue/service";
import { statusCookieName } from "@/app/lib/queue/status-access";
import { asc, eq } from "drizzle-orm";
import StatusAccessBootstrap from "./StatusAccessBootstrap";

const paramsSchema = z.object({
  ref: z.string().regex(/^CBSS-[0-9]{4}$/i),
});

export const metadata: Metadata = {
  title: "Private Print Status",
  robots: { index: false, follow: false, nocache: true },
};

export const runtime = "nodejs";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeZone: "America/Vancouver",
  }).format(value);
}

export default async function PrivateStatusPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  await connection();
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) notFound();

  const ref = parsed.data.ref.toUpperCase();
  const token = (await cookies()).get(statusCookieName(ref))?.value;
  if (!token) return <StatusAccessBootstrap requestRef={ref} />;

  const repository = createQueueRepository();
  const service = new QueueService(repository, getQueueSecrets());
  const request = await service.findForRequester(ref, token);
  if (!request) return <StatusAccessBootstrap requestRef={ref} />;

  const events = (await getDatabase()
    .select({
      id: requestEvent.id,
      fromStatus: requestEvent.fromStatus,
      toStatus: requestEvent.toStatus,
      reasonKey: requestEvent.reasonKey,
      requesterVisibleNote: requestEvent.requesterVisibleNote,
      createdAt: requestEvent.createdAt,
    })
    .from(requestEvent)
    .where(eq(requestEvent.requestId, request.id))
    .orderBy(asc(requestEvent.createdAt), asc(requestEvent.id))) as PublicStatusEvent[];

  const current = STATUS_PRESENTATION[request.currentStatus];
  const colorsBySlug = new Map(FILAMENT_COLORS.map((color) => [color.slug, color]));
  const colors = request.colors.map((slug) => colorsBySlug.get(slug)).filter(Boolean);
  const ready = request.currentStatus === "ready_for_pickup";

  return (
    <section className="build-grid bg-cloud px-5 py-16 md:py-24">
      <div className="mx-auto max-w-4xl">
        <header className="rounded-[var(--radius-card)] bg-navy p-7 text-white shadow-xl sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="eyebrow text-signal">Private request · {request.ref}</p>
            <span className="rounded-full bg-signal px-4 py-2 font-display text-sm font-bold text-ink">
              {current.label}
            </span>
          </div>
          <h1 className="mt-7 max-w-[16ch] text-4xl text-white sm:text-6xl">
            {current.description}
          </h1>
          <p className="mt-6 max-w-[60ch] text-white/75">
            Submitted {formatDate(request.createdAt)}. Keep this page private; anyone with its link can see this request.
          </p>
          {ready && (
            <p className="mt-6 rounded-xl border border-white/20 bg-white/10 px-5 py-4 text-sm text-white">
              Pickup is in Room 113 (Drafting), Tuesdays from 3:30–4:30 PM. Reply to the club email if another time is needed.
            </p>
          )}
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <aside className="rounded-[var(--radius-card)] border border-mist bg-white p-6 shadow-sm sm:p-8">
            <p className="eyebrow text-slate">Request summary</p>
            {request.thumbnailDataUri && (
              <Image
                src={request.thumbnailDataUri}
                alt={`Browser preview of ${request.fileName ?? "the submitted model"}`}
                width={640}
                height={480}
                unoptimized
                className="mt-5 aspect-[4/3] w-full rounded-xl border border-mist bg-cloud object-contain"
              />
            )}
            <dl className="mt-5 grid gap-4 text-sm">
              <div>
                <dt className="eyebrow text-slate">Material</dt>
                <dd className="mt-1 font-display text-lg font-bold uppercase text-ink">
                  {request.material}
                </dd>
              </div>
              <div>
                <dt className="eyebrow text-slate">Colors</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {colors.length ? (
                    colors.map((color) =>
                      color ? (
                        <span
                          key={color.slug}
                          className="inline-flex items-center gap-2 rounded-full border border-mist bg-cloud px-3 py-2 font-semibold text-ink"
                        >
                          <span
                            className="size-4 rounded-full border border-ink/20"
                            style={{ background: color.swatch ?? color.hex }}
                            aria-hidden="true"
                          />
                          {color.name}
                        </span>
                      ) : null,
                    )
                  ) : (
                    <span className="text-slate">Club&apos;s choice</span>
                  )}
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="eyebrow text-slate">Copies</dt>
                  <dd className="mt-1 font-mono text-lg font-bold text-ink">{request.quantity}</dd>
                </div>
                {request.deadline && (
                  <div>
                    <dt className="eyebrow text-slate">Requested date</dt>
                    <dd className="mt-1 font-mono text-sm font-bold text-ink">{request.deadline}</dd>
                  </div>
                )}
              </div>
              {request.fileName && (
                <div>
                  <dt className="eyebrow text-slate">File</dt>
                  <dd className="mt-1 break-words font-mono text-xs font-semibold text-ink">
                    {request.fileName}
                  </dd>
                </div>
              )}
              {request.modelUrl && (
                <div>
                  <dt className="eyebrow text-slate">Model link</dt>
                  <dd className="mt-1">
                    <a
                      href={request.modelUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-link break-all text-sm"
                    >
                      Open model source <span aria-hidden="true">↗</span>
                    </a>
                  </dd>
                </div>
              )}
              <div>
                <dt className="eyebrow text-slate">What it&apos;s for</dt>
                <dd className="mt-2 whitespace-pre-wrap text-slate">{request.purpose}</dd>
              </div>
            </dl>
          </aside>

          <div className="rounded-[var(--radius-card)] border border-mist bg-white p-6 shadow-sm sm:p-8">
            <p className="eyebrow text-slate">Latest first</p>
            <h2 className="mt-3 text-3xl text-ink sm:text-4xl">Request history</h2>
            <StatusTimeline events={events} />
          </div>
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 text-sm text-slate">
          <p>Model files are deleted 90 days after pickup; the queue history is retained.</p>
          <Link href="/request" className="text-link">
            Start another request <span aria-hidden="true">→</span>
          </Link>
        </footer>
      </div>
    </section>
  );
}
