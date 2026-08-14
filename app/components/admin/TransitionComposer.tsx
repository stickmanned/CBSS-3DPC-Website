"use client";

import { useActionState, useMemo, useState } from "react";
import {
  transitionRequestAction,
  type AdminActionState,
} from "@/app/admin/actions";
import type { RequestStatus } from "@/app/lib/queue/domain";
import ActionMessage from "./ActionMessage";

export type EmailPreview = { subject: string; text: string };

export type TransitionReasonChoice = {
  key: string;
  label: string;
  email: EmailPreview | null;
};

export type TransitionChoice = {
  status: RequestStatus;
  label: string;
  sendsEmail: boolean;
  email: EmailPreview | null;
  reasons: TransitionReasonChoice[];
};

const INITIAL_STATE: AdminActionState = { tone: "idle", message: "" };

export default function TransitionComposer({
  requestId,
  expectedVersion,
  choices,
}: {
  requestId: string;
  expectedVersion: number;
  choices: TransitionChoice[];
}) {
  const [state, action, pending] = useActionState(transitionRequestAction, INITIAL_STATE);
  const [status, setStatus] = useState<RequestStatus | "">(choices[0]?.status ?? "");
  const [reason, setReason] = useState(choices[0]?.reasons[0]?.key ?? "");
  const [copyMessage, setCopyMessage] = useState("");

  const selectedStatus = choices.some((item) => item.status === status)
    ? status
    : (choices[0]?.status ?? "");
  const choice = useMemo(
    () => choices.find((item) => item.status === selectedStatus) ?? choices[0],
    [choices, selectedStatus],
  );
  const selectedReason = choice?.reasons.some((item) => item.key === reason)
    ? reason
    : (choice?.reasons[0]?.key ?? "");
  const preview = choice?.reasons.length
    ? choice.reasons.find((item) => item.key === selectedReason)?.email ?? choice.reasons[0]?.email
    : choice?.email;

  function chooseStatus(next: RequestStatus) {
    setStatus(next);
    const nextChoice = choices.find((item) => item.status === next);
    setReason(nextChoice?.reasons[0]?.key ?? "");
    setCopyMessage("");
  }

  async function copyEmail() {
    if (!preview) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${preview.subject}\n\n${preview.text}`);
      setCopyMessage("Copied.");
    } catch {
      setCopyMessage("Copy failed. Select the preview text and copy it manually.");
    }
  }

  if (!choices.length) {
    return (
      <div className="rounded-[20px] border border-mist bg-cloud p-5">
        <h2 className="text-2xl text-ink">Status</h2>
        <p className="mt-3 text-sm text-slate">This request has no further queue steps.</p>
      </div>
    );
  }

  return (
    <section className="rounded-[20px] border border-mist bg-white p-5 sm:p-6">
      <div className="max-w-2xl">
        <p className="eyebrow text-slate">Next queue step</p>
        <h2 className="mt-3 text-3xl text-ink">Compose status update</h2>
        <p className="mt-3 text-sm text-slate">
          The saved status and event appear immediately. Email delivery happens afterward and
          never controls whether the queue update is kept.
        </p>
      </div>

      <form action={action} className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="expectedVersion" value={expectedVersion} />

        <div className="space-y-5">
          <fieldset>
            <legend className="text-sm font-bold text-ink">Choose the next status</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {choices.map((item) => (
                <label key={item.status} className="cursor-pointer">
                  <input
                    type="radio"
                    name="toStatus"
                    value={item.status}
                    checked={selectedStatus === item.status}
                    onChange={() => chooseStatus(item.status)}
                    className="peer sr-only"
                  />
                  <span className="inline-flex min-h-11 items-center rounded-full border border-navy/20 bg-white px-4 py-2 text-sm font-bold text-navy transition peer-checked:border-navy peer-checked:bg-navy peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal">
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {choice?.reasons.length ? (
            <fieldset>
              <legend className="text-sm font-bold text-ink">Choose a reason</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {choice.reasons.map((item) => (
                  <label key={item.key} className="cursor-pointer">
                    <input
                      type="radio"
                      name="reasonKey"
                      value={item.key}
                      checked={selectedReason === item.key}
                      onChange={() => {
                        setReason(item.key);
                        setCopyMessage("");
                      }}
                      className="peer sr-only"
                      required
                    />
                    <span className="flex min-h-11 items-center rounded-xl border border-mist bg-cloud px-3 py-2 text-sm font-semibold text-ink transition peer-checked:border-navy peer-checked:bg-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal">
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <input type="hidden" name="reasonKey" value="" />
          )}

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-ink">
              Requester-visible note <span className="font-normal text-slate">(optional)</span>
            </span>
            <textarea
              name="requesterVisibleNote"
              rows={4}
              maxLength={4000}
              className="field w-full resize-y"
              placeholder="Add context that should appear on the private status page."
            />
          </label>

          <button type="submit" className="btn btn--dark w-full sm:w-auto" disabled={pending}>
            {pending ? "Saving…" : `Move to ${choice?.label ?? "next status"}`}
          </button>
          <ActionMessage state={state} />
        </div>

        <aside className="min-w-0 rounded-2xl border border-mist bg-cloud p-5" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl text-ink">Requester email preview</h3>
            {preview && (
              <button type="button" className="btn btn--secondary btn--sm" onClick={copyEmail}>
                Copy email
              </button>
            )}
          </div>

          {!choice?.sendsEmail ? (
            <p className="mt-5 text-sm text-slate">
              This queue step intentionally sends no requester email.
            </p>
          ) : preview ? (
            <div className="mt-5 min-w-0 rounded-xl border border-mist bg-white p-4">
              <p className="border-b border-mist pb-3 text-sm text-ink">
                <strong>Subject:</strong> {preview.subject}
              </p>
              <pre className="mt-4 whitespace-pre-wrap break-words font-body text-sm leading-relaxed text-ink">
                {preview.text}
              </pre>
            </div>
          ) : (
            <p className="mt-5 rounded-xl border border-signal bg-signal/20 px-4 py-3 text-sm text-ink">
              Email preview is unavailable because the private status-link configuration is
              incomplete. The status can still be saved, but the email will fail safely.
            </p>
          )}
          {copyMessage && <p className="mt-3 text-xs font-semibold text-slate">{copyMessage}</p>}
        </aside>
      </form>
    </section>
  );
}
