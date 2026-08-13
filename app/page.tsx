import Image from "next/image";
import Link from "next/link";
import Button from "./components/Button";
import LayerStage from "./components/LayerStage";
import { club, gallery, meetingFacts } from "./lib/content";

const process = [
  {
    label: "Model",
    title: "Shape the idea.",
    body: "Start with a part, a character, or a problem and turn it into a digital model.",
  },
  {
    label: "Prepare",
    title: "Plan the print.",
    body: "Consider scale, orientation, supports, and the details that influence the result.",
  },
  {
    label: "Inspect",
    title: "Learn from the object.",
    body: "See what worked, adjust what did not, and carry the lesson into the next version.",
  },
];

export default function Home() {
  const feature = gallery[0];

  return (
    <>
      <section className="relative isolate overflow-hidden bg-ink text-white">
        <div aria-hidden="true" className="build-grid-dark absolute inset-0 -z-10 opacity-50" />

        <div className="mx-auto grid min-h-[calc(100svh-var(--header-height))] max-w-6xl items-center gap-12 px-5 py-14 lg:grid-cols-[1.05fr_.95fr] lg:gap-16 lg:py-16">
          <div className="relative z-10">
            <p className="eyebrow text-signal">
              {club.school} · {club.room}
            </p>

            <h1 className="mt-6 max-w-[9.5ch] text-[clamp(3.75rem,8.4vw,7.25rem)]">
              Ideas become <span className="text-signal">objects</span> here.
            </h1>

            <p className="mt-7 max-w-[43ch] text-lg leading-relaxed text-white/70 md:text-xl">
              Explore what CBSS students are making, learn the basics of 3D design, or
              bring us a model of your own.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button href="/request">
                Request a print <span aria-hidden="true">→</span>
              </Button>
              <Button href="/about#join" variant="light">
                Join the club <span aria-hidden="true">→</span>
              </Button>
            </div>

            <p className="mt-8 font-mono text-[11px] font-semibold uppercase tracking-[0.11em] text-white/60">
              {club.meets} · {club.time} · {club.room}
            </p>
          </div>

          <div className="flex justify-center lg:justify-end">
            <LayerStage />
          </div>
        </div>
      </section>

      <section aria-label="Club meeting details" className="border-b border-mist bg-white">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 px-5 md:grid-cols-4">
          {meetingFacts.map((fact, index) => (
            <div
              key={fact.label}
              className={`py-6 md:px-6 ${
                index % 2 === 0 ? "pr-4" : "border-l border-mist pl-4"
              } ${index > 1 ? "border-t border-mist md:border-t-0" : ""} ${
                index > 0 ? "md:border-l md:border-mist" : "md:pl-0"
              }`}
            >
              <dt className="eyebrow text-slate">{fact.label}</dt>
              <dd className="mt-2 font-display text-[15px] font-bold leading-snug text-ink sm:text-base">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {feature && (
        <section className="mx-auto max-w-6xl px-5 py-24 md:py-32">
          <div className="grid gap-8 md:grid-cols-[.55fr_1fr] md:items-end">
            <p className="eyebrow text-slate">Featured print</p>
            <div>
              <h2 className="max-w-[12ch] text-5xl text-ink sm:text-6xl">
                The work is the proof.
              </h2>
              <p className="mt-5 max-w-[48ch] text-lg text-slate">
                Real prints carry the layer lines, support marks, and small decisions that
                made them possible.
              </p>
            </div>
          </div>

          <article className="group mt-12 grid overflow-hidden rounded-[var(--radius-card)] bg-cloud lg:grid-cols-[1.28fr_.72fr]">
            <div className="relative min-h-[28rem] overflow-hidden bg-ink sm:min-h-[36rem] lg:min-h-[42rem]">
              <Image
                src={feature.image}
                alt={`${feature.title}, printed by ${feature.printedBy}`}
                fill
                sizes="(max-width: 1024px) 100vw, 720px"
                className="project-image object-cover object-[center_38%]"
              />
            </div>

            <div className="flex flex-col justify-between p-7 sm:p-10 lg:p-12">
              <div>
                <p className="eyebrow text-slate">Project record</p>
                <h3 className="mt-5 text-5xl text-ink sm:text-6xl">{feature.title}</h3>

                <dl className="mt-8 grid gap-4 border-y border-mist py-5 font-mono text-xs uppercase tracking-[0.08em] sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <div>
                    <dt className="text-slate">Printed by</dt>
                    <dd className="mt-1 font-semibold text-ink">{feature.printedBy}</dd>
                  </div>
                  <div>
                    <dt className="text-slate">Material</dt>
                    <dd className="mt-1 font-semibold text-ink">{feature.material}</dd>
                  </div>
                </dl>

                <p className="mt-7 text-lg leading-relaxed text-slate">{feature.blurb}</p>
              </div>

              <Link href="/gallery" className="text-link mt-10 w-fit">
                View student work <span aria-hidden="true">→</span>
              </Link>
            </div>
          </article>
        </section>
      )}

      <section className="bg-cloud py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-5">
          <p className="eyebrow text-slate">Your next step</p>
          <h2 className="mt-5 max-w-[11ch] text-5xl text-ink sm:text-6xl md:text-7xl">
            Two ways into the club.
          </h2>

          <div className="mt-12 grid gap-4 lg:grid-cols-12">
            <Link
              href="/request"
              className="group flex min-h-[24rem] flex-col justify-between rounded-[var(--radius-card)] bg-signal p-7 text-ink transition-transform duration-300 hover:-translate-y-1 sm:p-10 lg:col-span-7"
            >
              <div className="flex items-start justify-between gap-6">
                <p className="eyebrow">Request a print</p>
                <span
                  aria-hidden="true"
                  className="grid size-12 place-items-center rounded-full border border-ink/30 font-mono transition-transform duration-300 group-hover:translate-x-1"
                >
                  →
                </span>
              </div>
              <div>
                <h3 className="max-w-[10ch] text-5xl sm:text-6xl">Have a model ready?</h3>
                <p className="mt-5 max-w-[43ch] text-lg text-ink/75">
                  Share your project details. We’ll review the request and follow up by
                  email.
                </p>
              </div>
            </Link>

            <Link
              href="/about#join"
              className="group flex min-h-[24rem] flex-col justify-between rounded-[var(--radius-card)] bg-navy p-7 text-white transition-transform duration-300 hover:-translate-y-1 sm:p-10 lg:col-span-5"
            >
              <div className="flex items-start justify-between gap-6">
                <p className="eyebrow text-white/65">Drop by a meeting</p>
                <span
                  aria-hidden="true"
                  className="grid size-12 place-items-center rounded-full border border-white/30 font-mono text-signal transition-transform duration-300 group-hover:translate-x-1"
                >
                  →
                </span>
              </div>
              <div>
                <h3 className="max-w-[9ch] text-5xl sm:text-6xl">Learn by making.</h3>
                <p className="mt-5 max-w-[36ch] text-lg text-white/70">
                  Meet us {club.meets.toLowerCase()} in {club.room}. See what we’re working
                  on, ask a question, or bring an idea.
                </p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-24 md:py-32">
        <div className="grid gap-8 md:grid-cols-[.75fr_1.25fr]">
          <div>
            <p className="eyebrow text-slate">How making works</p>
            <h2 className="mt-5 max-w-[9ch] text-5xl text-ink sm:text-6xl">
              Built one decision at a time.
            </h2>
          </div>

          <div>
            <ol className="border-t border-ink">
              {process.map((step, index) => (
                <li
                  key={step.label}
                  className="grid gap-3 border-b border-mist py-7 sm:grid-cols-[4rem_.55fr_1fr] sm:gap-6"
                >
                  <span className="font-mono text-xs font-semibold text-slate">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-2xl text-ink">{step.title}</h3>
                  <p className="text-slate">{step.body}</p>
                </li>
              ))}
            </ol>

            <div className="mt-8">
              <Button href="/guides" variant="secondary">
                Explore the learning path <span aria-hidden="true">→</span>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
