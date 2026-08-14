import Link from "next/link";
import AdminHeader from "@/app/components/admin/AdminHeader";
import DashboardChart from "@/app/components/admin/DashboardChart";
import QueueTable, { type QueueTableRow } from "@/app/components/admin/QueueTable";
import { statusLabel } from "@/app/components/admin/presentation";
import {
  getAdminDashboard,
  parseDashboardFilters,
  type DashboardFilters,
} from "@/app/lib/admin/dashboard";
import { FILAMENT_COLORS } from "@/app/lib/filament-colors";
import { MATERIAL_KINDS, REQUEST_STATUSES } from "@/app/lib/queue/domain";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function csvHref(filters: DashboardFilters): string {
  const query = new URLSearchParams();
  for (const status of filters.statuses) query.append("status", status);
  if (filters.material) query.set("material", filters.material);
  if (filters.createdFrom) query.set("from", filters.createdFrom);
  if (filters.createdTo) query.set("to", filters.createdTo);
  if (filters.search) query.set("search", filters.search);
  query.set("sort", filters.sort);
  query.set("direction", filters.direction);
  return `/api/admin/export?${query.toString()}`;
}

function StatTile({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <article className="rounded-[20px] border border-mist bg-white p-5 shadow-[0_1px_2px_rgb(18_23_43/0.05)]">
      <p className="eyebrow text-slate">{label}</p>
      <p className="tnum mt-3 font-display text-4xl font-bold tracking-[-0.05em] text-ink">{value}</p>
      {note && <p className="mt-2 text-xs text-slate">{note}</p>}
    </article>
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
  const medianLabel = median == null ? "—" : `${median.toFixed(1)} d`;

  return (
    <div className="min-w-0">
      <section className="build-grid-dark bg-ink px-5 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <AdminHeader admin={dashboard.admin} />
          <div className="mt-10 max-w-3xl">
            <p className="eyebrow text-signal">CBSS Print Queue</p>
            <h1 className="mt-4 text-[clamp(3rem,8vw,6rem)]">Queue control</h1>
            <p className="mt-5 max-w-[55ch] text-lg text-white/70">
              Review requests, move printable models through the workflow, and keep requester
              updates tied to the event history.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-5 py-10 sm:py-14">
        <section aria-labelledby="queue-overview-title">
          <h2 id="queue-overview-title" className="text-3xl text-ink">Queue overview</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatTile label="Open" value={dashboard.stats.open} />
            <StatTile label="In progress" value={dashboard.stats.inProgress} />
            <StatTile label="Ready" value={dashboard.stats.ready} />
            <StatTile label="Picked up this month" value={dashboard.stats.completedThisMonth} />
            <StatTile
              label="Median completion"
              value={medianLabel}
              note="Historical submitted-to-pickup time"
            />
          </div>
        </section>

        <section aria-labelledby="queue-patterns-title">
          <div className="max-w-2xl">
            <h2 id="queue-patterns-title" className="text-3xl text-ink">Queue patterns</h2>
            <p className="mt-3 text-sm text-slate">
              Counts summarize the current database. They are operational history, not a promised
              completion time.
            </p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <DashboardChart
              title="Requests over the last 30 days"
              data={dashboard.charts.requestsOverTime.map((item) => ({
                label: item.label,
                value: Number(item.value),
              }))}
              trend
            />
            <DashboardChart
              title="Material requests"
              data={dashboard.charts.materialSplit.map((item) => ({
                label: item.label,
                value: Number(item.value),
              }))}
            />
            <DashboardChart
              title="Current status"
              data={dashboard.charts.statusDistribution.map((item) => ({
                label: item.label,
                value: Number(item.value),
              }))}
            />
            <DashboardChart
              title="Print failure reasons"
              data={dashboard.charts.failureReasons.map((item) => ({
                label: item.label,
                value: Number(item.value),
              }))}
            />
          </div>
        </section>

        <section id="requests" aria-labelledby="request-pipeline-title">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="request-pipeline-title" className="text-3xl text-ink">Request pipeline</h2>
              <p className="mt-3 text-sm text-slate">
                Showing {rows.length} request{rows.length === 1 ? "" : "s"}. Results are capped at
                250; narrow the filters when the cap is reached.
              </p>
            </div>
            <Link href={csvHref(filters)} className="btn btn--secondary btn--sm">
              Export completed CSV
            </Link>
          </div>

          <form
            method="get"
            className="mt-6 rounded-[20px] border border-mist bg-white p-5 sm:p-6"
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
              <legend className="text-sm font-bold text-ink">Statuses</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {REQUEST_STATUSES.map((status) => (
                  <label key={status} className="flex min-h-11 items-center gap-2 rounded-xl border border-mist bg-cloud px-3 py-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      name="status"
                      value={status}
                      defaultChecked={filters.statuses.includes(status)}
                      className="size-4 accent-navy"
                    />
                    <span>{statusLabel(status)}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-5 flex flex-wrap gap-3">
              <button type="submit" className="btn btn--dark">Apply filters</button>
              <Link href="/admin#requests" className="btn btn--secondary">Clear filters</Link>
            </div>
          </form>

          <div className="mt-6">
            <QueueTable rows={rows} />
          </div>
        </section>
      </div>
    </div>
  );
}
