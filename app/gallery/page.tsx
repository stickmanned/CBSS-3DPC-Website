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

/* One print is one print. The old layout was a hero card plus an empty grid
   plus a section admitting the collection was thin, which read as an apology.
   A single photo set properly does not need apologising for. */
export default function Gallery() {
  return (
    <>
      <PageIntro
        label="Student work"
        title="Made at CBSS."
        lead="A growing collection of 3D models designed and printed by our very own club members."
      />

      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="board">
          {gallery.map((work, index) => (
            <ScrollReveal
              key={work.slug}
              className="tile tile--w2 overflow-hidden !p-0"
              delay={(index + 1) as 1 | 2 | 3}
            >
              <figure className="flex h-full flex-col">
                <div className="relative min-h-[24rem] flex-1 bg-cloud">
                  <Image
                    src={work.image}
                    alt={`${work.title}, printed by ${work.printedBy}`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 560px"
                    className="object-cover"
                    priority={index === 0}
                  />
                </div>
                <figcaption className="border-t-2 border-ink p-6">
                  <h2 className="text-3xl text-ink">{work.title}</h2>
                  <p className="mt-1 text-sm text-slate">
                    Printed by {work.printedBy} · {work.material}
                  </p>
                  <p className="mt-3 text-slate">{work.blurb}</p>
                </figcaption>
              </figure>
            </ScrollReveal>
          ))}

          <section className="tile tile--yellow tile--w2 justify-between">
            <h2 className="max-w-[14ch] text-3xl text-ink">
              Yours could be up here.
            </h2>
            <p className="mt-4 max-w-[40ch] text-ink/75">
              Learn how to 3D model and print your wildest ideas. Creative and
              high quality prints get featured in the gallery.
            </p>
            <div className="mt-6">
              <Button href="/about#join">
                Join the club <span aria-hidden="true">→</span>
              </Button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
