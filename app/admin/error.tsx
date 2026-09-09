"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Admin dashboard render failed", error.digest ?? error.name);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl px-5 py-16 sm:py-24">
      <div className="rounded-[var(--radius-card)] border-2 border-ink bg-snow p-6 sm:p-8" role="alert">
        <p className="font-display text-sm font-bold text-terracotta">Queue unavailable</p>
        <h1 className="mt-3 text-4xl text-ink">The admin dashboard could not load.</h1>
        <p className="mt-4 max-w-xl text-slate">
          Try loading the queue again. If you just submitted an update, check the request’s
          current status before repeating it.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <button type="button" className="btn btn--dark" onClick={() => retry()}>
            Try again
          </button>
          <Link href="/" className="btn btn--secondary">
            Go to website
          </Link>
        </div>
      </div>
    </main>
  );
}
