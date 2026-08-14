"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AccessState = "opening" | "missing" | "invalid" | "unavailable";

export default function StatusAccessBootstrap({
  requestRef,
}: {
  requestRef: string;
}) {
  const [state, setState] = useState<AccessState>("opening");

  useEffect(() => {
    let active = true;
    const deferState = (next: AccessState) => {
      queueMicrotask(() => {
        if (active) setState(next);
      });
    };
    const rawFragment = window.location.hash.slice(1);
    if (!rawFragment) {
      deferState("missing");
      return () => {
        active = false;
      };
    }

    let token: string;
    try {
      token = decodeURIComponent(rawFragment);
    } catch {
      window.history.replaceState(null, "", window.location.pathname);
      deferState("invalid");
      return () => {
        active = false;
      };
    }

    if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
      window.history.replaceState(null, "", window.location.pathname);
      deferState("invalid");
      return () => {
        active = false;
      };
    }

    fetch("/api/status/exchange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ref: requestRef, token }),
      cache: "no-store",
      credentials: "same-origin",
    })
      .then((response) => {
        if (!active) return;
        if (response.status === 204) {
          // The bearer never enters an HTTP URL. Replace the fragment-bearing
          // history entry before loading the cookie-authorized status page.
          window.location.replace(`/status/${encodeURIComponent(requestRef)}`);
          return;
        }
        window.history.replaceState(null, "", window.location.pathname);
        setState(response.status >= 500 ? "unavailable" : "invalid");
      })
      .catch(() => {
        if (!active) return;
        window.history.replaceState(null, "", window.location.pathname);
        setState("unavailable");
      });

    return () => {
      active = false;
    };
  }, [requestRef]);

  const opening = state === "opening";
  return (
    <section className="build-grid bg-cloud px-5 py-24">
      <div className="mx-auto max-w-2xl rounded-[var(--radius-card)] border border-mist bg-white p-8 shadow-sm sm:p-12">
        <p className="eyebrow text-slate">Private status · {requestRef}</p>
        <h1 className="mt-4 text-4xl text-ink sm:text-5xl" aria-live="polite">
          {opening
            ? "Opening your private request…"
            : state === "unavailable"
              ? "The queue could not be reached."
              : "This private link is incomplete or no longer valid."}
        </h1>
        <p className="mt-5 text-slate">
          {opening
            ? "Checking the private access part of the link. No request details are shown until it is verified."
            : state === "unavailable"
              ? "Try the complete link from your confirmation email again in a moment. No request details were changed."
              : "Open or copy the complete private link from the confirmation page or email. For privacy, a reference number by itself cannot open a request."}
        </p>
        {!opening && (
          <Link href="/request" className="btn btn--secondary mt-7">
            Return to print requests
          </Link>
        )}
      </div>
    </section>
  );
}
