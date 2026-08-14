import { words } from "./presentation";

export type ChartDatum = { label: string; value: number };

function cleanValue(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export default function DashboardChart({
  title,
  data,
  trend = false,
}: {
  title: string;
  data: readonly ChartDatum[];
  trend?: boolean;
}) {
  const normalized = data.map((item) => ({ ...item, value: cleanValue(item.value) }));
  const maximum = Math.max(1, ...normalized.map((item) => item.value));

  return (
    <figure className="rounded-[20px] border border-mist bg-white p-5 shadow-[0_1px_2px_rgb(18_23_43/0.05)]">
      <figcaption className="font-display text-base font-bold text-ink">{title}</figcaption>
      {!normalized.length ? (
        <p className="mt-5 text-sm text-slate">No data yet.</p>
      ) : trend ? (
        <div className="mt-5">
          <ol
            className="flex h-28 items-end gap-1"
            aria-label={`${title}, ${normalized.length} plotted days`}
          >
            {normalized.map((item) => (
              <li
                key={item.label}
                className="group relative flex min-w-0 flex-1 items-end"
                aria-label={`${item.label}: ${item.value}`}
                title={`${item.label}: ${item.value}`}
              >
                <span
                  className="block min-h-1 w-full rounded-t bg-navy group-hover:bg-signal"
                  style={{ height: `${Math.max(4, (item.value / maximum) * 100)}%` }}
                  aria-hidden="true"
                />
              </li>
            ))}
          </ol>
          <div className="mt-2 flex justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.04em] text-slate">
            <span>{normalized[0]?.label}</span>
            <span>{normalized.at(-1)?.label}</span>
          </div>
        </div>
      ) : (
        <ol className="mt-5 space-y-3">
          {normalized.slice(0, 8).map((item) => (
            <li key={item.label}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 truncate font-semibold text-ink">{words(item.label)}</span>
                <span className="tnum font-mono text-slate">{item.value}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-mist" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-navy"
                  style={{ width: `${(item.value / maximum) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </figure>
  );
}

