import { words } from "./presentation";

export type ChartDatum = { label: string; value: number };

function cleanValue(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Every chart here plots one measure across categories — a magnitude job, not an
 * identity job — so all marks share a single hue and no legend is needed. The
 * filament accents are deliberately absent: signal, mint and mandarin all fall
 * below 3:1 against the paper ground and are illegible as marks or labels.
 */
export default function DashboardChart({
  title,
  data,
  unit,
  trend = false,
}: {
  title: string;
  data: readonly ChartDatum[];
  unit: string;
  trend?: boolean;
}) {
  const normalized = data.map((item) => ({ ...item, value: cleanValue(item.value) }));
  const maximum = Math.max(1, ...normalized.map((item) => item.value));
  const total = normalized.reduce((sum, item) => sum + item.value, 0);
  const shown = trend ? normalized : normalized.slice(0, 8);
  const hidden = normalized.length - shown.length;

  return (
    <figure className="flex h-full flex-col rounded-[var(--radius-card)] border border-mist bg-snow p-5">
      <figcaption className="font-display text-sm font-bold text-ink">{title}</figcaption>

      {!normalized.length || total === 0 ? (
        <p className="mt-4 text-sm text-slate">
          No {unit} recorded yet. This chart fills in as the queue is used.
        </p>
      ) : trend ? (
        <div className="mt-4">
          <ol
            className="flex h-24 items-end gap-[2px]"
            aria-label={`${title}. ${total} ${unit} over ${normalized.length} days, peaking at ${maximum} in a day.`}
          >
            {shown.map((item, index) => (
              <li
                // Position is the identity in a time series; a repeated day
                // label must not collapse two bars into one.
                key={`${item.label}-${index}`}
                className="flex min-w-0 flex-1 items-end"
                title={`${item.label}: ${item.value}`}
              >
                <span
                  className="block min-h-[2px] w-full rounded-t-[3px] bg-navy/75 transition-colors duration-[var(--dur-hover)] hover:bg-ink"
                  style={{ height: `${Math.max(3, (item.value / maximum) * 100)}%` }}
                  aria-hidden="true"
                />
              </li>
            ))}
          </ol>
          <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-mist pt-2 text-xs text-slate">
            <span className="tnum font-mono">{shown[0]?.label}</span>
            <span className="tnum">
              <strong className="font-bold text-ink">{total}</strong> total · peak{" "}
              <strong className="font-bold text-ink">{maximum}</strong>
            </span>
            <span className="tnum font-mono">{shown.at(-1)?.label}</span>
          </div>
        </div>
      ) : (
        <>
          <ol className="mt-4 space-y-2.5">
            {shown.map((item) => (
              <li key={item.label}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-ink">{words(item.label)}</span>
                  <span className="tnum font-mono font-bold text-ink">{item.value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-[2px] bg-cloud" aria-hidden="true">
                  <div
                    className="h-full rounded-r-[3px] bg-navy/75"
                    style={{ width: `${Math.max(2, (item.value / maximum) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
          {hidden > 0 && (
            <p className="mt-3 text-xs text-slate">
              {hidden} smaller categor{hidden === 1 ? "y" : "ies"} not shown.
            </p>
          )}
        </>
      )}
    </figure>
  );
}
