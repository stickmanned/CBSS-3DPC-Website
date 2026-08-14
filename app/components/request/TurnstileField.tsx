"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";

type TurnstileRenderOptions = {
  sitekey: string;
  action: string;
  theme: "light";
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
  "response-field": boolean;
};

declare global {
  interface Window {
    turnstile?: {
      render?: (container: HTMLElement, options: TurnstileRenderOptions) => string;
      remove?: (widgetId: string) => void;
      ready?: (callback: () => void) => void;
    };
    // Cloudflare invokes this by name once the API is genuinely usable.
    onTurnstileApiReady?: () => void;
  }
}

const READY_CALLBACK = "onTurnstileApiReady";

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
      action: "print-request",
      theme: "light",
      callback: (value) => onTokenChangeRef.current(value),
      "expired-callback": () => onTokenChangeRef.current(""),
      "error-callback": () => onTokenChangeRef.current(""),
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

  return (
    <div id="turnstile" className="rounded-xl border border-mist bg-cloud p-4">
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
      {!token && !error && (
        <p className="mt-2 text-sm text-slate" role="status">
          Complete the check before uploading or sending your request.
        </p>
      )}
    </div>
  );
}
