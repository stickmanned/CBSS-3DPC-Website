import type { Metadata } from "next";
import { logStats } from "../lib/content";
import PageIntro from "../components/PageIntro";
import LogTable from "../components/LogTable";

export const metadata: Metadata = {
  title: "The Log",
  description:
    "Every print the club has run, including the ones that failed and why they failed.",
};

export default function LogPage() {
  const { total, done, failed } = logStats();
  const rate = total ? Math.round((failed / total) * 100) : 0;

  return (
    <>
      <PageIntro
        eyebrow="The Log"
        title="Everything we've printed, including the disasters."
        lead={`${total} prints. ${done} came off the bed fine. ${failed} didn't — that's ${rate}%, and the notes on those are the most useful thing on this website.`}
      />

      <div className="mx-auto max-w-5xl px-6 pb-8">
        <p className="max-w-[54ch] text-silver italic">
          Club members graduate every year and take what they learned with them. This is the
          part that stays.
        </p>
      </div>

      <LogTable />
    </>
  );
}
