import type { Metadata } from "next";
import Button from "../components/Button";
import PageIntro from "../components/PageIntro";
import ScrollReveal from "../components/ScrollReveal";
import { club, guides } from "../lib/content";

export const metadata: Metadata = {
  title: "Learn",
  description:
    "Start learning 3D design with a practical path through modelling, CAD, and slicing tools.",
};

export default function Guides() {
  return (
    <>
      <PageIntro
        eyebrow="Learn"
        title={
          <>
            <span className="whitespace-nowrap">
              Start <span className="text-signal">simple</span>.
            </span>{" "}
            Build from there.
          </>
        }
        titleClassName="max-w-[16ch]"
        lead="New to 3D printing? You've come to the right place. Join the club and we'll teach you everything from the basics of CAD software to advanced printing techniques. "
        backgroundImage="/img/3Dprintingbg.jpg"
      />

      <section className="mx-auto max-w-6xl px-5 py-24 md:py-32">
        <ScrollReveal>
          <div className="flex flex-wrap items-end justify-between gap-5 border-b border-ink pb-6">
            <div>
              <p className="eyebrow text-slate">Learning path</p>
              <h2 className="mt-4 text-4xl text-ink sm:text-5xl">Three stages, one objective.</h2>
            </div>
          </div>
        </ScrollReveal>

        <ol>
          {guides.map((guide, index) => (
            <ScrollReveal
              key={guide.title}
              as="li"
              delay={(index + 1) as 1 | 2 | 3}
              className="group grid gap-6 rounded-xl border-b border-mist px-2 py-10 transition-colors duration-200 hover:bg-cloud/50 sm:px-4 md:grid-cols-[5rem_.7fr_1fr_auto] md:items-center md:gap-8"
            >
              <span className="font-mono text-xs font-semibold text-slate transition-colors group-hover:text-navy">
                {String(index + 1).padStart(2, "0")}
              </span>

              <div>
                <p className="eyebrow text-slate">{guide.level}</p>
                <h3 className="mt-3 text-4xl text-ink sm:text-5xl">{guide.title}</h3>
              </div>

              <p className="max-w-[46ch] text-slate">{guide.blurb}</p>

              <a
                href={guide.href}
                target="_blank"
                rel="noopener noreferrer"
                className="grid size-12 place-items-center rounded-full border border-navy/25 font-mono text-navy transition-[background-color,color,transform] duration-200 group-hover:translate-x-1 group-hover:bg-navy group-hover:text-white"
                aria-label={`Explore ${guide.title} (opens in a new tab)`}
              >
                <span aria-hidden="true">↗</span>
              </a>
            </ScrollReveal>
          ))}
        </ol>
      </section>
      <section className="px-5 pb-24 md:pb-32">
        <ScrollReveal>
          <div className="build-grid-dark mx-auto grid max-w-6xl gap-8 rounded-[var(--radius-card)] bg-navy p-7 text-white shadow-xl sm:p-10 md:grid-cols-[1fr_auto] md:items-end lg:p-14">
            <div>
              <p className="eyebrow text-signal">Learn with the club</p>
              <h2 className="mt-5 max-w-[11ch] text-5xl sm:text-6xl">
                Join weekly 3D printing lessons, challenges, and more!
              </h2>
              <p className="mt-5 max-w-[52ch] text-lg text-white/70">
                Ready to dive in the world of 3D printing? Join the club and meet us in {club.room} on {club.meets}, {club.time}! 
              </p>
            </div>
            <Button href="/about#join">
              Join the club <span aria-hidden="true">→</span>
            </Button>
          </div>
        </ScrollReveal>
      </section>
    </>
  );
}
