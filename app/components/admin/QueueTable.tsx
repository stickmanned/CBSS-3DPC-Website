"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  bulkTransitionAction,
  deleteRequestAction,
  type AdminActionState,
} from "@/app/admin/actions";
import type { DeadlineRisk } from "@/app/lib/admin/dashboard";
import {
  DECLINED_REASON_KEYS,
  NEEDS_CHANGES_REASON_KEYS,
  PRINT_FAILED_REASON_KEYS,
  REQUEST_STATUSES,
  REQUEST_TRANSITIONS,
  type RequestStatus,
} from "@/app/lib/queue/domain";
import ActionMessage from "./ActionMessage";
import {
  ageClass,
  deadlinePresentation,
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
  ageDays: number;
  untouchedDays: number;
  deadlineRisk: DeadlineRisk;
};

type DeleteTarget = Pick<
  QueueTableRow,
  "id" | "ref" | "requesterName" | "currentStatus" | "fileName" | "version"
>;

const INITIAL_STATE: AdminActionState = { tone: "idle", message: "" };
const BULK_LIMIT = 50;

function reasonsFor(status: RequestStatus): readonly string[] {
  if (status === "print_failed") return PRINT_FAILED_REASON_KEYS;
  if (status === "needs_changes") return NEEDS_CHANGES_REASON_KEYS;
  if (status === "declined") return DECLINED_REASON_KEYS;
  return [];
}

function SelectionControl({
  row,
  checked,
  disabled,
  onChange,
}: {
  row: QueueTableRow;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="-m-2 inline-flex size-11 cursor-pointer items-center justify-center rounded-[var(--radius-chip)]">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={`Select ${row.ref}`}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-navy"
      />
    </label>
  );
}

function DeleteButton({
  row,
  onDelete,
  disabled,
  className = "",
}: {
  row: QueueTableRow;
  onDelete: (row: QueueTableRow) => void;
  disabled: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`btn btn--danger-quiet btn--sm ${className}`}
      aria-label={`Delete print request ${row.ref}`}
      onClick={() => onDelete(row)}
    >
      Delete
    </button>
  );
}

export default function QueueTable({
  rows,
  staleAfterDays,
}: {
  rows: QueueTableRow[];
  staleAfterDays: number;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkState, bulkAction, bulkPending] = useActionState(
    async (previousState: AdminActionState, formData: FormData) => {
      const result = await bulkTransitionAction(previousState, formData);
      if (result.tone === "success" || result.tone === "warning") {
        setSelectedIds(new Set());
      }
      return result;
    },
    INITIAL_STATE,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteRequestAction,
    INITIAL_STATE,
  );
  const [targetStatus, setTargetStatus] = useState<RequestStatus>("under_review");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteAttemptId, setDeleteAttemptId] = useState<string | null>(null);
  const [confirmationRef, setConfirmationRef] = useState("");
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const selectedRows = rows
    .filter((row) => selectedIds.has(row.id))
    .slice(0, BULK_LIMIT);
  const selectedCount = selectedRows.length;
  const bulkStatusOptions = selectedCount
    ? REQUEST_STATUSES.filter((status) =>
        selectedRows.every((row) => REQUEST_TRANSITIONS[row.currentStatus].includes(status)),
      )
    : [...REQUEST_STATUSES];
  const effectiveTargetStatus = bulkStatusOptions.includes(targetStatus)
    ? targetStatus
    : bulkStatusOptions[0] ?? targetStatus;
  const reasons = reasonsFor(effectiveTargetStatus);
  const bulkUpdateUnavailable = selectedCount > 0 && bulkStatusOptions.length === 0;
  const liveDeleteTarget = deleteTarget
    ? rows.find((row) => row.id === deleteTarget.id) ?? null
    : null;

  useEffect(() => {
    if (!deleteTarget) return;

    const dialog = deleteDialogRef.current;
    if (!liveDeleteTarget) {
      dialog?.close();
      return;
    }
    if (!dialog?.open) {
      dialog?.showModal();
      cancelDeleteRef.current?.focus();
    }
  }, [deleteTarget, liveDeleteTarget]);

  function setRowSelected(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function setEveryRow(checked: boolean) {
    setSelectedIds(
      checked
        ? new Set(rows.slice(0, BULK_LIMIT).map((row) => row.id))
        : new Set(),
    );
  }

  function openDeleteDialog(row: QueueTableRow) {
    setDeleteAttemptId(null);
    setConfirmationRef("");
    setDeleteTarget({
      id: row.id,
      ref: row.ref,
      requesterName: row.requesterName,
      currentStatus: row.currentStatus,
      fileName: row.fileName,
      version: row.version,
    });
  }

  return (
    <div className="space-y-5">
      {!deleteTarget && <ActionMessage state={deleteState} />}

      {!rows.length ? (
        <div className="rounded-[var(--radius-card)] border border-mist bg-snow px-5 py-12 text-center">
          <h3 className="text-xl text-ink">No requests in this view</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate">
            The queue may be clear, or the current view may be hiding the request you need.
          </p>
          <Link href="/admin#pipeline" className="btn btn--secondary btn--sm mt-5">
            Show everything open
          </Link>
        </div>
      ) : (
        <form action={bulkAction} className="space-y-5">
          {selectedRows.map((row) => (
            <input
              key={row.id}
              type="hidden"
              name="requests"
              value={`${row.id}:${row.version}`}
            />
          ))}

          <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-mist bg-cloud p-4 sm:flex-row sm:items-center sm:justify-between">
            <div aria-live="polite">
              <p className="tnum font-display text-sm font-bold text-ink">
                {selectedCount} selected
              </p>
              <p className="mt-0.5 text-xs text-slate">
                Select up to {BULK_LIMIT} requests to change their status together.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                disabled={bulkPending}
                onClick={() => setEveryRow(true)}
              >
                Select first {Math.min(BULK_LIMIT, rows.length)}
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                disabled={bulkPending || selectedCount === 0}
                onClick={() => setEveryRow(false)}
              >
                Clear
              </button>
              {selectedCount > 0 && (
                <a href="#bulk-update" className="btn btn--dark btn--sm">
                  Review update
                </a>
              )}
            </div>
          </div>

          <div className="hidden overflow-x-auto rounded-[var(--radius-card)] border border-mist bg-snow xl:block">
            <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
              <caption className="sr-only">Print request queue</caption>
              <thead className="border-b border-mist bg-cloud font-display text-xs font-bold tracking-[0.02em] text-slate">
                <tr>
                  <th scope="col" className="w-12 px-4 py-3">
                    <span className="sr-only">Select</span>
                  </th>
                  <th scope="col" className="px-3 py-3">Request</th>
                  <th scope="col" className="px-3 py-3">Requester</th>
                  <th scope="col" className="px-3 py-3 text-right">Age</th>
                  <th scope="col" className="px-3 py-3">Deadline</th>
                  <th scope="col" className="px-3 py-3">Print</th>
                  <th scope="col" className="px-3 py-3">Status</th>
                  <th scope="col" className="px-3 py-3">Assigned</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist">
                {rows.map((row) => {
                  const deadline = deadlinePresentation(row.deadlineRisk, row.deadline);
                  return (
                    <tr
                      key={row.id}
                      className={`align-top transition-colors duration-[var(--dur-hover)] hover:bg-paper ${selectedIds.has(row.id) ? "bg-cloud" : ""}`}
                    >
                      <td className="px-4 py-4">
                        <SelectionControl
                          row={row}
                          checked={selectedIds.has(row.id)}
                          disabled={bulkPending || (selectedCount >= BULK_LIMIT && !selectedIds.has(row.id))}
                          onChange={(checked) => setRowSelected(row.id, checked)}
                        />
                      </td>
                      <th scope="row" className="px-3 py-4 font-normal">
                        <Link
                          href={`/admin/requests/${row.id}`}
                          className="tnum inline-flex min-h-7 items-center whitespace-nowrap font-mono font-bold text-navy underline decoration-navy/30 underline-offset-4 transition-colors duration-[var(--dur-hover)] hover:decoration-navy"
                        >
                          {row.ref}
                        </Link>
                        <span className="mt-1 block max-w-36 truncate text-xs text-slate">
                          {row.fileName ?? "Link only"}
                        </span>
                      </th>
                      <td className="px-3 py-4">
                        <span className="block font-bold text-ink">{row.requesterName}</span>
                        <span className="block max-w-44 truncate text-xs text-slate">
                          {row.requesterEmail}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-right">
                        <span
                          className={`tnum block whitespace-nowrap font-mono ${ageClass(row.untouchedDays, staleAfterDays)}`}
                        >
                          {row.ageDays}d
                        </span>
                        <span className="mt-1 block whitespace-nowrap text-xs text-slate">
                          {row.untouchedDays >= staleAfterDays
                            ? `${row.untouchedDays}d untouched`
                            : formatAdminDate(row.createdAt)}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <span className={`block whitespace-nowrap text-xs ${deadline.className}`}>
                          {deadline.label}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <span className="tnum whitespace-nowrap font-mono text-xs font-bold uppercase text-ink">
                          {row.material} ×{row.quantity}
                        </span>
                        <span className="mt-1 block max-w-32 truncate text-xs text-slate">
                          {row.colorNames.length ? row.colorNames.join(", ") : "No preference"}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-[var(--radius-pill)] border px-2.5 py-1 text-xs font-bold ${statusPillClass(row.currentStatus)}`}
                        >
                          {statusLabel(row.currentStatus)}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-slate">
                        {row.assigneeName ?? "Unassigned"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DeleteButton row={row} onDelete={openDeleteDialog} disabled={bulkPending} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="grid gap-3 md:grid-cols-2 xl:hidden" aria-label="Print request queue">
            {rows.map((row) => {
              const deadline = deadlinePresentation(row.deadlineRisk, row.deadline);
              return (
                <li key={row.id}>
                  <article className={`flex h-full flex-col rounded-[var(--radius-card)] border p-4 ${selectedIds.has(row.id) ? "border-navy bg-cloud" : "border-mist bg-snow"}`}>
                    <div className="flex items-start gap-3">
                      <SelectionControl
                        row={row}
                        checked={selectedIds.has(row.id)}
                        disabled={bulkPending || (selectedCount >= BULK_LIMIT && !selectedIds.has(row.id))}
                        onChange={(checked) => setRowSelected(row.id, checked)}
                      />
                      <div className="min-w-0 flex-1">
                        <h3>
                          <Link
                            href={`/admin/requests/${row.id}`}
                            className="tnum inline-flex min-h-7 items-center font-mono text-base font-bold text-navy underline decoration-navy/30 underline-offset-4"
                          >
                            {row.ref}
                          </Link>
                        </h3>
                        <p className="mt-0.5 truncate text-xs text-slate">
                          {row.fileName ?? "Link only"}
                        </p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 whitespace-nowrap rounded-[var(--radius-pill)] border px-2.5 py-1 text-xs font-bold ${statusPillClass(row.currentStatus)}`}
                      >
                        {statusLabel(row.currentStatus)}
                      </span>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-mist pt-4 text-sm">
                      <div className="col-span-2 min-w-0">
                        <dt className="text-xs font-bold text-slate">Requester</dt>
                        <dd className="mt-0.5 min-w-0 text-ink">
                          <span className="block font-bold">{row.requesterName}</span>
                          <span className="block truncate text-xs text-slate">
                            {row.requesterEmail}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-bold text-slate">Print</dt>
                        <dd className="tnum mt-0.5 font-mono text-xs font-bold uppercase text-ink">
                          {row.material} ×{row.quantity}
                        </dd>
                        <dd className="mt-0.5 truncate text-xs text-slate">
                          {row.colorNames.length ? row.colorNames.join(", ") : "No preference"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-bold text-slate">Assigned</dt>
                        <dd className="mt-0.5 text-slate">
                          {row.assigneeName ?? "Unassigned"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-bold text-slate">Age</dt>
                        <dd
                          className={`tnum mt-0.5 font-mono ${ageClass(row.untouchedDays, staleAfterDays)}`}
                        >
                          {row.ageDays}d
                          {row.untouchedDays >= staleAfterDays
                            ? ` · ${row.untouchedDays}d untouched`
                            : ""}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-bold text-slate">Deadline</dt>
                        <dd className={`mt-0.5 text-xs ${deadline.className}`}>
                          {deadline.label}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4 flex gap-2 border-t border-mist pt-4">
                      <Link
                        href={`/admin/requests/${row.id}`}
                        className="btn btn--secondary btn--sm flex-1"
                      >
                        Open request
                      </Link>
                      <DeleteButton
                        row={row}
                        onDelete={openDeleteDialog}
                        disabled={bulkPending}
                        className="flex-1"
                      />
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>

          <section
            id="bulk-update"
            aria-labelledby="bulk-update-title"
            className="scroll-mt-6 rounded-[var(--radius-card)] border border-mist bg-cloud p-5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 id="bulk-update-title" className="text-lg text-ink">Bulk status update</h3>
                <p className="mt-1 text-xs text-slate">
                  {bulkUpdateUnavailable
                    ? "These requests do not share a valid next status. Update them separately."
                    : selectedCount
                      ? `Ready to update ${selectedCount} selected request${selectedCount === 1 ? "" : "s"}.`
                    : "Select one or more requests above to use these controls."}
                </p>
              </div>
              <span className="tnum font-mono text-sm font-bold text-ink">
                {selectedCount}/{Math.min(BULK_LIMIT, rows.length)}
              </span>
            </div>

            {bulkUpdateUnavailable ? (
              <div className="mt-5 rounded-[var(--radius-chip)] border border-signal bg-signal/15 p-4 text-sm text-ink">
                Choose requests at the same stage, or update each request separately.
              </div>
            ) : (
              <fieldset
                disabled={bulkPending || selectedCount === 0}
                className="mt-5 grid gap-4 disabled:opacity-60 md:grid-cols-2 xl:grid-cols-[1fr_1fr_2fr_auto] xl:items-end"
              >
                <legend className="sr-only">Bulk status update</legend>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-ink">New status</span>
                  <select
                    name="toStatus"
                    value={effectiveTargetStatus}
                    onChange={(event) => setTargetStatus(event.target.value as RequestStatus)}
                    className="field w-full"
                  >
                    {bulkStatusOptions.map((status) => (
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
                  disabled={bulkPending || selectedCount === 0}
                >
                  {bulkPending ? (
                    <>
                      <span className="spinner" aria-hidden="true" />
                      Updating…
                    </>
                  ) : (
                    "Update selected"
                  )}
                </button>
              </fieldset>
            )}
            <p className="mt-3 text-xs text-slate">
              Illegal or stale rows are skipped. At most {BULK_LIMIT} requests can be updated at once.
            </p>
          </section>

          <ActionMessage state={bulkState} />
        </form>
      )}

      <dialog
        ref={deleteDialogRef}
        aria-labelledby="delete-request-title"
        aria-describedby="delete-request-description"
        className="m-auto w-[min(92vw,34rem)] rounded-[var(--radius-card)] border-2 border-ink bg-snow p-0 text-ink shadow-[0_24px_80px_rgb(18_23_43_/_0.35)] backdrop:bg-ink/70 backdrop:backdrop-blur-[2px]"
        onCancel={(event) => {
          if (deletePending) event.preventDefault();
        }}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteAttemptId(null);
          setConfirmationRef("");
        }}
      >
        {liveDeleteTarget && (
          <form
            action={deleteAction}
            aria-busy={deletePending}
            className="p-5 sm:p-6"
            onSubmit={() => setDeleteAttemptId(liveDeleteTarget.id)}
          >
            <input type="hidden" name="requestId" value={liveDeleteTarget.id} />
            <input type="hidden" name="expectedVersion" value={deleteTarget?.version} />

            <p className="font-display text-sm font-bold text-terracotta">Permanent action</p>
            <h2 id="delete-request-title" className="mt-2 text-2xl text-ink">
              Delete {liveDeleteTarget.ref}?
            </h2>
            <p id="delete-request-description" className="mt-3 text-sm text-slate">
              This permanently removes the request, its private status access, status and email
              history, and any uploaded model file. No deletion email is sent. This cannot be
              undone.
            </p>

            <dl className="mt-5 grid gap-3 rounded-[var(--radius-chip)] border border-mist bg-paper p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-bold text-slate">Requester</dt>
                <dd className="mt-0.5 font-bold text-ink">{liveDeleteTarget.requesterName}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-slate">Status</dt>
                <dd className="mt-0.5 text-ink">
                  {statusLabel(liveDeleteTarget.currentStatus)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-bold text-slate">Model</dt>
                <dd className="mt-0.5 break-words text-ink">
                  {liveDeleteTarget.fileName ?? "No uploaded file"}
                </dd>
              </div>
            </dl>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-bold text-ink">
                Type <span className="tnum font-mono">{liveDeleteTarget.ref}</span> to confirm
              </span>
              <input
                name="confirmationRef"
                type="text"
                value={confirmationRef}
                required
                pattern="CBSS-[0-9]{4}"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="field tnum w-full font-mono uppercase"
                onChange={(event) => setConfirmationRef(event.target.value.toUpperCase())}
              />
            </label>

            {deleteAttemptId === liveDeleteTarget.id && (
              <div className="mt-4">
                <ActionMessage state={deleteState} />
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                ref={cancelDeleteRef}
                type="button"
                className="btn btn--secondary"
                disabled={deletePending}
                onClick={() => deleteDialogRef.current?.close()}
              >
                Keep request
              </button>
              <button
                type="submit"
                className="btn btn--danger"
                disabled={deletePending || confirmationRef !== liveDeleteTarget.ref}
              >
                {deletePending ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Deleting…
                  </>
                ) : (
                  "Delete request"
                )}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
