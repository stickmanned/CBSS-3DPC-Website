import Link from "next/link";
import { club, heroPhotos, nav } from "../lib/content";
import { FILAMENT_COLORS } from "../lib/filament-colors";

/* Ft8 Marquee + colophon. The marquee scrolls filament names because they
   are real inventory, not a tagline repeated for texture. Honours
   prefers-reduced-motion, where it stops and becomes a plain strip. */
const MARQUEE = FILAMENT_COLORS.filter((color) => !color.swatch).slice(0, 40);

/* One entry per distinct licence in use, so the line stays short as photos
   are swapped out rather than growing a name per image. */
const CREDITS = Array.from(
  new Map(
    heroPhotos
      .filter((p) => p.credit)
      .map((p) => [p.credit!.licence, p.credit!])
  ).values()
);

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t-2 border-ink bg-snow">
      <div
        className="marquee border-b-2 border-ink bg-mint py-2.5"
        aria-hidden="true"
      >
        <div className="marquee__track font-display text-sm font-bold text-ink">
          {[0, 1].map((copy) => (
            <span key={copy} className="marquee__run">
              {MARQUEE.map((color) => (
                <span
                  key={color.slug}
                  className="mx-3 inline-flex items-center gap-1.5"
                >
                  <span
                    className="inline-block size-2.5 border border-ink/40"
                    style={{ background: color.hex }}
                  />
                  {color.name}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-lg font-bold text-ink">{club.name}</p>
          <p className="mt-3 text-sm leading-relaxed text-slate">
            {club.meets} · {club.time}
            <br />
            {club.room}
            <br />
            {club.school}
          </p>
        </div>

        <nav aria-label="Footer">
          <ul className="grid gap-2">
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="footer-link">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/request" className="footer-link">
                Request a print
              </Link>
            </li>
          </ul>
        </nav>

        <dl className="grid gap-4">
          <div>
            <dt className="label">Club contact</dt>
            <dd className="mt-1">
              <a
                href={`mailto:${club.contactEmail}`}
                className="footer-link break-all font-display font-bold"
              >
                {club.contactEmail}
              </a>
            </dd>
          </div>
          <div>
            <dt className="label">Club sponsor</dt>
            <dd className="mt-1 text-sm text-slate">
              {club.sponsorName} ·{" "}
              <a href={`mailto:${club.sponsorEmail}`} className="footer-link">
                {club.sponsorEmail}
              </a>
            </dd>
          </div>
        </dl>

        <div className="text-sm text-slate sm:col-span-2 lg:col-span-1">
          <p>Copyright © 2026 William Wen. All rights reserved.</p>
          {CREDITS.length > 0 && (
            /* Required, not decorative: several hero placeholders are CC BY-SA,
               which obliges visible attribution. When the placeholders are
               replaced with club photos this block empties itself. */
            <p className="mt-3 text-xs leading-relaxed">
              Placeholder hero photos via{" "}
              {CREDITS.map((c, i) => (
                <span key={c.url}>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-navy"
                  >
                    {c.licence}
                  </a>
                  {i < CREDITS.length - 1 ? ", " : ""}
                </span>
              ))}{" "}
              on Wikimedia Commons.
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
