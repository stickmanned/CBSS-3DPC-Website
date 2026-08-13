import type { Metadata } from "next";
import { guides, club } from "../lib/content";
import PageIntro from "../components/PageIntro";

export const metadata: Metadata = {
  title: "Guides",
  description:
    "How to go from knowing nothing to having a printable model: Tinkercad, Fusion, OrcaSlicer.",
};

export default function Guides() {
  return (
    <>
      <PageIntro
        eyebrow="Guides"
        title="Start from nothing."
        lead="You do not need to know any of this to join. But if you want to design your own things rather than print other people's, this is the order to learn it in."
      />

      <div className="mx-auto max-w-5xl px-6">
        <ol className="border-t border-navy/15">
          {guides.map((g, i) => (
            <li
              key={g.title}
              className="grid gap-x-6 gap-y-2 border-b border-navy/15 py-7 sm:grid-cols-[3rem_1fr_auto] sm:items-baseline"
            >
              {/* The numbering is real here — this is a genuine sequence. */}
              <span className="data text-silver">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <h2 className="font-display font-bold text-navy text-2xl">{g.title}</h2>
                  <span className="eyebrow">{g.level}</span>
                </div>
                <p className="max-w-[52ch] mt-2">{g.blurb}</p>
              </div>
              <a
                href={g.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-display font-bold text-navy text-[15px] hover:text-ink whitespace-nowrap"
              >
                Open &rarr;
              </a>
            </li>
          ))}
        </ol>

        <div className="mt-10">
          <h2 className="font-display font-bold text-navy text-xl">
            Or just come and ask someone
          </h2>
          <p className="max-w-[48ch] mt-2">
            Reading about slicer settings is a much worse way to learn them than standing
            next to the machine while it does something wrong. {club.meets}, {club.time},{" "}
            {club.room}.
          </p>
        </div>
      </div>
    </>
  );
}
