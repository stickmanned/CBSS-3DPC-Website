export default function PageIntro({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-ink text-white">
      <div aria-hidden="true" className="build-grid-dark absolute inset-0 -z-10 opacity-70" />
      <div
        aria-hidden="true"
        className="absolute -right-20 top-1/2 -z-10 h-px w-[55vw] -rotate-12 bg-signal/70"
      />

      <div className="mx-auto grid max-w-6xl gap-7 px-5 pb-20 pt-16 md:pb-24 md:pt-20 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
        <div>
          <p className="eyebrow text-signal">{eyebrow}</p>
          <h1 className="mt-5 max-w-[11ch] text-[clamp(3.25rem,8vw,6.5rem)]">
            {title}
          </h1>
        </div>

        {lead && (
          <p className="max-w-[46ch] border-l border-white/20 pl-5 text-lg leading-relaxed text-white/70 md:text-xl">
            {lead}
          </p>
        )}
      </div>
    </section>
  );
}
