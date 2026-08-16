import Image from "next/image";
import Link from "next/link";
import Button from "./components/Button";
import CyclingWord from "./components/CyclingWord";
import SpoolPicker from "./components/SpoolPicker";
import HeroRail from "./components/HeroRail";
import LayerStage from "./components/LayerStage";
import ScrollReveal from "./components/ScrollReveal";
import Sticker from "./components/Stickers";
import { club, gallery, guides, meetingFacts } from "./lib/content";

/* The homepage is a noticeboard, not a landing page. Blocks of different
   sizes, pinned at slightly different angles. The order answers the four
   questions a student actually has, in the order they have them: what is
   this, when and where, what do people make, how do I get in. */
export default function Home() {
  const feature = gallery[0];

  return (
    <>
      {/* Dark hero, collage-railed, centred — the one section that borrows the
          reference site's shape. Everything below it stays on paper. */}
      <section className="hero-dark">
        <div className="mx-auto grid max-w-[90rem] items-center gap-8 px-5 py-14 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,14rem)] lg:py-20">
          <HeroRail side="left" />

          {/* The centre column reserves a gutter on each side at xl and the
              stickers live inside it. Positioning them by eye against the text
              looked fine at one window width and collided at others; giving
              them their own reserved space makes it impossible. */}
          <div className="relative px-0 text-center xl:px-36">
            <Sticker
              kind="logo"
              tilt="-8deg"
              size={88}
              className="left-0 top-2 hidden xl:grid"
            />
            <Sticker
              kind="benchy"
              tilt="7deg"
              size={80}
              className="right-0 top-0 hidden xl:grid"
            />
            <Sticker
              kind="spool"
              tilt="-5deg"
              size={76}
              className="bottom-2 left-2 hidden xl:grid"
            />
            {/* Larger than the others on purpose: the printer artwork is dark
                grey on a dark hero and the most detailed of the four, so at the
                same size as the boat it read as a smudge. */}
            <Sticker
              kind="printer"
              tilt="9deg"
              size={112}
              className="-bottom-2 right-0 hidden xl:grid"
            />
            {/* No fifth sticker in the centre — a bottom-centre placement lands
                straight on the CTA buttons. `layers` stays exported for use in
                a section that has room for it. */}

            <p className="sticker sticker--mint mx-auto w-fit">
              {club.school} · {club.district}
            </p>
            <h1 className="mx-auto mt-6 max-w-[15ch] text-[clamp(2.75rem,6.5vw,4.75rem)]">
              Come make something <CyclingWord />
            </h1>
            <p className="mx-auto mt-6 max-w-[46ch] text-lg leading-relaxed text-white/70">
              CBSS 3D printing club is a community where students design, model,
              and 3D print cool stuff.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button href="/about#join">
                Join the club <span aria-hidden="true">→</span>
              </Button>
              <Button href="/request" variant="light">
                Request a print
              </Button>
            </div>
          </div>

          <HeroRail side="right" />
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-10 md:py-14">
        <div className="board">

        {/* What people make — the largest block on the page, uncropped */}
        {feature && (
          <ScrollReveal className="tile tile--w2 tile--h2 overflow-hidden !p-0">
            <figure className="flex h-full flex-col">
              <div className="relative min-h-[22rem] flex-1 bg-cloud">
                <Image
                  src={feature.image}
                  alt={`${feature.title}, printed by ${feature.printedBy}`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 560px"
                  className="object-cover"
                  priority
                />
              </div>
              <figcaption className="relative border-t-2 border-ink p-5">
                <span className="sticker sticker--mandarin sticker--stuck">
                  {feature.material}
                </span>
                <p className="font-display text-2xl font-bold text-ink">
                  {feature.title}
                </p>
                <p className="mt-1 text-sm text-slate">
                  Printed by {feature.printedBy}
                </p>
                <p className="mt-3 text-slate">{feature.blurb}</p>
                <Link href="/gallery" className="text-link mt-4 w-fit">
                  See the gallery <span aria-hidden="true">→</span>
                </Link>
              </figcaption>
            </figure>
          </ScrollReveal>
        )}

        {/* When and where — the join decision, in the first screen */}
        <section
          className="tile tile--yellow tile--h2 justify-between"
          style={{ "--tilt": "1.1deg" } as React.CSSProperties}
          aria-label="Club meeting details"
        >
          <p className="font-display text-xl font-bold text-ink">
            We meet every week.
          </p>
          <dl className="mt-6 grid gap-5">
            {meetingFacts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-sm text-ink/60">{fact.label}</dt>
                <dd className="mt-1 font-display text-lg font-bold leading-snug text-ink">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* How to get in */}
        <section
          className="tile tile--navy justify-between"
          style={{ "--tilt": "-1.4deg" } as React.CSSProperties}
        >
          <h2 className="text-3xl">Join our Teams</h2>
          <div className="mt-4">
            {/* The address gets its own line: inline, it broke mid-address
                ("080-" / "wwen@sd43.bc.ca") in the first screen. */}
            <a
              href={`mailto:${club.contactEmail}`}
              className="block w-fit font-bold text-signal underline underline-offset-4"
            >
              {club.contactEmail}
            </a>
            <p className="mt-2 text-white/75">
              Email us with your name and school email to get added to our
              Teams.
            </p>
          </div>
        </section>

        {/* The toy. Small, off to one side — a thing you notice, not a hero. */}
        <section
          className="tile items-center justify-center !p-3"
          style={{ "--tilt": "1.8deg" } as React.CSSProperties}
        >
          <LayerStage />
        </section>

        <section
          className="tile tile--mandarin tile--w2 justify-between"
          style={{ "--tilt": "-0.8deg" } as React.CSSProperties}
        >
          <h2 className="max-w-[12ch] text-3xl text-ink">Have a model ready?</h2>
          <p className="mt-4 max-w-[40ch] text-ink/75">
            Share your project details. We&rsquo;ll review the request and follow
            up by email.
          </p>
          <Link href="/request" className="text-link mt-5 w-fit">
            Request a print <span aria-hidden="true">→</span>
          </Link>
        </section>

        <section
          className="tile tile--w2 justify-between"
          style={{ "--tilt": "0.9deg" } as React.CSSProperties}
        >
          <h2 className="text-3xl text-ink">Never done this before?</h2>
          <ol className="mt-5 grid gap-3">
            {guides.map((guide, index) => (
              <li key={guide.title} className="flex items-baseline gap-3">
                <span className="text-sm text-slate">{index + 1}</span>
                <span className="font-display font-bold text-ink">
                  {guide.title}
                </span>
                <span className="text-sm text-slate">{guide.level}</span>
              </li>
            ))}
          </ol>
          <Link href="/guides" className="text-link mt-5 w-fit">
            Start here <span aria-hidden="true">→</span>
          </Link>
        </section>

          {/* Real inventory, doing the work photography can't do yet */}
          <ScrollReveal className="tile tile--w4" delay={1}>
            <SpoolPicker />
          </ScrollReveal>
        </div>
      </div>
    </>
  );
}
