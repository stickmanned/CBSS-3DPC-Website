import type { Metadata } from "next";
import { club } from "../lib/content";
import PageIntro from "../components/PageIntro";
import RequestForm from "../components/RequestForm";

export const metadata: Metadata = {
  title: "Request a print",
  description: `Any student at ${club.school} can send us a file. We print it free.`,
};

export default function Request() {
  return (
    <>
      <PageIntro
        eyebrow="Request a print"
        title="Send us a file."
        lead="Any student, any class, any project — free. You need a model in .STL, .OBJ or .3MF. If you don't have one yet, the guides page will get you there."
      />

      <div className="mx-auto max-w-5xl px-6 grid gap-12 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <RequestForm />
        </div>

        <aside className="lg:border-l lg:border-navy/15 lg:pl-10">
          <h2 className="eyebrow">How it goes</h2>
          <ol className="mt-4 space-y-5">
            {[
              [
                "You send the file",
                "Anything the slicer can open. If it's from Tinkercad, export as .STL.",
              ],
              [
                "We check it",
                "Mostly we're looking for whether it needs supports, and whether it fits on the bed.",
              ],
              [
                "It goes in the queue",
                "Small things get done the same week. Anything over about six hours waits for a day nobody else needs the machine.",
              ],
              [
                "You collect it",
                `${club.room}, on a meeting day. We'll email you when it's off the bed.`,
              ],
            ].map(([t, d], i) => (
              <li key={t} className="grid grid-cols-[2rem_1fr] gap-3">
                <span className="data text-silver">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <p className="font-display font-bold text-navy">{t}</p>
                  <p className="text-[15px] mt-0.5">{d}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-8 border-t border-navy/15 pt-5">
            <h2 className="eyebrow">Sometimes it fails</h2>
            <p className="text-[15px] mt-2">
              About a quarter of prints don&rsquo;t work the first time. We reprint,
              you&rsquo;re not charged, and it goes in{" "}
              <a href="/log" className="text-navy underline underline-offset-2">
                the log
              </a>{" "}
              so the next person doesn&rsquo;t hit the same thing.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
