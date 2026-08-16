import Link from "next/link";
import type { ActiveAdmin } from "@/app/lib/auth";
import {
  STALE_AFTER_DAYS,
  type AttentionSummary,
} from "@/app/lib/admin/dashboard";
import { emailDeliveryStateLabel } from "@/app/lib/email/outbox-policy";
import AdminHeader from "./AdminHeader";

/**
 * The page's single loud element. Every count answers "is there something for me
 * right now", so the accent means exactly one thing: non-zero. A zero count stays
 * quiet rather than turning green — there is nothing to celebrate about an empty
 * queue, and three competing accent colours would make the block decorative.
 */
function Count({
  value,
  label,
  note,
  href,
}: {
  value: number;
  label: string;
  note: string;
  href: string;
}) {
  const live = value > 0;
  return (
    <Link
      href={href}
      // One hover signal only: the affordance line changes. No lift, no border
      // shift — a dense operational surface does not need cards that move.
      className="group block min-h-11 border-t border-white/15 pt-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6 sm:first:border-l-0 sm:first:pl-0"
    >
      <span
        className={`tnum block font-mono text-[clamp(2.75rem,7vw,4rem)] font-bold leading-[0.9] tracking-[-0.04em] ${
          live ? "text-signal" : "text-white/35"
        }`}
      >
        {value}
      </span>
      <span className="mt-3 block font-display text-base font-bold text-white">{label}</span>
      <span className="mt-1 block text-sm text-white/60">{note}</span>
      <span className="mt-2 inline-block text-sm text-white/45 underline decoration-white/25 underline-offset-4 transition-colors duration-[var(--dur-hover)] group-hover:text-white group-hover:decoration-white/60">
        {live ? "Show these" : "Nothing waiting"}
      </span>
    </Link>
  );
}

export default function AttentionBand({
  admin,
  attention,
}: {
  admin: ActiveAdmin;
  attention: AttentionSummary;
}) {
  const { deliveryReviewRows, deliveriesNeedingReview } = attention;
  const hidden = deliveriesNeedingReview - deliveryReviewRows.length;

  return (
    <section
      aria-labelledby="attention-title"
      className="rounded-[var(--radius-card)] bg-night px-5 py-7 text-white sm:px-8 sm:py-9"
    >
      <AdminHeader admin={admin} />

      {/* h1/h2 font, weight and tracking come from globals.css — page titles are
          the serif, section headings stay on the sans. Do not restate them here. */}
      <h1 id="attention-title" className="mt-8 text-4xl">
        What needs you
      </h1>
      <p className="mt-2 max-w-[52ch] text-white/60">
        Counted across the whole queue, not the filtered view below.
      </p>

      <div className="mt-7 grid gap-5 sm:grid-cols-3 sm:gap-0">
        <Count
          value={attention.awaitingTriage}
          label="Awaiting triage"
          note="Submitted, not yet opened"
          href="/admin?view=triage#pipeline"
        />
        <Count
          value={attention.overdue}
          label="Past deadline"
          note="Requested date has gone by"
          href="/admin?view=overdue#pipeline"
        />
        <Count
          value={attention.stalled}
          label="No movement"
          note={`Open, untouched ${STALE_AFTER_DAYS}+ days`}
          href="/admin?stale=1#pipeline"
        />
      </div>

      {/* Separated by a rule rather than boxed: a bordered panel inside the
          bordered band would be a card inside a card. */}
      {deliveriesNeedingReview > 0 && (
        <div className="mt-8 border-t border-white/15 pt-6">
          <h2 className="text-base text-white">
            {deliveriesNeedingReview} email{deliveriesNeedingReview === 1 ? "" : "s"} need a decision
          </h2>
          <p className="mt-2 max-w-[62ch] text-sm text-white/60">
            These never retry on their own — the provider outcome was ambiguous, so someone has to
            confirm whether the message arrived. The requester&rsquo;s private status page is
            already correct either way.
          </p>
          {/* Two deliberate lines rather than one wrapping label: the metadata is
              too long to sit beside the reference at narrow widths. */}
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {deliveryReviewRows.map((row) => (
              <li key={row.deliveryId}>
                <Link
                  href={`/admin/requests/${row.requestId}`}
                  className="block min-h-11 rounded-[var(--radius-chip)] border border-white/25 px-4 py-2 text-sm text-white transition-colors duration-[var(--dur-hover)] hover:border-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
                >
                  <span className="tnum block whitespace-nowrap font-mono font-bold">
                    {row.ref}
                  </span>
                  <span className="mt-0.5 block text-xs text-white/55">
                    {row.recipientKind === "club" ? "club" : "requester"} ·{" "}
                    {emailDeliveryStateLabel(row.state).toLowerCase()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <p className="mt-3 text-sm text-white/45">
              {hidden} more not shown. Open each request to resolve its delivery.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
