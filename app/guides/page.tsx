import type { Metadata } from "next";
import Button from "../components/Button";
import PageIntro from "../components/PageIntro";
import { club, guides } from "../lib/content";

export const metadata: Metadata = {
  title: "Learn",
  description:
    "Start learning 3D design with a practical path through modelling, CAD, and slicing tools.",
};

const TILT = ["-1.2deg", "0.9deg", "-0.6deg"];

export default function Guides() {
  return (
    <>
      <PageIntro
        label="Learn"
        accent="mandarin"
        title={
          <>
            Start{" "}
            <span className="underline decoration-signal decoration-[0.18em] underline-offset-[0.12em]">
              simple
            </span>
            . Build from there.
          </>
        }
        lead="New to 3D printing? You've come to the right place. Join the club and we'll teach you everything from the basics of CAD software to advanced printing techniques."
      />

      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="board">
          {guides.map((guide, index) => (
            <a
              key={guide.title}
              href={guide.href}
              target="_blank"
              rel="noopener noreferrer"
              className="tile tile--w2 justify-between hover:border-navy"
              style={{ "--tilt": TILT[index] } as React.CSSProperties}
            >
              <div>
                <span className="text-sm text-slate">
                  {index + 1} · {guide.level}
                </span>
                <h2 className="mt-3 text-3xl text-ink">{guide.title}</h2>
                <p className="mt-4 max-w-[46ch] text-slate">{guide.blurb}</p>
              </div>
              <span className="text-link mt-6 w-fit">
                Open {guide.title}
                <span aria-hidden="true">↗</span>
                <span className="sr-only">(opens in a new tab)</span>
              </span>
            </a>
          ))}

          <section className="tile tile--navy tile--w2 justify-between">
            <h2 className="max-w-[16ch] text-3xl">
              Join weekly 3D printing lessons, challenges, and more!
            </h2>
            <p className="mt-4 max-w-[46ch] text-white/70">
              Ready to dive in the world of 3D printing? Join the club and meet
              us in {club.room} on {club.meets}, {club.time}!
            </p>
            <div className="mt-6">
              <Button href="/about#join" variant="light">
                Join the club <span aria-hidden="true">→</span>
              </Button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
