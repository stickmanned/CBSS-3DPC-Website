import Link from "next/link";

export default function AdminRequestNotFound() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16 sm:py-24">
      <div className="rounded-[var(--radius-card)] border-2 border-ink bg-snow p-6 sm:p-8">
        <p className="font-display text-sm font-bold text-slate">Request unavailable</p>
        <h1 className="mt-3 text-4xl text-ink">This print request is not in the queue.</h1>
        <p className="mt-4 max-w-xl text-slate">
          It may have been deleted, or the link may be out of date. Return to the dashboard to
          continue working with the current queue.
        </p>
        <Link href="/admin#pipeline" className="btn btn--dark mt-7">
          Back to print queue
        </Link>
      </div>
    </main>
  );
}
