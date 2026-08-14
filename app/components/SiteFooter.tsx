import Link from "next/link";
import Button from "./Button";
import { club, nav } from "../lib/content";

export default function SiteFooter() {
  return (
    <footer className="relative isolate overflow-hidden bg-ink text-white">
      <div aria-hidden="true" className="build-grid-dark absolute inset-0 -z-10 opacity-50" />

      <div className="mx-auto max-w-6xl px-5 py-20 md:py-24">
        <div className="grid gap-10 border-b border-white/15 pb-16 lg:grid-cols-[1fr_.8fr] lg:items-end">
          <div>
            <p className="eyebrow text-signal">The next layer is yours</p>
            <h2 className="mt-5 max-w-[9ch] text-5xl sm:text-6xl md:text-7xl">
              Make something amazing
            </h2>
          </div>

          <div>
            <p className="max-w-[42ch] text-lg leading-relaxed text-white/70">
              Request a print, or join the club on {club.meets.toLowerCase()} from {" "}
              {club.time} in {club.room}.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button href="/request">
                Request a print <span aria-hidden="true">→</span>
              </Button>
              <Button href="/about#join" variant="light">
                Join the club <span aria-hidden="true">→</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-10 pt-12 sm:grid-cols-2 lg:grid-cols-[1fr_.8fr_1.2fr]">
          <div>
            <p className="eyebrow text-white/60">Dr. Charles Best 3D Printing Club</p>
            <p className="mt-4 font-display text-lg font-bold">
              {club.meets} · {club.time}
            </p>
            <p className="mt-1 text-white/70">{club.room}</p>
            <p className="text-white/70">{club.school}</p>
          </div>

          <div>
            <p className="eyebrow text-white/60">Explore</p>
            <ul className="mt-4 grid gap-2.5">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="footer-link">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="eyebrow text-white/60">Contact</p>
            <dl className="mt-4 grid gap-5">
              <div>
                <dt className="text-sm text-white/60">Club contact</dt>
                <dd>
                  <a
                    href={`mailto:${club.contactEmail}`}
                    className="footer-link break-all font-display font-bold !text-white hover:!text-signal"
                  >
                    {club.contactEmail}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-white/60">Club sponsor</dt>
                <dd className="text-white/75">
                  {club.sponsorName} ·{" "}
                  <a href={`mailto:${club.sponsorEmail}`} className="footer-link">
                    {club.sponsorEmail}
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        </div>
        <p className="mt-14 border-t border-white/10 pt-6 font-mono text-[10px] font-semibold uppercase tracking-[0.11em] text-white/55">
          Copyright © 2026 William Wen. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
