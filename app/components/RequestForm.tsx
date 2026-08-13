"use client";

import { useState } from "react";
import { club } from "../lib/content";
import Button from "./Button";

const field =
  "min-h-12 w-full rounded-xl border border-mist bg-cloud px-4 py-3 text-[16px] text-ink placeholder:text-slate/65 focus:border-navy focus:bg-white focus:outline-none";
const label = "mb-2 block font-display text-[15px] font-bold text-ink";

export default function RequestForm() {
  const [draftOpened, setDraftOpened] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "");

    const body = [
      `Name: ${name}`,
      `School email: ${form.get("email")}`,
      `Number of copies: ${form.get("quantity")}`,
      `Deadline: ${form.get("deadline") || "Not specified"}`,
      "",
      "Project details:",
      `${form.get("details") || "—"}`,
      "",
      "--- Attach your 3D model to this email before sending. ---",
    ].join("\n");

    setDraftOpened(true);
    window.location.href = `mailto:${club.contactEmail}?subject=${encodeURIComponent(
      `3D print request — ${name}`,
    )}&body=${encodeURIComponent(body)}`;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-card)] border border-mist bg-white p-6 sm:p-8 lg:p-10"
    >
      <div className="border-b border-mist pb-6">
        <p className="eyebrow text-slate">Request details</p>
        <h2 className="mt-3 text-3xl text-ink">Start with what you know.</h2>
      </div>

      <div className="mt-7 grid gap-6 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="name">
            Your name
          </label>
          <input
            id="name"
            name="name"
            required
            autoComplete="name"
            placeholder="Full name"
            className={field}
          />
        </div>

        <div>
          <label className={label} htmlFor="email">
            School email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            placeholder={`name@${club.emailDomain}`}
            className={field}
          />
        </div>

        <div>
          <label className={label} htmlFor="quantity">
            Number of copies
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            defaultValue={1}
            inputMode="numeric"
            className={`${field} tnum`}
          />
        </div>

        <div>
          <label className={label} htmlFor="deadline">
            Deadline <span className="font-normal text-slate">(optional)</span>
          </label>
          <input id="deadline" name="deadline" type="date" className={`${field} tnum`} />
        </div>

        <div className="sm:col-span-2">
          <label className={label} htmlFor="details">
            Project details
          </label>
          <textarea
            id="details"
            name="details"
            rows={6}
            required
            autoComplete="off"
            aria-describedby="details-help"
            placeholder="What is the object for? Include its approximate size and anything else we should know."
            className={`${field} min-h-40 resize-y`}
          />
          <p id="details-help" className="mt-2 text-sm text-slate">
            Approximate dimensions help us understand the request before opening the model.
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-mist pt-7">
        <Button type="submit">
          Continue in email <span aria-hidden="true">→</span>
        </Button>
        <p className="max-w-[38ch] text-sm text-slate">
          We’ll open a draft addressed to the club. Attach your model, review the details,
          and send it.
        </p>
      </div>

      {draftOpened && (
        <p
          aria-live="polite"
          className="mt-6 rounded-xl bg-ink px-5 py-4 text-[15px] text-white"
        >
          Your draft email should be open. Before sending, attach your 3D model. If no
          draft opened, email{" "}
          <a
            href={`mailto:${club.contactEmail}`}
            className="font-semibold text-signal underline underline-offset-4 hover:text-white"
          >
            {club.contactEmail}
          </a>{" "}
          directly.
        </p>
      )}
    </form>
  );
}
