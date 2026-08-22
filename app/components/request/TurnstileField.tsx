"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { club } from "@/app/lib/content";
import EmailLink from "@/app/components/EmailLink";
import { describeWidgetError } from "@/app/lib/security/turnstile-errors";
import { TURNSTILE_ACTION } from "@/app/lib/security/turnstile-config";

type TurnstileRenderOptions = {
  sitekey: string;
  action: string;
  theme: "light";
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": (code?: string) => void;
  "response-field": boolean;
};

declare global {
  interface Window {
    turnstile?: {
      render?: (container: HTMLElement, options: TurnstileRenderOptions) => string;
      remove?: (widgetId: string) => void;
      reset?: (widgetId: string) => void;
      ready?: (callback: () => void) => void;
    };
    // Cloudflare invokes this by name once the API is genuinely usable.
    onTurnstileApiReady?: () => void;
  }
}

const READY_CALLBACK = "onTurnstileApiReady";

/**
 * Deliberately not "turnstile". Browsers expose any element carrying an id as
 * a global (window.<id>), so a wrapper with id="turnstile" shadows Cloudflare's
 * own window.turnstile API object — the widget code then reads the <div> and
 * throws "window.turnstile.render is not a function".
 */
const CONTAINER_ID = "security-check";

export default function TurnstileField({
  siteKey,
  token,
  error,
  onTokenChange,
}: {
  siteKey: string;
  token: string;
  error?: string;
  onTokenChange: (token: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef("");
  const [widgetError, setWidgetError] = useState("");
  // onTokenChange identity can change between renders; keep the widget's
  // callbacks pointing at the current one without re-rendering the widget.
  const onTokenChangeRef = useRef(onTokenChange);
  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  const renderWidget = useCallback(() => {
    const container = containerRef.current;
    // `window.turnstile` is assigned before `render` is attached to it, so
    // checking only for the object throws "render is not a function".
    if (!container || typeof window.turnstile?.render !== "function") return false;
    if (widgetIdRef.current) return true;

    widgetIdRef.current = window.turnstile.render(container, {
      sitekey: siteKey,
      action: TURNSTILE_ACTION,
      theme: "light",
      callback: (value) => {
        setWidgetError("");
        onTokenChangeRef.current(value);
      },
      "expired-callback": () => onTokenChangeRef.current(""),
      "error-callback": (code) => {
        onTokenChangeRef.current("");
        setWidgetError(code ?? "unknown");
      },
      "response-field": false,
    });
    return true;
  }, [siteKey]);

  useEffect(() => {
    // Cloudflare only fires ?onload= once per script load. On a client-side
    // navigation back to this page the API is already present, so try
    // immediately and fall back to the global callback for a cold load.
    if (!renderWidget()) {
      window[READY_CALLBACK] = renderWidget;
    }

    return () => {
      if (window[READY_CALLBACK] === renderWidget) {
        delete window[READY_CALLBACK];
      }
      if (widgetIdRef.current) {
        window.turnstile?.remove?.(widgetIdRef.current);
        widgetIdRef.current = "";
      }
    };
  }, [renderWidget]);

  const retry = useCallback(() => {
    setWidgetError("");
    onTokenChangeRef.current("");
    if (widgetIdRef.current) {
      window.turnstile?.reset?.(widgetIdRef.current);
      return;
    }
    renderWidget();
  }, [renderWidget]);

  const failure = widgetError ? describeWidgetError(widgetError) : null;

  return (
    <div id={CONTAINER_ID} className="rounded-xl border border-mist bg-cloud p-4">
      <Script
        src={`https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=${READY_CALLBACK}`}
        strategy="afterInteractive"
      />
      <p className="mb-3 text-sm font-medium text-ink">One quick security check</p>
      <div ref={containerRef} className="min-h-[65px]" />
      <input type="hidden" name="cf-turnstile-response" value={token} />
      {error && (
        <p className="mt-3 text-sm font-semibold text-[#9b3028]" role="alert">
          {error}
        </p>
      )}
      {failure && (
        <div className="mt-3 text-sm" role="alert">
          <p className="font-semibold text-[#9b3028]">{failure.message}</p>
          <p className="mt-2 text-slate">
            {failure.retryable && (
              <button
                type="button"
                onClick={retry}
                className="font-semibold text-navy underline underline-offset-4"
              >
                Try the check again
              </button>
            )}
            {failure.retryable && " · "}
            <EmailLink
              address={club.contactEmail}
              subject="Print request form - security check error"
              body={`The security check on the request form failed with code ${widgetError}.`}
              className="font-semibold text-navy underline underline-offset-4"
            >
              Email the club
            </EmailLink>
          </p>
        </div>
      )}
      {!token && !error && !failure && (
        <p className="mt-2 text-sm text-slate" role="status">
          Complete the check before uploading or sending your request.
        </p>
      )}
    </div>
  );
}
