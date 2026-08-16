import type { Metadata } from "next";
import PageIntro from "../components/PageIntro";
import RequestForm from "../components/RequestForm";
import { club } from "../lib/content";

export const metadata: Metadata = {
  title: "Request a Print",
  description: `Send a 3D print request to the ${club.name} and receive updates by email.`,
};

const steps = [
  {
    title: "Tell us what you need",
    body: "Share the purpose, quantity, material, colors, and anything else you think we should know about.",
  },
  {
    title: "Add your model",
    body: "Use an online model link, upload an STL or 3MF file, or include both.",
  },
  {
    title: "We look it over",
    body: "We check the geometry, material choice, and whether the request can be fufilled.",
  },
  {
    title: "Track it yourself",
    body: "Your confirmation includes a private status link with additionnal email updates.",
  },
];

export default function Request() {
  return (
    <>
      <PageIntro
        label="Print request"
        accent="yellow"
        title="Tell us what you want to make."
        lead="Share the project, choose a material and colors, then add a model link or file. We will review your request and notify you about updates."
      />

      <section className="px-5 py-10">
        {/* Wider than the other pages on purpose: the colour step is a grid of
            swatches, and at the old 1.35/.65 split it got six to a row. */}
        <div className="mx-auto grid max-w-[80rem] gap-6 lg:grid-cols-[1.65fr_.7fr] lg:items-start">
          <RequestForm />

          <aside className="grid gap-5 lg:sticky lg:top-[calc(var(--header-height)+1.5rem)]">
            <div className="tile tile--navy">
              <h2 className="text-3xl">How it works</h2>

              <ol className="mt-6 border-t border-white/20">
                {steps.map((step, index) => (
                  <li
                    key={step.title}
                    className="grid grid-cols-[2rem_1fr] gap-3 border-b border-white/15 py-5"
                  >
                    <span className="text-sm text-signal">{index + 1}</span>
                    <div>
                      <h3 className="text-xl text-white">{step.title}</h3>
                      <p className="mt-2 text-[15px] text-white/70">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="tile tile--yellow">
              <h2 className="text-3xl text-ink">Every model is different.</h2>
              <p className="mt-4 text-ink/75">
                Some requests need clarification or model changes before they are ready to print. The status page will show what the club needs from you.
              </p>
              <p className="mt-6 border-t border-ink/20 pt-5 text-sm text-ink/70">
                Club contact · {club.contactEmail}
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
