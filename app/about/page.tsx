import EmailLink from "@/app/components/EmailLink";
import type { Metadata } from "next";
import Image from "next/image";
import Button from "../components/Button";
import ClubSignupForm from "../components/ClubSignupForm";
import PageIntro from "../components/PageIntro";
import ScrollReveal from "../components/ScrollReveal";
import { club, meetingFacts, signupForm, teams } from "../lib/content";

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
                    Fill out the{" "}
                    <a
                      href="#signup"
                      className="font-bold text-signal underline underline-offset-4"
                    >
                      sign-up form
                    </a>{" "}
                    below to get added to our Teams.
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

          <section id="signup" className="tile tile--w4 scroll-mt-32">
            <span className="label">Club sign-up</span>
            <h2 className="mt-2 text-3xl text-ink">Sign up for the club.</h2>
            <p className="mt-4 max-w-[56ch] text-lg leading-relaxed text-slate">
              Tell us a bit about yourself so we can add you to the club. If
              the form doesn&rsquo;t load,{" "}
              <a
                href={signupForm.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-navy underline underline-offset-4"
              >
                open it in a new tab
              </a>
              .
            </p>
            <div className="mt-6">
              <ClubSignupForm />
            </div>
          </section>

          {/* Three doors into the same team, because no single one works
              for everyone: the link is what a phone or a signed-in
              Chromebook can follow, the code is for anyone already sitting
              in the desktop app, and the QR is what a poster on the
              drafting-room wall can carry. */}
          <section className="tile tile--w4">
            <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div>
                <span className="label">Teams channel</span>
                <h2 className="mt-2 text-3xl text-ink">
                  The rest of the week happens on Teams.
                </h2>
                <p className="mt-4 max-w-[56ch] text-lg leading-relaxed text-slate">
                  It&rsquo;s where the club talks between {club.meets}. You
                  need your school ({club.emailDomain}) account to get in
                  &mdash; a personal account will be turned away at the door.
                </p>

                <a
                  href={teams.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn--primary mt-6 w-fit"
                >
                  Open the team <span aria-hidden="true">→</span>
                </a>

                <p className="mt-7 max-w-[56ch] text-slate">
                  Already in the Teams app? Use{" "}
                  <span className="font-bold text-ink">
                    Teams → Join or create a team → Join a team with a code
                  </span>{" "}
                  and type in our team code:
                </p>
                <p className="tnum mt-3 font-mono text-2xl font-bold tracking-[0.12em] text-ink">
                  {teams.code}
                </p>
              </div>

              <figure className="mx-auto w-fit sm:mx-0">
                <Image
                  src={teams.qr}
                  alt={`QR code that opens the ${club.name} team in Microsoft Teams`}
                  width={780}
                  height={780}
                  className="size-48 rounded-[var(--radius-card)] border-2 border-ink bg-white sm:size-56"
                />
                <figcaption className="mt-2.5 text-center text-sm text-slate">
                  Or scan this
                </figcaption>
              </figure>
            </div>
          </section>

          <section className="tile tile--w2">
            <span className="label">
              Club contacts
            </span>
            {/* Name and address on separate lines, like the sponsor tile: run
                together on one line, a phone-width tile has to break the
                address mid-word. */}
            <div className="mt-3 grid gap-4">
              <div>
                <p className="font-display text-lg font-bold text-ink">
                  William
                </p>
                <EmailLink
                  address={club.contactEmail}
                  className="footer-link mt-1 break-all text-slate"
                />
              </div>
              <div>
                <p className="font-display text-lg font-bold text-ink">
                  Paya
                </p>
                <EmailLink
                  address={`080-pmaroufi@${club.emailDomain}`}
                  className="footer-link mt-1 break-all text-slate"
                />
              </div>
            </div>
          </section>

          <section className="tile tile--w2">
            <span className="label">
              Sponsor teacher
            </span>
            <p className="mt-3 font-display text-lg font-bold text-ink">
              {club.sponsorName}
            </p>
            <EmailLink
              address={club.sponsorEmail}
              className="footer-link mt-1 break-all text-slate"
            />
          </section>
        </div>
      </div>
    </>
  );
}
