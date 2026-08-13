import type { Metadata } from "next";
import { club, printers, logStats } from "../lib/content";
import PageIntro from "../components/PageIntro";
import Button from "../components/Button";

export const metadata: Metadata = {
  title: "About",
  description: `Who runs the ${club.name}, when we meet, and what's in ${club.room}.`,
};

export default function About() {
  const { total, failed } = logStats();

  return (
    <>
      <PageIntro
        eyebrow="About"
        title="A small club with one printer."
        lead={`We meet in ${club.room} at ${club.school}. There's no application, no fee, and no experience needed — a lot of members turn up having never opened CAD software.`}
      />

      <div className="mx-auto max-w-5xl px-6 grid gap-10 md:grid-cols-[1fr_1fr] md:gap-14">
        <section>
          <h2 className="eyebrow">When</h2>
          <p className="data text-navy text-base mt-3 leading-loose">
            {club.meets.toUpperCase()}
            <br />
            {club.time}
            <br />
            {club.room.toUpperCase()}
          </p>
          <p className="mt-4 max-w-[42ch]">
            Turn up to either day. If the door&rsquo;s shut and the lights are on, knock —
            someone&rsquo;s usually mid-print.
          </p>
        </section>

        <section>
          <h2 className="eyebrow">The machine</h2>
          {printers.map((p) => (
            <div key={p.name} className="mt-3">
              <p className="font-display font-bold text-navy text-lg">{p.model}</p>
              <p className="mt-2 max-w-[42ch]">{p.note}</p>
            </div>
          ))}
          <p className="mt-4 max-w-[42ch] text-silver italic">
            It has no network connection, so there&rsquo;s no live status to show you. What
            we have instead is the log — {total} prints so far, {failed} of which
            didn&rsquo;t work.
          </p>
        </section>
      </div>

      <section className="mx-auto max-w-5xl px-6 mt-14">
        <h2 className="eyebrow">What we actually do</h2>
        <div className="grid gap-6 mt-4 md:grid-cols-3">
          <p className="max-w-[38ch]">
            <strong className="font-display text-navy">Print things for people.</strong>{" "}
            Any student can send a file. Class projects, robotics parts, replacement knobs
            for things that broke — it all goes in the same queue.
          </p>
          <p className="max-w-[38ch]">
            <strong className="font-display text-navy">Teach the software.</strong> Most
            members arrive not knowing how to model anything. Tinkercad on day one, Fusion
            when that stops being enough.
          </p>
          <p className="max-w-[38ch]">
            <strong className="font-display text-navy">Keep the machine running.</strong>{" "}
            Levelling, unclogging, replacing the nozzle, arguing about bed temperature. This
            is most of it, honestly.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 mt-9">
          <Button href="/request">Request a print &rarr;</Button>
          <Button href="/guides" variant="secondary">
            Learn the software
          </Button>
        </div>
      </section>
    </>
  );
}
