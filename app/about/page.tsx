import type { Metadata } from "next";
import Button from "../components/Button";
import PageIntro from "../components/PageIntro";
import { club } from "../lib/content";

export const metadata: Metadata = {
  title: "About",
  description: `Meet the ${club.name}, learn what we do, and find out how to join us in ${club.room}.`,
};

const practice = [
  {
    title: "Model an idea",
    body: "Start with a shape, part, or problem and turn it into a digital model.",
  },
  {
    title: "Prepare the print",
    body: "Think through scale, orientation, supports, and the other details that affect the result.",
  },
  {
    title: "Learn from the result",
    body: "Inspect what worked, adjust what did not, and carry that lesson into the next version.",
  },
];

export default function About() {
  return (
    <>
      <PageIntro
        eyebrow="About the club"
        title="We learn by making."
        lead={`The ${club.name} is where students explore 3D design, see how digital models become physical objects, and work through the challenges between the two.`}
      />

      <section className="mx-auto max-w-6xl px-5 py-24 md:py-32">
        <div className="grid gap-10 lg:grid-cols-[.7fr_1.3fr]">
          <div>
            <p className="eyebrow text-slate">What happens here</p>
            <h2 className="mt-5 max-w-[10ch] text-5xl text-ink sm:text-6xl">
              The whole process belongs in the room.
            </h2>
          </div>

          <div>
            <p className="max-w-[55ch] text-xl leading-relaxed text-slate">
              A finished print is only one moment. The club is also the idea before it,
              the settings behind it, and the next attempt after something unexpected
              happens.
            </p>

            <ol className="mt-12 border-t border-ink">
              {practice.map((item, index) => (
                <li
                  key={item.title}
                  className="grid gap-4 border-b border-mist py-8 sm:grid-cols-[4rem_.75fr_1fr] sm:gap-6"
                >
                  <span className="font-mono text-xs font-semibold text-slate">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-3xl text-ink">{item.title}</h3>
                  <p className="text-slate">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="join" className="bg-cloud px-5 py-24 md:py-32">
        <div className="build-grid-dark relative mx-auto max-w-6xl overflow-hidden rounded-[var(--radius-card)] bg-navy text-white">
          <div className="grid gap-12 p-7 sm:p-10 lg:grid-cols-[1.15fr_.85fr] lg:p-14">
            <div>
              <p className="eyebrow text-signal">Join the club</p>
              <h2 className="mt-5 max-w-[9ch] text-5xl sm:text-6xl md:text-7xl">
                Start with a Tuesday.
              </h2>
              <p className="mt-6 max-w-[48ch] text-lg leading-relaxed text-white/70">
                The simplest way to start is to visit a meeting. Come see what we’re
                working on, meet the club, and tell us what you would like to make.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button href={`mailto:${club.contactEmail}`}>
                  Email the club <span aria-hidden="true">→</span>
                </Button>
                <Button href="/request" variant="light">
                  Request a print
                </Button>
              </div>
            </div>

            <div className="border-t border-white/20 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
              <dl className="grid gap-7">
                <div>
                  <dt className="eyebrow text-white/60">When</dt>
                  <dd className="mt-2 font-display text-3xl font-bold">
                    {club.meets} · {club.time}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow text-white/60">Where</dt>
                  <dd className="mt-2">
                    <span className="block font-display text-3xl font-bold">{club.room}</span>
                    <span className="mt-1 block text-white/65">{club.school}</span>
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow text-white/60">Questions</dt>
                  <dd className="mt-2">
                    <a
                      href={`mailto:${club.contactEmail}`}
                      className="break-all font-display text-lg font-bold text-signal hover:text-white"
                    >
                      {club.contactEmail}
                    </a>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-8 grid max-w-6xl gap-4 sm:grid-cols-2">
          <div className="rounded-[var(--radius-card)] border border-mist bg-white p-7">
            <p className="eyebrow text-slate">Club contact</p>
            <a
              href={`mailto:${club.contactEmail}`}
              className="mt-3 block break-all font-display text-xl font-bold text-ink hover:text-navy"
            >
              {club.contactEmail}
            </a>
          </div>
          <div className="rounded-[var(--radius-card)] border border-mist bg-white p-7">
            <p className="eyebrow text-slate">Club sponsor</p>
            <p className="mt-3 font-display text-xl font-bold text-ink">{club.sponsorName}</p>
            <a
              href={`mailto:${club.sponsorEmail}`}
              className="mt-1 block break-all text-slate hover:text-navy"
            >
              {club.sponsorEmail}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
