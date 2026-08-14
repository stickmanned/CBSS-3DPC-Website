import Link from "next/link";

export default function StatusNotFound() {
  return (
    <section className="build-grid bg-cloud px-5 py-24">
      <div className="mx-auto max-w-2xl rounded-[var(--radius-card)] border border-mist bg-white p-8 shadow-sm sm:p-12">
        <p className="eyebrow text-slate">Private status</p>
        <h1 className="mt-4 text-4xl text-ink sm:text-5xl">This status link is not available.</h1>
        <p className="mt-5 text-slate">
          Check that the complete link was copied from the confirmation page or email. For privacy, we cannot look up a request from this page.
        </p>
        <Link href="/request" className="btn btn--secondary mt-7">
          Return to print requests
        </Link>
      </div>
    </section>
  );
}
