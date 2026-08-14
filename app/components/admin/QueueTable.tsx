"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import {
  bulkTransitionAction,
  type AdminActionState,
} from "@/app/admin/actions";
import {
  DECLINED_REASON_KEYS,
  NEEDS_CHANGES_REASON_KEYS,
  PRINT_FAILED_REASON_KEYS,
  REQUEST_STATUSES,
  type RequestStatus,
} from "@/app/lib/queue/domain";
import ActionMessage from "./ActionMessage";
import {
  formatAdminDate,
  statusLabel,
  statusPillClass,
  words,
} from "./presentation";

export type QueueTableRow = {
  id: string;
  ref: string;
  requesterName: string;
  requesterEmail: string;
  createdAt: string;
  deadline: string | null;
  quantity: number;
  material: string;
  colorNames: string[];
  currentStatus: RequestStatus;
  version: number;
  assigneeName: string | null;
  fileName: string | null;
};

const INITIAL_STATE: AdminActionState = { tone: "idle", message: "" };

function reasonsFor(status: RequestStatus): readonly string[] {
  if (status === "print_failed") return PRINT_FAILED_REASON_KEYS;
  if (status === "needs_changes") return NEEDS_CHANGES_REASON_KEYS;
  if (status === "declined") return DECLINED_REASON_KEYS;
  return [];
}

export default function QueueTable({ rows }: { rows: QueueTableRow[] }) {
  const [state, action, pending] = useActionState(bulkTransitionAction, INITIAL_STATE);
  const [targetStatus, setTargetStatus] = useState<RequestStatus>("under_review");
  const [selectedCount, setSelectedCount] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const reasons = reasonsFor(targetStatus);

  function recount() {
    const selected = formRef.current?.querySelectorAll<HTMLInputElement>(
      'input[name="requests"]:checked',
    );
    setSelectedCount(selected?.length ?? 0);
  }

  function setEveryRow(checked: boolean) {
    formRef.current
      ?.querySelectorAll<HTMLInputElement>('input[name="requests"]')
      .forEach((input, index) => {
        input.checked = checked && index < 50;
      });
    recount();
  }

  return (
    <form ref={formRef} action={action} className="space-y-5">
      <div className="overflow-x-auto rounded-[20px] border border-mist bg-white">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <caption className="sr-only">Filtered print request queue</caption>
          <thead className="bg-cloud text-xs uppercase tracking-[0.05em] text-slate">
            <tr>
              <th scope="col" className="w-12 px-4 py-3">
                <span className="sr-only">Select</span>
              </th>
              <th scope="col" className="px-3 py-3">Request</th>
              <th scope="col" className="px-3 py-3">Requester</th>
              <th scope="col" className="px-3 py-3">Created</th>
              <th scope="col" className="px-3 py-3">Material</th>
              <th scope="col" className="px-3 py-3">Quantity</th>
              <th scope="col" className="px-3 py-3">Status</th>
              <th scope="col" className="px-3 py-3">Assigned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mist">
            {rows.map((row) => (
              <tr key={row.id} className="align-top hover:bg-cloud/70">
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    name="requests"
                    value={`${row.id}:${row.version}`}
                    aria-label={`Select ${row.ref}`}
                    onChange={recount}
                    className="size-4 accent-navy"
                  />
                </td>
                <th scope="row" className="px-3 py-4 font-normal">
                  <Link
                    href={`/admin/requests/${row.id}`}
                    className="font-display font-bold text-navy underline decoration-navy/30 underline-offset-4 hover:decoration-navy"
                  >
                    {row.ref}
                  </Link>
                  <span className="mt-1 block max-w-44 truncate text-xs text-slate">
                    {row.fileName ?? "Link only"}
                  </span>
                </th>
                <td className="px-3 py-4">
                  <span className="block font-semibold text-ink">{row.requesterName}</span>
                  <span className="block max-w-52 truncate text-xs text-slate">
                    {row.requesterEmail}
                  </span>
                </td>
                <td className="px-3 py-4 text-slate">
                  <span className="block whitespace-nowrap">{formatAdminDate(row.createdAt)}</span>
                  {row.deadline && (
                    <span className="mt-1 block whitespace-nowrap text-xs">
                      Due {formatAdminDate(`${row.deadline}T12:00:00-07:00`)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-4">
                  <span className="font-mono text-xs font-bold uppercase text-ink">
                    {row.material}
                  </span>
                  <span className="mt-1 block max-w-40 truncate text-xs text-slate">
                    {row.colorNames.length ? row.colorNames.join(", ") : "No preference"}
                  </span>
                </td>
                <td className="tnum px-3 py-4 font-mono text-ink">{row.quantity}</td>
                <td className="px-3 py-4">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusPillClass(row.currentStatus)}`}
                  >
                    {statusLabel(row.currentStatus)}
                  </span>
                </td>
                <td className="px-3 py-4 text-slate">{row.assigneeName ?? "Unassigned"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="border-t border-mist px-5 py-10 text-center text-slate">
            No requests match these filters.
          </p>
        )}
      </div>

      {rows.length > 0 && (
        <div className="rounded-[20px] border border-mist bg-cloud p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-sm font-bold text-ink">
              {selectedCount} selected
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setEveryRow(true)}
              >
                Select first 50
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setEveryRow(false)}
              >
                Clear
              </button>
            </div>
          </div>

          <fieldset className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_2fr_auto] xl:items-end">
            <legend className="sr-only">Bulk status update</legend>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-ink">New status</span>
              <select
                name="toStatus"
                value={targetStatus}
                onChange={(event) => setTargetStatus(event.target.value as RequestStatus)}
                className="field w-full"
              >
                {REQUEST_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
            </label>

            {reasons.length ? (
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-ink">Reason</span>
                <select name="reasonKey" className="field w-full" required>
                  {reasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {words(reason)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <input type="hidden" name="reasonKey" value="" />
            )}

            <label className="block md:col-span-2 xl:col-span-1">
              <span className="mb-2 block text-sm font-bold text-ink">
                Requester-visible note <span className="font-normal text-slate">(optional)</span>
              </span>
              <input
                name="requesterVisibleNote"
                type="text"
                maxLength={4000}
                className="field w-full"
                placeholder="Appears on each selected request's private status page"
              />
            </label>

            <button
              type="submit"
              className="btn btn--dark w-full xl:w-auto"
              disabled={pending || selectedCount === 0}
            >
              {pending ? "Updating…" : "Update selected"}
            </button>
          </fieldset>
          <p className="mt-3 text-xs text-slate">
            Illegal or stale rows are skipped. At most 50 requests can be updated at once.
          </p>
        </div>
      )}

      <ActionMessage state={state} />
    </form>
  );
}
