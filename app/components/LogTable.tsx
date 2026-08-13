import Link from "next/link";
import { log, fmtDate, logStats, type LogEntry } from "../lib/content";

/**
 * The Log — the signature element of this site.
 *
 * A dated record of every print the club has run, failures included.
 * The failure notes are the point: members graduate every year and
 * take what they learned with them unless it's written down.
 */
export default function LogTable({
  limit,
  showLink = false,
}: {
  limit?: number;
  showLink?: boolean;
}) {
  const rows: LogEntry[] = limit ? log.slice(0, limit) : log;
  const { total, done, failed } = logStats();

  return (
    <section className="bg-navy px-6 py-7 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-paper/20 pb-3">
          <h2 className="data uppercase tracking-[0.16em] text-signal">
            {limit ? `The Log — last ${rows.length}` : "The Log"}
          </h2>
          {showLink ? (
            <Link href="/log" className="data text-silver hover:text-paper">
              All {total} &rarr;
            </Link>
          ) : (
            <p className="data text-silver">
              {total} prints · {done} finished · {failed} didn&rsquo;t
            </p>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="py-8 text-paper max-w-prose">
            Nothing logged yet. The next print that comes off the bed goes here —
            including if it fails, especially if it fails.
          </p>
        ) : (
          <ul className="divide-y divide-paper/10">
            {rows.map((e, i) => (
              <li
                key={`${e.date}-${i}`}
                className="grid grid-cols-[4.5rem_1fr_auto] gap-x-4 gap-y-1 py-3 sm:grid-cols-[4.5rem_1fr_7rem_5rem_1.5rem] sm:items-baseline"
              >
                <span className="data text-silver">{fmtDate(e.date)}</span>

                <div className="min-w-0">
                  <p className="font-display font-bold text-paper text-[15px]">
                    {e.title}
                    {e.who && (
                      <span className="font-body font-normal text-silver"> · {e.who}</span>
                    )}
                  </p>
                  {e.note && (
                    <p className="font-body italic text-silver text-sm mt-0.5">{e.note}</p>
                  )}
                </div>

                <span
                  className={`text-lg leading-none justify-self-end sm:order-last ${
                    e.ok ? "text-signal" : "text-silver"
                  }`}
                  title={e.ok ? "Finished" : "Failed"}
                >
                  {e.ok ? "✓" : "✗"}
                  <span className="sr-only">{e.ok ? "Finished" : "Failed"}</span>
                </span>

                <span className="data text-silver col-start-2 sm:col-start-3 sm:text-right">
                  {e.material} · {e.colour}
                </span>
                <span className="data text-silver sm:text-right">{e.duration}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
