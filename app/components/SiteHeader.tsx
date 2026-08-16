"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { club, nav } from "../lib/content";

/* Fires the click comet. `:active` would end the moment the pointer lifts and
   cut the orbit off mid-lap, so the class is applied here and torn down when
   the animation reports itself finished. Removing it first and reading
   offsetWidth restarts the animation on a rapid second click.

   The teardown uses a native listener rather than React's `onAnimationEnd`:
   these animations run on ::before/::after, and the synthetic event does not
   fire for pseudo-element animations, which left the class stuck on. */
const orbit = {
  onPointerDown(event: React.PointerEvent<HTMLElement>) {
    const el = event.currentTarget;
    el.classList.remove("is-orbiting");
    void el.offsetWidth;
    el.classList.add("is-orbiting");

    /* Two ways out, because animationend is not guaranteed: a backgrounded tab
       defers it, and it never arrives at all if the animation is interrupted.
       Without the timer a dropped event would leave the ring lit permanently. */
    const clear = () => {
      el.classList.remove("is-orbiting");
      el.removeEventListener("animationend", onEnd);
      window.clearTimeout(timer);
    };
    const onEnd = (e: AnimationEvent) => {
      if (e.animationName === "orbit-aura") clear();
    };
    const timer = window.setTimeout(clear, 1900);
    el.addEventListener("animationend", onEnd);
  },
};

export default function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let animationFrame: number | null = null;

    function updateProgress() {
      animationFrame = null;
      setScrolled(window.scrollY > 8);
    }

    function handleScroll() {
      if (animationFrame === null) animationFrame = window.requestAnimationFrame(updateProgress);
    }

    updateProgress();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [menuOpen]);

  return (
    <header
      data-scrolled={scrolled ? "true" : "false"}
      className="site-header sticky top-0 z-50 border-b-2 border-ink bg-snow"
    >
      {/* When and where, on every page, without scrolling — the highest-leverage
          change for "get students to join". Set in the display face at reading
          size: a sentence a person says, not a machine-readable stamp. */}
      <p className="border-b-2 border-ink bg-signal py-2 text-center font-display text-sm font-bold text-ink">
        We meet {club.meets}, {club.time}, in {club.room}.
      </p>

      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 md:h-[4.5rem]">
        <Link
          href="/"
          aria-label={`${club.name} — Home`}
          className="group flex min-w-0 shrink-0 items-center gap-2.5 rounded-xl transition-transform duration-200 active:scale-[0.97]"
          onClick={() => setMenuOpen(false)}
        >
          {/* unslop-ignore — the logo wiggle is a deliberate character moment,
              not a boilerplate hover-grow. It is the only one on the page. */}
          <div className="transition-transform duration-300 [transition-timing-function:var(--ease-spring)] group-hover:scale-110 group-hover:-rotate-3">
            <Image
              src="/img/logo.png"
              alt=""
              width={699}
              height={902}
              className="h-8 w-auto md:h-9"
            />
          </div>
          <span className="hidden flex-col leading-none sm:flex">
            <span className="font-display text-[15px] font-extrabold tracking-[-0.025em] text-ink transition-colors group-hover:text-navy">
              CBSS
            </span>
            <span className="mt-0.5 text-[11px] font-bold text-slate">
              3D Printing Club
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2 lg:gap-3">
          <nav aria-label="Main navigation" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {nav.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className="nav-link orbit"
                      {...orbit}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
              <li>
                <Link href="/about#join" className="nav-link orbit" {...orbit}>
                  Join the club
                </Link>
              </li>
            </ul>
          </nav>

          <Link
            href="/request"
            aria-current={pathname === "/request" || pathname.startsWith("/request/") ? "page" : undefined}
            className="btn btn--primary btn--sm orbit"
            onClick={() => setMenuOpen(false)}
            {...orbit}
          >
            <span className="sm:hidden">Request</span>
            <span className="hidden sm:inline">Request a print</span>
            <span aria-hidden="true">→</span>
          </Link>

          <button
            type="button"
            className="icon-button orbit grid size-11 border border-mist text-ink hover:border-navy hover:bg-cloud lg:hidden"
            {...orbit}
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
          className="mobile-menu-enter border-t border-mist bg-white px-5 pb-6 pt-3 shadow-xl lg:hidden"
        >
          <ul className="mx-auto grid max-w-6xl">
            {nav.map((item) => (
              <li key={item.href} className="border-b border-mist">
                <Link
                  href={item.href}
                  aria-current={
                    pathname === item.href || pathname.startsWith(`${item.href}/`) ? "page" : undefined
                  }
                  className="menu-row flex min-h-14 items-center justify-between rounded-lg font-display text-lg font-bold text-ink hover:text-navy"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                  <span aria-hidden="true" className="text-sm text-slate">
                    →
                  </span>
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/about#join"
                className="flex min-h-14 items-center justify-between font-display text-lg font-bold text-ink transition-colors hover:text-navy"
                onClick={() => setMenuOpen(false)}
              >
                Join the club
                <span aria-hidden="true" className="text-sm text-slate">
                  →
                </span>
              </Link>
            </li>
          </ul>
          <p className="mx-auto mt-4 max-w-6xl text-sm text-slate">
            {club.meets} · {club.time} · {club.room}
          </p>
        </nav>
      )}
    </header>
  );
}
