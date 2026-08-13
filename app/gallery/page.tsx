import type { Metadata } from "next";
import Image from "next/image";
import Button from "../components/Button";
import PageIntro from "../components/PageIntro";
import { club, gallery } from "../lib/content";

export const metadata: Metadata = {
  title: "Gallery",
  description: `Explore prints, prototypes, and experiments from the ${club.name}.`,
};

export default function Gallery() {
  const [feature, ...moreWork] = gallery;

  return (
    <>
      <PageIntro
        eyebrow="Student work"
        title="Made at CBSS."
        lead="A growing collection of club prints, prototypes, and experiments—plus the details worth carrying into the next project."
      />

      <section className="mx-auto max-w-6xl px-5 py-24 md:py-32">
        {feature ? (
          <>
            <article className="group grid overflow-hidden rounded-[var(--radius-card)] bg-cloud lg:grid-cols-[1.35fr_.65fr]">
              <div className="relative min-h-[32rem] overflow-hidden bg-ink sm:min-h-[44rem] lg:min-h-[50rem]">
                <Image
                  src={feature.image}
                  alt={`${feature.title}, printed by ${feature.printedBy}`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 760px"
                  className="project-image object-cover object-[center_38%]"
                  priority
                />
                <p className="absolute left-5 top-5 rounded-full bg-ink/85 px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.11em] text-white backdrop-blur sm:left-7 sm:top-7">
                  Project / 001
                </p>
              </div>

              <div className="flex flex-col justify-between p-7 sm:p-10 lg:p-12">
                <div>
                  <p className="eyebrow text-slate">Finished object</p>
                  <h2 className="mt-5 text-6xl text-ink md:text-7xl">{feature.title}</h2>
                  <p className="mt-7 text-lg leading-relaxed text-slate">{feature.blurb}</p>
                </div>

                <dl className="mt-12 border-t border-mist pt-6 font-mono text-xs uppercase tracking-[0.08em]">
                  <div className="flex items-baseline justify-between gap-5 border-b border-mist pb-4">
                    <dt className="text-slate">Printed by</dt>
                    <dd className="font-semibold text-ink">{feature.printedBy}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-5 pt-4">
                    <dt className="text-slate">Material</dt>
                    <dd className="font-semibold text-ink">{feature.material}</dd>
                  </div>
                </dl>
              </div>
            </article>

            {moreWork.length > 0 && (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {moreWork.map((work, index) => (
                  <li
                    key={work.slug}
                    className="group overflow-hidden rounded-[var(--radius-card)] bg-cloud"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-ink">
                      <Image
                        src={work.image}
                        alt={`${work.title}, printed by ${work.printedBy}`}
                        fill
                        sizes="(max-width: 640px) 100vw, 50vw"
                        className="project-image object-cover"
                      />
                    </div>
                    <div className="p-7">
                      <p className="eyebrow text-slate">
                        Project / {String(index + 2).padStart(3, "0")}
                      </p>
                      <h2 className="mt-3 text-4xl text-ink">{work.title}</h2>
                      <p className="mt-4 text-slate">{work.blurb}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="build-grid rounded-[var(--radius-card)] border border-mist bg-cloud p-10 sm:p-16">
            <p className="eyebrow text-slate">Collection / 000</p>
            <h2 className="mt-5 max-w-[12ch] text-5xl text-ink sm:text-6xl">
              The gallery is taking shape.
            </h2>
            <p className="mt-5 max-w-[48ch] text-lg text-slate">
              New work will appear here as the club makes it. Want to be part of it? Join
              us {club.meets.toLowerCase()} in {club.room}.
            </p>
          </div>
        )}
      </section>

      <section className="bg-cloud px-5 py-24 md:py-28">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="eyebrow text-slate">The collection keeps growing</p>
            <h2 className="mt-5 max-w-[11ch] text-5xl text-ink sm:text-6xl">
              Add to what comes next.
            </h2>
            <p className="mt-5 max-w-[50ch] text-lg text-slate">
              Bring your print to a Tuesday meeting and ask a club member about featuring
              it in the gallery.
            </p>
          </div>
          <Button href="/about#join" variant="dark">
            Join the club <span aria-hidden="true">→</span>
          </Button>
        </div>
      </section>
    </>
  );
}
