import type { Metadata } from "next";
import Button from "../components/Button";
import PageIntro from "../components/PageIntro";
import ScrollReveal from "../components/ScrollReveal";
import { club } from "../lib/content";

export const metadata: Metadata = {
  title: "About",
  description: `Meet the ${club.name}, learn what we do, and find out how to join us in ${club.room}.`,
};

const practice = [
  {
    title: "Join the club",
    body: "Join our Teams channel and come to our weekly meetings with the club.",
  },
  {
    title: "Learn 3D printing",
    body: "We'll cover the 3D printing process from start to finish with step-by-step lessons and interesting projects.",
  },
  {
    title: "Share your creations",
    body: "Show off your models on our gallery and compete in our competitions/challenges for prizes!",
  },
];

export default function About() {
  return (
    <>
      <PageIntro
        eyebrow="About the club"
        layout="stacked"
        title={
          <>
            Imagine a world where your <br className="hidden sm:inline" />
            imagination turns <span className="text-signal">real</span>.
          </>
        }
        lead={`${club.name} is where students learn and explore 3D printing, see how digital models become physical objects, and work through the challenges between the two.`}
        leadClassName="max-w-[50ch] text-xl md:text-2xl text-white/85 mt-8 font-normal"
        backgroundImage="/img/imaginationreal.webp"
      />

      <section className="mx-auto max-w-6xl px-5 py-24 md:py-32">
        <ScrollReveal>
          <div className="grid gap-10 lg:grid-cols-[.7fr_1.3fr]">
            <div>
              <h2 className="mt-5 max-w-[10ch] text-5xl text-ink sm:text-6xl">
                About Us
              </h2>
            </div>

            <div>
              <p className="max-w-[55ch] text-xl leading-relaxed text-slate">
                Welcome to CBSS 3D Printing Club! Our goal is to help students learn about the wonderful world of 3D design and printing. We offer weekly club meetings with lessons to help you master 3D printing, fun challenges and competitions with prizes, and a safe, friendly space for makers alike.
              </p>
              <ol className="mt-12 border-t border-ink">
                {practice.map((item, index) => (
                  <li
                    key={item.title}
                    className="group grid gap-4 border-b border-mist py-8 transition-colors duration-200 hover:bg-cloud/60 sm:grid-cols-[4rem_.75fr_1fr] sm:gap-6 sm:px-3 rounded-lg"
                  >
                    <span className="font-mono text-xs font-semibold text-slate transition-colors group-hover:text-navy">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="text-3xl text-ink">{item.title}</h3>
                    <p className="text-slate">{item.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </ScrollReveal>
      </section>

      <section id="join" className="bg-cloud px-5 py-24 md:py-32">
        <ScrollReveal>
          <div className="build-grid-dark relative mx-auto max-w-6xl overflow-hidden rounded-[var(--radius-card)] bg-navy text-white shadow-xl">
            <div className="grid gap-12 p-7 sm:p-10 lg:grid-cols-[1.15fr_.85fr] lg:p-14">
              <div>
                <p className="eyebrow text-signal">Join the club</p>
                <h2 className="mt-5 max-w-[9ch] text-5xl sm:text-6xl md:text-7xl">
                  Start your 3D printing journey <span className="text-signal">now</span>.
                </h2>
                <p className="mt-6 max-w-[48ch] text-lg leading-relaxed text-white/70">
                  The simplest way to start is to visit a club meeting and joining our Teams Channel. Come see what we’re
                  working on, meet the club, and tell us what you would like to make.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Button href={`mailto:${club.contactEmail}`}>
                    Email <span aria-hidden="true">→</span>
                  </Button>
                  <Button href="/request" variant="light">
                    Request a print
                  </Button>
                </div>
              </div>

              <div className="border-t border-white/20 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
                <dl className="grid gap-7">
                  <div>
                    <dt className="eyebrow text-white/60">How to join</dt>
                    <dd className="mt-2 text-white/85 text-base sm:text-lg leading-snug">
                      Email{" "}
                      <a
                        href={`mailto:${club.contactEmail}`}
                        className="font-semibold text-signal hover:underline"
                      >
                        {club.contactEmail}
                      </a>{" "}
                      with your name and student email to get added to our Teams.
                    </dd>
                  </div>
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
                        className="break-all font-display text-lg font-bold text-signal hover:text-white transition-colors"
                      >
                        {club.contactEmail}
                      </a>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </ScrollReveal>

        <div className="mx-auto mt-8 grid max-w-6xl gap-4 sm:grid-cols-2">
          <ScrollReveal delay={1} className="h-full">
            <div className="flex h-full flex-col justify-between rounded-[var(--radius-card)] border border-mist bg-white p-7">
              <div>
                <p className="eyebrow text-slate">Club contacts</p>
                <div className="mt-3 space-y-1.5">
                  <a
                    href={`mailto:${club.contactEmail}`}
                    className="block break-all font-display text-xl font-bold text-ink hover:text-navy transition-colors"
                  >
                    {club.contactEmail}
                  </a>
                  <a
                    href="mailto:080-pmaroufi@sd43.bc.ca"
                    className="block break-all font-display text-xl font-bold text-ink hover:text-navy transition-colors"
                  >
                    080-pmaroufi@sd43.bc.ca
                  </a>
                </div>
              </div>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={2} className="h-full">
            <div className="flex h-full flex-col justify-between rounded-[var(--radius-card)] border border-mist bg-white p-7">
              <div>
                <p className="eyebrow text-slate">Sponsor Teacher</p>
                <p className="mt-3 font-display text-xl font-bold text-ink">{club.sponsorName}</p>
                <a
                  href={`mailto:${club.sponsorEmail}`}
                  className="mt-1 block break-all text-slate hover:text-navy transition-colors"
                >
                  {club.sponsorEmail}
                </a>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
