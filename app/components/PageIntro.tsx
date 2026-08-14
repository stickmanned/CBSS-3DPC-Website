import Image from "next/image";

export default function PageIntro({
  eyebrow,
  title,
  lead,
  backgroundImage,
  backgroundAlt = "",
  titleClassName,
  leadClassName,
  layout = "split",
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead?: string;
  backgroundImage?: string;
  backgroundAlt?: string;
  titleClassName?: string;
  leadClassName?: string;
  layout?: "split" | "stacked";
}) {
  return (
    <section className="relative isolate overflow-hidden bg-ink text-white">
      {backgroundImage && (
        <>
          <Image
            src={backgroundImage}
            alt={backgroundAlt}
            aria-hidden={backgroundAlt ? undefined : "true"}
            fill
            sizes="100vw"
            priority
            className="-z-20 object-cover object-center opacity-55"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-gradient-to-r from-ink via-ink/80 to-ink/60"
          />
        </>
      )}

      {!backgroundImage && (
        <div aria-hidden="true" className="build-grid-dark absolute inset-0 -z-10 opacity-70" />
      )}

      {layout === "stacked" ? (
        <div className="mx-auto max-w-6xl px-5 pb-20 pt-16 md:pb-24 md:pt-20">
          <p className="eyebrow text-signal animate-hero-eyebrow">{eyebrow}</p>
          <h1
            className={`mt-5 animate-hero-title leading-[1.04] ${
              titleClassName || "max-w-5xl text-[clamp(2.75rem,6.2vw,5.25rem)]"
            }`}
          >
            {title}
          </h1>
          {lead && (
            <p
              className={`mt-8 leading-relaxed text-white/85 animate-hero-lead ${
                leadClassName || "max-w-[54ch] text-xl md:text-2xl"
              }`}
            >
              {lead}
            </p>
          )}
        </div>
      ) : (
        <div className="mx-auto grid max-w-6xl gap-7 px-5 pb-20 pt-16 md:pb-24 md:pt-20 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
          <div>
            <p className="eyebrow text-signal animate-hero-eyebrow">{eyebrow}</p>
            <h1
              className={`mt-5 text-[clamp(3.25rem,8vw,6.5rem)] animate-hero-title ${
                titleClassName || "max-w-[11ch]"
              }`}
            >
              {title}
            </h1>
          </div>

          {lead && (
            <p
              className={`border-l border-white/20 pl-5 leading-relaxed text-white/70 animate-hero-lead ${
                leadClassName || "max-w-[46ch] text-lg md:text-xl"
              }`}
            >
              {lead}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
