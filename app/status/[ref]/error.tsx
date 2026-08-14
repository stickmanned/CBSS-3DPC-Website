"use client";

export default function StatusError({ reset }: { reset: () => void }) {
  return (
    <section className="build-grid bg-cloud px-5 py-24">
      <div className="mx-auto max-w-2xl rounded-[var(--radius-card)] border border-mist bg-white p-8 shadow-sm sm:p-12">
        <p className="eyebrow text-slate">Private status</p>
        <h1 className="mt-4 text-4xl text-ink sm:text-5xl">The queue could not be reached.</h1>
        <p className="mt-5 text-slate">
          Your link is still valid. Try loading it again; no request details were changed.
        </p>
        <button type="button" className="btn btn--secondary mt-7" onClick={reset}>
          Try again
        </button>
      </div>
    </section>
  );
}
