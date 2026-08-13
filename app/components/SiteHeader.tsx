"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { club, nav } from "../lib/content";

export default function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-mist bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 md:h-[4.5rem]">
        <Link
          href="/"
          aria-label={`${club.name} — Home`}
          className="flex min-w-0 shrink-0 items-center gap-2.5"
          onClick={() => setMenuOpen(false)}
        >
          <Image
            src="/img/logo.png"
            alt=""
            width={699}
            height={902}
            className="h-8 w-auto md:h-9"
          />
          <span className="hidden flex-col leading-none sm:flex">
            <span className="font-display text-[15px] font-extrabold tracking-[-0.025em] text-ink">
              CBSS
            </span>
            <span className="mt-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-slate">
              3D Printing Club
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2 lg:gap-3">
          <nav aria-label="Main navigation" className="hidden lg:block">
            <ul className="flex items-center gap-0.5">
              {nav.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`inline-flex min-h-11 items-center rounded-[var(--radius-pill)] px-4 font-display text-[14px] font-semibold transition-colors ${
                        active
                          ? "bg-cloud text-ink"
                          : "text-slate hover:bg-cloud hover:text-ink"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
              <li>
                <Link
                  href="/about#join"
                  className="inline-flex min-h-11 items-center rounded-[var(--radius-pill)] px-4 font-display text-[14px] font-semibold text-slate transition-colors hover:bg-cloud hover:text-ink"
                >
                  Join the club
                </Link>
              </li>
            </ul>
          </nav>

          <Link
            href="/request"
            aria-current={pathname === "/request" ? "page" : undefined}
            className="inline-flex min-h-11 items-center rounded-[var(--radius-pill)] bg-signal px-4 font-display text-[14px] font-bold text-ink transition-colors hover:bg-ink hover:text-white sm:px-5"
            onClick={() => setMenuOpen(false)}
          >
            <span className="sm:hidden">Request</span>
            <span className="hidden sm:inline">Request a print</span>
          </Link>

          <button
            type="button"
            className="inline-grid size-11 place-items-center rounded-full border border-mist text-ink transition-colors hover:border-navy hover:bg-cloud lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none">
                <path d="M5 5L19 19M19 5L5 19" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none">
                <path d="M4 7H20M4 12H20M4 17H20" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="mobile-navigation"
          aria-label="Mobile navigation"
          className="border-t border-mist bg-white px-5 pb-6 pt-3 lg:hidden"
        >
          <ul className="mx-auto grid max-w-6xl">
            {nav.map((item) => (
              <li key={item.href} className="border-b border-mist">
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className="flex min-h-14 items-center justify-between font-display text-lg font-bold text-ink"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                  <span aria-hidden="true" className="font-mono text-sm text-slate">
                    →
                  </span>
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/about#join"
                className="flex min-h-14 items-center justify-between font-display text-lg font-bold text-ink"
                onClick={() => setMenuOpen(false)}
              >
                Join the club
                <span aria-hidden="true" className="font-mono text-sm text-slate">
                  →
                </span>
              </Link>
            </li>
          </ul>
          <p className="mx-auto mt-4 max-w-6xl font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-slate">
            {club.meets} · {club.time} · {club.room}
          </p>
        </nav>
      )}
    </header>
  );
}
