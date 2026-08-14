import type { Metadata } from "next";
import Image from "next/image";
import Button from "../components/Button";
import PageIntro from "../components/PageIntro";
import ScrollReveal from "../components/ScrollReveal";
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
        lead="A growing collection of 3D models designed and printed by our very own club members."
        backgroundImage="/img/charlesbestbg.jpeg"
      />

      <section className="mx-auto max-w-6xl px-5 py-24 md:py-32">
        {feature ? (
          <>
            <ScrollReveal>
              <article className="group grid overflow-hidden rounded-[var(--radius-card)] bg-cloud transition-shadow duration-300 hover:shadow-xl lg:grid-cols-[1.28fr_.72fr]">
                <div className="relative min-h-[28rem] overflow-hidden bg-ink sm:min-h-[36rem] lg:min-h-[42rem]">
                  <Image
                    src={feature.image}
                    alt={`${feature.title}, printed by ${feature.printedBy}`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 720px"
                    className="project-image object-cover object-[center_38%]"
                    priority
                  />
                </div>

                <div className="flex flex-col justify-between p-7 sm:p-10 lg:p-12">
                  <div>
                    <p className="eyebrow text-slate">Name</p>
                    <h2 className="mt-5 text-5xl text-ink sm:text-6xl">{feature.title}</h2>

                    <dl className="mt-8 grid gap-4 border-y border-mist py-5 font-mono text-xs uppercase tracking-[0.08em] sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                      <div>
                        <dt className="text-slate">Creator</dt>
                        <dd className="mt-1 font-semibold text-ink">{feature.printedBy}</dd>
                      </div>
                      <div>
                        <dt className="text-slate">Material</dt>
                        <dd className="mt-1 font-semibold text-ink">{feature.material}</dd>
                      </div>
                    </dl>

                    <p className="mt-7 text-lg leading-relaxed text-slate">{feature.blurb}</p>
                  </div>
                </div>
              </article>
            </ScrollReveal>
            {moreWork.length > 0 && (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {moreWork.map((work, index) => (
                  <ScrollReveal
                    key={work.slug}
                    as="li"
                    delay={(index + 1) as 1 | 2}
                    className="group overflow-hidden rounded-[var(--radius-card)] bg-cloud transition-shadow duration-300 hover:shadow-lg"
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
                      <p className="eyebrow text-slate">Student print</p>
                      <h2 className="mt-3 text-4xl text-ink">{work.title}</h2>
                      <p className="mt-4 text-slate">{work.blurb}</p>
                    </div>
                  </ScrollReveal>
                ))}
              </ul>
            )}
          </>
        ) : (
          <ScrollReveal>
            <div className="build-grid rounded-[var(--radius-card)] border border-mist bg-cloud p-10 sm:p-16">
              <p className="eyebrow text-slate">Club gallery</p>
              <h2 className="mt-5 max-w-[12ch] text-5xl text-ink sm:text-6xl">
                The gallery is taking shape.
              </h2>
              <p className="mt-5 max-w-[48ch] text-lg text-slate">
                New work will appear here as the club makes it. Want to be part of it? Join
                us {club.meets.toLowerCase()} in {club.room}.
              </p>
            </div>
          </ScrollReveal>
        )}
      </section>

      <section className="bg-cloud px-5 py-24 md:py-28">
        <ScrollReveal>
          <div className="mx-auto max-w-6xl">
            <div>
              <p className="eyebrow text-slate">The collection keeps growing</p>
              <h2 className="mt-5 max-w-[11ch] text-5xl text-ink sm:text-6xl">
                Add to what comes next.
              </h2>
              <p className="mt-5 max-w-[50ch] text-lg text-slate">
                Learn how to 3D model and print your wildest ideas. Creative and high quality prints get featured in the gallery.
              </p>
            </div>
            <div className="mt-8 flex items-center">
              <Button href="/about#join" variant="dark" size="lg">
                Join the club <span aria-hidden="true">→</span>
              </Button>
            </div>
          </div>
        </ScrollReveal>
      </section>
    </>
  );
}
