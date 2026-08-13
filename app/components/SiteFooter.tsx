import { club } from "../lib/content";

export default function SiteFooter() {
  return (
    <footer className="mt-20">
      <div className="h-[3px] bg-navy" />
      <div className="mx-auto max-w-5xl px-6 py-6 flex flex-wrap justify-between gap-3">
        <p className="data text-silver">
          {club.short.toUpperCase()} · {club.room.toUpperCase()} · {club.district}
        </p>
        <p className="data text-silver">
          RUN BY STUDENTS SINCE {club.foundedYear}
        </p>
      </div>
    </footer>
  );
}
