"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { club, nav } from "../lib/content";
import MarkerUnderline from "./MarkerUnderline";

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header>
      <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <Image
            src="/img/logo.png"
            alt=""
            width={699}
            height={902}
            className="h-[30px] w-auto"
            priority
          />
          <span className="font-display font-extrabold text-navy tracking-tight text-base">
            {club.short}
          </span>
        </Link>

        <nav aria-label="Main">
          <ul className="flex flex-wrap gap-x-6 gap-y-1 justify-end">
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`font-display font-bold text-[15px] transition-colors ${
                      active ? "text-navy" : "text-silver hover:text-navy"
                    }`}
                  >
                    {active ? <MarkerUnderline>{item.label}</MarkerUnderline> : item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
      <div className="h-[3px] bg-navy" />
    </header>
  );
}
