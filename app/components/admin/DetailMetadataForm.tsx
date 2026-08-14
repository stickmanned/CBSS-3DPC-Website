"use client";

import { useActionState } from "react";
import {
  updateRequestMetadataAction,
  type AdminActionState,
} from "@/app/admin/actions";
import ActionMessage from "./ActionMessage";

type AssigneeOption = { id: string; label: string };
const INITIAL_STATE: AdminActionState = { tone: "idle", message: "" };

export default function DetailMetadataForm({
  requestId,
  expectedVersion,
  notes,
  assigneeId,
  admins,
}: {
  requestId: string;
  expectedVersion: number;
  notes: string | null;
  assigneeId: string | null;
  admins: AssigneeOption[];
}) {
  const [state, action, pending] = useActionState(updateRequestMetadataAction, INITIAL_STATE);
  return (
    <form action={action} className="rounded-[20px] border border-mist bg-white p-5 sm:p-6">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="expectedVersion" value={expectedVersion} />
      <p className="eyebrow text-slate">Club-only details</p>
      <h2 className="mt-3 text-2xl text-ink">Assignment and notes</h2>

      <label className="mt-5 block">
        <span className="mb-2 block text-sm font-bold text-ink">Assigned club member</span>
        <select name="assigneeId" defaultValue={assigneeId ?? ""} className="field w-full">
          <option value="">Unassigned</option>
          {admins.map((admin) => (
            <option key={admin.id} value={admin.id}>
              {admin.label}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-5 block">
        <span className="mb-2 block text-sm font-bold text-ink">Private admin notes</span>
        <textarea
          name="adminNotes"
          rows={6}
          maxLength={10_000}
          defaultValue={notes ?? ""}
          className="field w-full resize-y"
          placeholder="Slicer settings, printer notes, internal follow-up…"
        />
        <span className="mt-2 block text-xs text-slate">
          These notes never appear on the requester status page or in email.
        </span>
      </label>

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
        <button type="submit" className="btn btn--secondary" disabled={pending}>
          {pending ? "Saving…" : "Save details"}
        </button>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

