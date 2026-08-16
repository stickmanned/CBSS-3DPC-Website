import Link from "next/link";
import AttentionBand from "@/app/components/admin/AttentionBand";
import DashboardChart from "@/app/components/admin/DashboardChart";
import QueueTable, { type QueueTableRow } from "@/app/components/admin/QueueTable";
import { statusLabel } from "@/app/components/admin/presentation";
import {
  getAdminDashboard,
  parseDashboardFilters,
  PIPELINE_LIMIT,
  STALE_AFTER_DAYS,
  type DashboardFilters,
  type PresetView,
} from "@/app/lib/admin/dashboard";
import { FILAMENT_COLORS } from "@/app/lib/filament-colors";
import { MATERIAL_KINDS, REQUEST_STATUSES } from "@/app/lib/queue/domain";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const PRESETS: Array<{ view: PresetView; label: string; href: string }> = [
  { view: "focus", label: "Everything open", href: "/admin#pipeline" },
  { view: "triage", label: "Needs triage", href: "/admin?view=triage#pipeline" },
  { view: "printing", label: "In production", href: "/admin?view=printing#pipeline" },
  { view: "ready", label: "Ready for pickup", href: "/admin?view=ready#pipeline" },
  { view: "overdue", label: "Past deadline", href: "/admin?view=overdue#pipeline" },
  { view: "all", label: "Everything ever", href: "/admin?view=all#pipeline" },
];

/**
 * The export is deliberately limited to picked-up requests, so it only accepts
 * the filters it actually honours. Passing status or material here would imply
 * the on-screen view carries across when it does not.
 */
function csvHref(filters: DashboardFilters): string {
  const query = new URLSearchParams();
  if (filters.createdFrom) query.set("from", filters.createdFrom);
  if (filters.createdTo) query.set("to", filters.createdTo);
  if (filters.search) query.set("search", filters.search);
  const suffix = query.toString();
  return suffix ? `/api/admin/export?${suffix}` : "/api/admin/export";
}

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-mist py-2.5 first:border-t-0 first:pt-0">
      <dt className="text-sm text-slate">{label}</dt>
      <dd className="tnum text-right font-mono text-lg font-bold text-ink">
        {value}
        {note && <span className="ml-2 text-xs font-normal text-slate">{note}</span>}
      </dd>
    </div>
  );
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const rawFilters = await searchParams;
  const filters = parseDashboardFilters(rawFilters);
  const dashboard = await getAdminDashboard(filters);
  const colorsBySlug = new Map(FILAMENT_COLORS.map((color) => [color.slug, color.name]));
  const rows: QueueTableRow[] = dashboard.pipeline.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    colorNames: row.colors.map((slug) => colorsBySlug.get(slug) ?? slug),
  }));

  const median = dashboard.stats.medianDays;
  const activeView = filters.stalledOnly ? "custom" : filters.view;
  const atCap = rows.length === PIPELINE_LIMIT;

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-10 px-5 py-8 sm:space-y-14 sm:py-10">
      <AttentionBand admin={dashboard.admin} attention={dashboard.attention} />

      <section id="pipeline" aria-labelledby="pipeline-title" className="scroll-mt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 id="pipeline-title" className="text-3xl text-ink">
              The pipeline
            </h2>
            <p className="mt-2 text-sm text-slate">
              {rows.length} request{rows.length === 1 ? "" : "s"} in this view
              {filters.sort === "urgency" ? ", most urgent first" : ""}
              {filters.stalledOnly ? `, untouched ${STALE_AFTER_DAYS}+ days` : ""}.
              {atCap && ` Capped at ${PIPELINE_LIMIT} — narrow the filters to see the rest.`}
            </p>
          </div>
          <Link href={csvHref(filters)} className="btn btn--secondary btn--sm whitespace-nowrap">
            Export completed CSV
          </Link>
        </div>

        <nav aria-label="Queue views" className="mt-6">
          <ul className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => {
              const current = preset.view === activeView;
              return (
                <li key={preset.view}>
                  <Link
                    href={preset.href}
                    aria-current={current ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-[var(--radius-pill)] border px-4 text-sm font-bold transition-colors duration-[var(--dur-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ${
                      current
                        ? "border-ink bg-ink text-snow"
                        : "border-mist bg-snow text-slate hover:border-ink hover:text-ink"
                    }`}
                  >
                    {preset.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <details className="group mt-4 rounded-[var(--radius-card)] border border-mist bg-snow">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-sm font-bold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy">
            Search and filter
            <span
              aria-hidden="true"
              className="text-slate transition-transform duration-[var(--dur-hover)] group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <form
            method="get"
            className="border-t border-mist p-5"
            aria-label="Filter print requests"
          >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-bold text-ink">Request reference</span>
                <input
                  type="search"
                  name="search"
                  defaultValue={filters.search ?? ""}
                  maxLength={9}
                  pattern="CBSS-[0-9]{1,4}"
                  className="field w-full"
                  placeholder="CBSS-0042"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-ink">Material</span>
                <select name="material" defaultValue={filters.material ?? ""} className="field w-full">
                  <option value="">All materials</option>
                  {MATERIAL_KINDS.map((material) => (
                    <option key={material} value={material}>{material.toUpperCase()}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-ink">Sort</span>
                <select name="sort" defaultValue={filters.sort} className="field w-full">
                  <option value="urgency">Urgency</option>
                  <option value="created">Created date</option>
                  <option value="deadline">Deadline</option>
                  <option value="quantity">Quantity</option>
                  <option value="status">Status</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-ink">Created from</span>
                <input type="date" name="from" defaultValue={filters.createdFrom ?? ""} className="field w-full" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-ink">Created to</span>
                <input type="date" name="to" defaultValue={filters.createdTo ?? ""} className="field w-full" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-ink">Direction</span>
                <select name="direction" defaultValue={filters.direction} className="field w-full">
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </label>
            </div>

            <fieldset className="mt-5">
              <legend className="text-sm font-bold text-ink">
                Statuses <span className="font-normal text-slate">(leave empty to keep the current view)</span>
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {REQUEST_STATUSES.map((status) => (
                  <label
                    key={status}
                    className="flex min-h-11 items-center gap-2 rounded-[var(--radius-chip)] border border-mist bg-paper px-3 py-2 text-sm text-ink"
                  >
                    <input
                      type="checkbox"
                      name="status"
                      value={status}
                      defaultChecked={filters.view === "custom" && filters.statuses.includes(status)}
                      className="size-4 accent-navy"
                    />
                    <span>{statusLabel(status)}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-5 flex flex-wrap gap-3">
              <button type="submit" className="btn btn--dark whitespace-nowrap">Apply filters</button>
              <Link href="/admin#pipeline" className="btn btn--secondary whitespace-nowrap">Reset</Link>
            </div>
          </form>
        </details>

        <div className="mt-5">
          <QueueTable rows={rows} staleAfterDays={STALE_AFTER_DAYS} />
        </div>
      </section>

      <section aria-labelledby="patterns-title">
        <h2 id="patterns-title" className="text-3xl text-ink">
          Patterns
        </h2>
        <p className="mt-2 max-w-[58ch] text-sm text-slate">
          Operational history from the current database. Useful for planning stock and club time —
          not a promised completion time.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <section
            aria-labelledby="at-a-glance-title"
            className="rounded-[var(--radius-card)] border border-mist bg-snow p-5"
          >
            <h3 id="at-a-glance-title" className="text-sm text-ink">
              At a glance
            </h3>
            <dl className="mt-4">
              <Stat label="Open" value={dashboard.stats.open} />
              <Stat label="In progress" value={dashboard.stats.inProgress} />
              <Stat label="Ready for pickup" value={dashboard.stats.ready} />
              <Stat label="Picked up this month" value={dashboard.stats.completedThisMonth} />
              <Stat
                label="Median submitted → pickup"
                value={median == null ? "—" : median.toFixed(1)}
                note={median == null ? "no history yet" : "days"}
              />
            </dl>
          </section>

          <div className="md:col-span-2">
            <DashboardChart
              title="Requests over the last 30 days"
              unit="requests"
              trend
              data={dashboard.charts.requestsOverTime.map((item) => ({
                label: item.label,
                value: Number(item.value),
              }))}
            />
          </div>

          <DashboardChart
            title="Material requested"
            unit="requests"
            data={dashboard.charts.materialSplit.map((item) => ({
              label: item.label.toUpperCase(),
              value: Number(item.value),
            }))}
          />
          <DashboardChart
            title="Current status"
            unit="requests"
            data={dashboard.charts.statusDistribution.map((item) => ({
              label: statusLabel(item.label),
              value: Number(item.value),
            }))}
          />
          <DashboardChart
            title="Print failure reasons"
            unit="failures"
            data={dashboard.charts.failureReasons.map((item) => ({
              label: item.label,
              value: Number(item.value),
            }))}
          />
        </div>
      </section>
    </div>
  );
}
