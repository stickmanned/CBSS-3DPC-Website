import type { Metadata } from "next";
import Button from "../components/Button";
import PageIntro from "../components/PageIntro";
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
        title="Start simple. Build from there."
        lead="These tools cover the path from a first 3D model to a file prepared for printing. Begin with the step that matches your project."
      />

      <section className="mx-auto max-w-6xl px-5 py-24 md:py-32">
        <div className="flex flex-wrap items-end justify-between gap-5 border-b border-ink pb-6">
          <div>
            <p className="eyebrow text-slate">Learning path</p>
            <h2 className="mt-4 text-4xl text-ink sm:text-5xl">Three stages, one object.</h2>
          </div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.09em] text-slate">
            Model → Refine → Prepare
          </p>
        </div>

        <ol>
          {guides.map((guide, index) => (
            <li
              key={guide.title}
              className="group grid gap-6 border-b border-mist py-10 md:grid-cols-[5rem_.7fr_1fr_auto] md:items-center md:gap-8"
            >
              <span className="font-mono text-xs font-semibold text-slate">
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
            </li>
          ))}
        </ol>
      </section>

      <section className="px-5 pb-24 md:pb-32">
        <div className="build-grid-dark mx-auto grid max-w-6xl gap-8 rounded-[var(--radius-card)] bg-navy p-7 text-white sm:p-10 md:grid-cols-[1fr_auto] md:items-end lg:p-14">
          <div>
            <p className="eyebrow text-signal">Learn with the club</p>
            <h2 className="mt-5 max-w-[11ch] text-5xl sm:text-6xl">
              Bring the model. Bring the question.
            </h2>
            <p className="mt-5 max-w-[52ch] text-lg text-white/70">
              Meet us in {club.room} on {club.meets}, {club.time}. Start wherever your
              project is now.
            </p>
          </div>
          <Button href="/about#join">
            Join the club <span aria-hidden="true">→</span>
          </Button>
        </div>
      </section>
    </>
  );
}
