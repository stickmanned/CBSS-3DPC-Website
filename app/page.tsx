import Image from "next/image";
import Link from "next/link";
import { club, gallery, guides } from "./lib/content";
import MarkerUnderline from "./components/MarkerUnderline";
import LogTable from "./components/LogTable";
import Button from "./components/Button";

export default function Home() {
  const feature = gallery[0];

  return (
    <>
      {/* ---- HERO: type left, the printed mark right ---------------- */}
      <section className="mx-auto max-w-5xl px-6 pt-14 pb-12 grid gap-10 items-center lg:grid-cols-[1.15fr_.85fr]">
        <div>
          <p className="eyebrow">
            {club.room} · {club.school} · {club.district}
          </p>

          <h1 className="display text-[clamp(2.9rem,8.5vw,4.7rem)] mt-5">
            Powering
            <br />
            <MarkerUnderline>Imagination.</MarkerUnderline>
            <br />
            One Layer
            <br />
            At a Time
          </h1>

          <p className="text-[19px] max-w-[44ch] mt-7">
            CBSS 3D printing club is a community for students to learn, design, and print.
          </p>

          <div className="flex flex-wrap gap-3 mt-8">
            <Button href="/request">Request a print &rarr;</Button>
            <Button href="/about" variant="secondary">
              Come to a meeting
            </Button>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <Image
            src="/img/logo.png"
            alt={`The ${club.short} mark, modelled and printed by the club`}
            width={699}
            height={902}
            className="w-auto h-[min(58vw,380px)]"
            priority
          />
        </div>
      </section>

      {/* ---- THE LOG ------------------------------------------------ */}
      <LogTable limit={4} showLink />

      {/* ---- PAGE PREVIEWS -----------------------------------------
          Four deliberately different sizes. Gallery is largest because
          it is the proof; request is widest because it is the point.
          Three equal cards in a row is the tell of a page assembled
          rather than designed.                                       */}
      <section className="mx-auto max-w-5xl px-6 pt-14">
        <h2 className="eyebrow mb-5">The rest of the site</h2>

        <div className="grid gap-4 md:grid-cols-[1.55fr_1fr]">
          {/* GALLERY — feature */}
          <Link
            href="/gallery"
            className="group bg-chalk border border-navy/15 flex flex-col md:row-span-2"
          >
            <div className="relative flex-1 min-h-56 bg-navy overflow-hidden">
              {feature && (
                <Image
                  src={feature.image}
                  alt={`${feature.title} by ${feature.author}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 520px"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              )}
            </div>
            <div className="p-5">
              <p className="eyebrow">Gallery</p>
              <p className="font-display font-bold text-navy text-lg mt-2">
                What students have made
              </p>
              <p className="text-[15px] mt-2">
                {feature
                  ? `${feature.title} by ${feature.author} — ${feature.blurb}`
                  : "Photos of club work, taken in the lab."}
              </p>
              <p className="font-display font-bold text-navy text-[15px] mt-3">
                See all of it &rarr;
              </p>
            </div>
          </Link>

          {/* ABOUT — small */}
          <Link href="/about" className="bg-chalk border border-navy/15 p-5 block">
            <p className="eyebrow">About</p>
            <p className="font-display font-bold text-navy text-lg mt-2">{club.room}</p>
            <p className="data text-navy mt-3 leading-loose">
              {club.meets.toUpperCase()}
              <br />
              {club.time}
            </p>
            <p className="text-[15px] mt-2">
              Walk in. There&rsquo;s no sign-up and nothing to bring.
            </p>
            <p className="font-display font-bold text-navy text-[15px] mt-3">
              Who we are &rarr;
            </p>
          </Link>

          {/* GUIDES — small */}
          <Link href="/guides" className="bg-chalk border border-navy/15 p-5 block">
            <p className="eyebrow">Guides</p>
            <p className="font-display font-bold text-navy text-lg mt-2">
              Start from nothing
            </p>
            <p className="text-[15px] mt-2">
              {guides.map((g) => g.title).join(", ")} — in the order you&rsquo;ll actually
              need them.
            </p>
            <p className="font-display font-bold text-navy text-[15px] mt-3">Learn it &rarr;</p>
          </Link>

          {/* REQUEST — wide, inverted */}
          <Link
            href="/request"
            className="md:col-span-2 bg-navy p-6 flex flex-wrap items-center justify-between gap-5"
          >
            <div>
              <p className="eyebrow text-signal">Request a print</p>
              <p className="font-display font-bold text-paper text-xl mt-2">
                Send us an .STL. We&rsquo;ll print it free.
              </p>
              <p className="text-[15px] text-silver mt-1.5 max-w-[52ch]">
                Any student, any class, any project. Usually back within a week — sooner
                if it&rsquo;s small.
              </p>
            </div>
            <span className="inline-flex items-center gap-2.5 font-display font-bold text-[15px] bg-signal text-ink px-5 py-3 whitespace-nowrap">
              Start a request &rarr;
            </span>
          </Link>
        </div>
      </section>
    </>
  );
}
