"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { copyToClipboard } from "./copy-to-clipboard";

/**
 * A mailto link that still gives you the address when mailto goes nowhere.
 *
 * `mailto:` is a handoff, not a navigation: the browser passes the address to
 * whatever handler the operating system or Chrome has registered, and if there
 * is none it opens a blank tab and stops. Nothing reaches the page, so there is
 * no event to catch and no way to detect the failure — which is why the link
 * appears to do nothing. A managed school Chromebook with no mail client and no
 * Gmail protocol handler is exactly that case, and it is a large share of who
 * reads this site.
 *
 * So the anchor is left alone — a working handler should keep working, and
 * right-click, middle-click and "Copy link" all still behave — and a copy
 * control is offered beside it. No detection, no interception, no JavaScript
 * required for the common path.
 */
const RESET_AFTER_MS = 2_400;

type CopyState = "idle" | "copied" | "failed";

export default function EmailLink({
  address,
  subject,
  body,
  className = "",
  children,
}: {
  address: string;
  subject?: string;
  body?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [state, setState] = useState<CopyState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleCopy = useCallback(async () => {
    const copied = await copyToClipboard(address);
    setState(copied ? "copied" : "failed");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setState("idle"), RESET_AFTER_MS);
  }, [address]);

  const query = new URLSearchParams();
  if (subject) query.set("subject", subject);
  if (body) query.set("body", body);
  const suffix = query.toString();

  // Both controls are shorter than the 24px minimum touch target (the Copy
  // button is 16px), so each gets an invisible ::before that extends its hit
  // area by 4px above and below without moving anything. ::before, not
  // ::after — .footer-link already draws its underline with ::after. The
  // 8px row gap keeps the two enlarged areas from overlapping when Copy wraps
  // under the address.
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-2">
      <a
        href={`mailto:${address}${suffix ? `?${suffix}` : ""}`}
        className={`relative before:absolute before:inset-x-0 before:-inset-y-1 ${className}`}
      >
        {children ?? address}
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className="relative text-xs font-semibold text-slate underline underline-offset-2 transition-colors before:absolute before:-inset-x-1 before:-inset-y-1 hover:text-navy"
        aria-label={`Copy ${address} to the clipboard`}
      >
        {state === "copied" ? "Copied" : state === "failed" ? "Select it above" : "Copy"}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === "copied"
          ? `${address} copied to the clipboard`
          : state === "failed"
            ? "Copying was blocked. Select the address to copy it manually."
            : ""}
      </span>
    </span>
  );
}
