import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { club } from "./lib/content";
import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${club.name} — ${club.room}`,
    template: `%s — ${club.short}`,
  },
  description: `One printer, ${club.room} at ${club.school}. Bring us a file and we'll print it, free, for any student.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
