import type { Metadata } from "next";
import Image from "next/image";
import { gallery, club } from "../lib/content";
import PageIntro from "../components/PageIntro";
import Button from "../components/Button";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Things students in the club have designed and printed.",
};

export default function Gallery() {
  return (
    <>
      <PageIntro
        eyebrow="Gallery"
        title="Things students made."
        lead="Photographed in the lab, in someone's hand, under the fluorescent lights. Nothing here is staged and nothing here is a render."
      />

      <div className="mx-auto max-w-5xl px-6">
        {gallery.length === 0 ? (
          <p className="max-w-[50ch] text-silver italic">
            Nothing here yet. Bring a print to {club.room} and we&rsquo;ll photograph it.
          </p>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.map((w, i) => (
              <li
                key={w.slug}
                className={`bg-chalk border border-navy/15 ${
                  i === 0 ? "sm:col-span-2 sm:row-span-2" : ""
                }`}
              >
                <div
                  className={`relative bg-navy ${i === 0 ? "aspect-[4/3]" : "aspect-square"}`}
                >
                  <Image
                    src={w.image}
                    alt={`${w.title}, printed by ${w.author}`}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 340px"
                    className="object-cover"
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-display font-bold text-navy text-lg">{w.title}</h2>
                    <span className="data text-silver whitespace-nowrap">{w.material}</span>
                  </div>
                  <p className="eyebrow mt-1.5">Designed by {w.author}</p>
                  <p className="text-[15px] mt-2">{w.blurb}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-12 border-t border-navy/15 pt-8">
          <h2 className="font-display font-bold text-navy text-xl">Made something?</h2>
          <p className="max-w-[46ch] mt-2">
            Bring it to {club.room} on a meeting day. We&rsquo;ll take a photo and it goes
            up here with your name on it.
          </p>
          <div className="mt-5">
            <Button href="/request" variant="secondary">
              Or send us something to print &rarr;
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
