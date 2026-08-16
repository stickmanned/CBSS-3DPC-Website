import type { Metadata } from "next";
import { Gabarito, Atkinson_Hyperlegible, Fraunces } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { club } from "./lib/content";
import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import "./globals.css";

/* Display: Gabarito. A warm geometric with genuinely odd letterforms — look
   at the a, g and t — so it carries personality at moderate sizes instead of
   needing scale to be interesting. Deliberately not Poppins / Space Grotesk /
   Plus Jakarta Sans, which are the autopilot picks for a friendly brief.

   Body: Atkinson Hyperlegible, drawn by the Braille Institute to keep similar
   letterforms distinguishable — a real reason for a school audience with mixed
   reading ability, not a taste call.

   No third family. The label role is Gabarito at small size; the monospace
   that used to fill it read as a developer tool. Geist Mono stays imported for
   app/admin and app/status, where the values genuinely are tabular data. */
const gabarito = Gabarito({
  subsets: ["latin"],
  variable: "--font-gabarito",
  display: "swap",
});

/* Loaded for the hero A/B only. Fraunces carries a WONK axis that bends
   terminals and bowls off-axis — the closest free face to the reference
   site's custom serif, and the reason it reads handmade rather than
   editorial. If the sans wins the comparison, delete this import. */
const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["WONK", "SOFT", "opsz"],
  variable: "--font-serif",
  display: "swap",
});

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-atkinson",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${club.name} | ${club.school}`,
    template: `%s | ${club.name}`,
  },
  description: `Explore student 3D printing at ${club.school}. Request a print or join the club ${club.meets.toLowerCase()} from ${club.time} in ${club.room}.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${gabarito.variable} ${fraunces.variable} ${atkinson.variable} ${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="min-h-screen flex flex-col">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
