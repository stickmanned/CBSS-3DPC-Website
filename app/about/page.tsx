import type { Metadata } from "next";
import Button from "../components/Button";
import PageIntro from "../components/PageIntro";
import ScrollReveal from "../components/ScrollReveal";
import { club, meetingFacts } from "../lib/content";

export const metadata: Metadata = {
  title: "About",
  description: `Meet the ${club.name}, learn what we do, and find out how to join us in ${club.room}.`,
};

/* Kept verbatim — this is officer-written copy, not slogan filler. */
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


const FILL = ["tile--mint", "tile--yellow", "tile--mandarin"];

export default function About() {
  return (
    <>
      <PageIntro
        label="About the club"
        title="We design, model, and print stuff."
        lead={`${club.name} is where students learn and explore 3D printing, see how digital models become physical objects, and work through the challenges between the two.`}
      />

      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="board">
          <section className="tile tile--w4">
            <h2 className="text-3xl text-ink">About us</h2>
            <p className="mt-4 max-w-[62ch] text-lg leading-relaxed text-slate">
              Welcome to CBSS 3D Printing Club! Our goal is to help students
              learn about the wonderful world of 3D design and printing. We offer
              weekly club meetings with lessons to help you master 3D printing,
              fun challenges and competitions with prizes, and a safe, friendly
              space for makers alike.
            </p>
          </section>

          {practice.map((item, index) => (
            <ScrollReveal
              key={item.title}
              className={`tile ${FILL[index]} tile--w2 lg:!col-span-1`}
              delay={(index + 1) as 1 | 2 | 3}
            >
              <h3 className="text-2xl text-ink">{item.title}</h3>
              <p className="mt-3 text-ink/75">{item.body}</p>
            </ScrollReveal>
          ))}

          <section
            id="join"
            className="tile tile--navy tile--w4 scroll-mt-32"
            style={{ "--tilt": "-1deg" } as React.CSSProperties}
          >
            <div className="grid gap-8 lg:grid-cols-[1.1fr_.9fr]">
              <div>
                <h2 className="max-w-[16ch] text-4xl">Just show up.</h2>
                <p className="mt-5 max-w-[48ch] leading-relaxed text-white/70">
                  The simplest way to start is to visit a club meeting and
                  joining our Teams Channel. Come see what we&rsquo;re working on,
                  meet the club, and tell us what you would like to make.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Button href={`mailto:${club.contactEmail}`} variant="light">
                    Email us <span aria-hidden="true">→</span>
                  </Button>
                  <Button href="/request" variant="light">
                    Request a print
                  </Button>
                </div>
              </div>

              <dl className="grid gap-5 border-t-2 border-white/20 pt-6 lg:border-l-2 lg:border-t-0 lg:pl-8 lg:pt-0">
                <div>
                  <dt className="text-sm text-white/55">
                    How to join
                  </dt>
                  <dd className="mt-1.5 text-white/85">
                    Email{" "}
                    <a
                      href={`mailto:${club.contactEmail}`}
                      className="break-all font-bold text-signal underline underline-offset-4"
                    >
                      {club.contactEmail}
                    </a>{" "}
                    with your name and student email to get added to our Teams.
                  </dd>
                </div>
                {meetingFacts.map((fact) => (
                  <div key={fact.label}>
                    <dt className="text-sm text-white/55">
                      {fact.label}
                    </dt>
                    <dd className="mt-1.5 font-display text-lg font-bold">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <section className="tile tile--w2">
            <span className="label">
              Club contacts
            </span>
            <div className="mt-3 grid gap-1.5">
              <a
                href={`mailto:${club.contactEmail}`}
                className="footer-link break-all font-display text-lg font-bold"
              >
                Contact William - {club.contactEmail}
              </a>
              <a
                href={`mailto:080-pmaroufi@${club.emailDomain}`}
                className="footer-link break-all font-display text-lg font-bold"
              >
                Contact Paya - 080-pmaroufi@{club.emailDomain}
              </a>
            </div>
          </section>

          <section className="tile tile--w2">
            <span className="label">
              Sponsor teacher
            </span>
            <p className="mt-3 font-display text-lg font-bold text-ink">
              {club.sponsorName}
            </p>
            <a
              href={`mailto:${club.sponsorEmail}`}
              className="footer-link mt-1 break-all text-slate"
            >
              {club.sponsorEmail}
            </a>
          </section>
        </div>
      </div>
    </>
  );
}
