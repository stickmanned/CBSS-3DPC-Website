import type { Metadata } from "next";
import PageIntro from "../components/PageIntro";
import RequestForm from "../components/RequestForm";
import ScrollReveal from "../components/ScrollReveal";
import { club } from "../lib/content";

export const metadata: Metadata = {
  title: "Request a Print",
  description: `Send a 3D print request to the ${club.name} and receive updates by email.`,
};

const steps = [
  {
    title: "Describe the project",
    body: "Add your name, school email, number of copies, and what the object is for.",
  },
  {
    title: "Open your email draft",
    body: "The form creates a message addressed to the club.",
  },
  {
    title: "Attach your model",
    body: "Check that your model file is attached before you press Send.",
  },
  {
    title: "Watch for our reply",
    body: "We’ll contact you if we need more information or when there is an update.",
  },
];

export default function Request() {
  return (
    <>
      <PageIntro
        eyebrow="Print request"
        title="Tell us what you want to make."
        lead="Share your project details and attach your 3D model. We will review the request and follow up by email. Once approved, we will start printing!"
      />

      <section className="bg-cloud px-5 py-20 md:py-28">
        <ScrollReveal>
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.2fr_.8fr] lg:items-start">
            <RequestForm />

            <aside className="grid gap-5 lg:sticky lg:top-[calc(var(--header-height)+1.5rem)]">
              <div className="build-grid-dark rounded-[var(--radius-card)] bg-navy p-7 text-white shadow-xl sm:p-9">
                <p className="eyebrow text-signal">What happens next</p>
                <h2 className="mt-4 text-4xl">From form to reply.</h2>

                <ol className="mt-8 border-t border-white/20">
                  {steps.map((step, index) => (
                    <li
                      key={step.title}
                      className="grid grid-cols-[2.5rem_1fr] gap-3 border-b border-white/15 py-5"
                    >
                      <span className="font-mono text-xs font-semibold text-signal">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h3 className="text-xl text-white">{step.title}</h3>
                        <p className="mt-2 text-[15px] text-white/70">{step.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="rounded-[var(--radius-card)] bg-signal p-7 text-ink shadow-md sm:p-9">
                <p className="eyebrow">A useful heads-up</p>
                <h2 className="mt-4 text-3xl">Every model is different.</h2>
                <p className="mt-4 text-ink/75">
                  Some requests may need clarification or changes before they are ready to
                  print. If something needs attention, we’ll explain it in our reply.
                </p>
                <p className="mt-6 border-t border-ink/20 pt-5 font-mono text-xs font-semibold uppercase tracking-[0.08em]">
                  Club contact · {club.contactEmail}
                </p>
              </div>
            </aside>
          </div>
        </ScrollReveal>
      </section>
    </>
  );
}
