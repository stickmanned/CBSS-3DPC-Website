import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Print queue admin",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-w-0 bg-cloud/60">{children}</div>;
}

