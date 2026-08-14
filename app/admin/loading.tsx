export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12" role="status" aria-live="polite">
      <p className="eyebrow text-slate">Loading private queue…</p>
      <div className="mt-6 h-40 animate-pulse rounded-[20px] bg-mist" aria-hidden="true" />
    </div>
  );
}

