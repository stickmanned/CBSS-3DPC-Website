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
    body: "Share the purpose, quantity, material, colors, and any date we should know about.",
  },
  {
    title: "Add your model",
    body: "Use a secure model link, upload an STL or 3MF file, or include both.",
  },
  {
    title: "We look it over",
    body: "The club checks the geometry, material choice, and whether the request is practical.",
  },
  {
    title: "Track it yourself",
    body: "Your confirmation includes a private status link that works even if an email does not arrive.",
  },
];

export default function Request() {
  return (
    <>
      <PageIntro
        label="Print request"
        accent="yellow"
        title="Tell us what you want to make."
        lead="Share the project, choose a material and colors, then add a model link or file. The club will review what is practical and give you a private page for updates."
      />

      <section className="px-5 py-10">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.35fr_.65fr] lg:items-start">
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
