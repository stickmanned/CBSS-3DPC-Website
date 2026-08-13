"use client";

import { useState } from "react";
import { club } from "../lib/content";
import Button from "./Button";

/**
 * Interim request form.
 *
 * There is no database yet, so this composes an email rather than
 * pretending to submit. That's deliberate: the old site popped an
 * alert() that did nothing, and a form that lies is worse than a form
 * that's honest about where it sends you.
 *
 * Phase 3 of the plan replaces handleSubmit with a Server Action that
 * writes to Supabase. The markup below does not need to change.
 */

const field =
  "w-full font-body text-base text-ink bg-chalk border-[1.5px] border-navy/30 px-3 py-2.5 focus:border-navy focus:outline-none focus:shadow-[inset_0_-3px_0_var(--color-signal)]";
const label =
  "block font-mono text-[11px] tracking-[0.12em] uppercase text-navy mb-1.5";

export default function RequestForm() {
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = [
      `Name: ${f.get("name")}`,
      `Email: ${f.get("email")}`,
      `Material: ${f.get("material")}`,
      `Quantity: ${f.get("quantity")}`,
      "",
      "What it's for / anything we should know:",
      `${f.get("notes") || "—"}`,
      "",
      "--- attach your .STL / .OBJ / .3MF to this email before sending ---",
    ].join("\n");

    window.location.href = `mailto:${club.advisorEmail}?subject=${encodeURIComponent(
      `Print request — ${f.get("name")}`
    )}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2 max-w-2xl">
      <div>
        <label className={label} htmlFor="name">
          Your name
        </label>
        <input id="name" name="name" required className={field} />
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
          placeholder={`you@${club.emailDomain}`}
          className={field}
        />
      </div>

      <div className="sm:col-span-2">
        <label className={label} htmlFor="material">
          Filament
        </label>
        <select id="material" name="material" className={field} defaultValue="PLA">
          <option value="PLA">PLA — the usual. Fine for almost everything.</option>
          <option value="PETG">PETG — tougher, handles heat, takes longer.</option>
        </select>
        <p className="text-sm italic text-silver mt-1.5">
          Not sure? Leave it on PLA. We&rsquo;ll tell you if it needs to change.
        </p>
      </div>

      <div>
        <label className={label} htmlFor="quantity">
          How many
        </label>
        <input
          id="quantity"
          name="quantity"
          type="number"
          min={1}
          defaultValue={1}
          className={field}
        />
      </div>

      <div className="sm:col-span-2">
        <label className={label} htmlFor="notes">
          What it&rsquo;s for, and anything we should know
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          placeholder="Deadline, which way is up, whether it needs to be strong…"
          className={field}
        />
      </div>

      <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
        <Button type="submit">Open the email &rarr;</Button>
        <p className="text-sm text-silver max-w-[34ch]">
          This opens your mail app with the details filled in. Attach your file, then send.
        </p>
      </div>

      {sent && (
        <p
          role="status"
          className="sm:col-span-2 bg-navy text-paper px-4 py-3 text-[15px]"
        >
          Your email app should have opened.{" "}
          <strong className="font-display">Don&rsquo;t forget to attach the file</strong> —
          we can&rsquo;t print a description. If nothing opened, email{" "}
          <span className="font-mono text-signal">{club.advisorEmail}</span> directly.
        </p>
      )}
    </form>
  );
}
