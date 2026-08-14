"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          action: string;
          theme: "light";
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
          "response-field": boolean;
        },
      ) => string;
      remove?: (widgetId: string) => void;
    };
  }
}

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

  const renderWidget = useCallback(() => {
    const container = containerRef.current;
    if (!container || !window.turnstile || widgetIdRef.current) return;

    widgetIdRef.current = window.turnstile.render(container, {
      sitekey: siteKey,
      action: "print-request",
      theme: "light",
      callback: onTokenChange,
      "expired-callback": () => onTokenChange(""),
      "error-callback": () => onTokenChange(""),
      "response-field": false,
    });
  }, [onTokenChange, siteKey]);

  useEffect(
    () => () => {
      if (widgetIdRef.current) window.turnstile?.remove?.(widgetIdRef.current);
      widgetIdRef.current = "";
    },
    [],
  );

  return (
    <div id="turnstile" className="rounded-xl border border-mist bg-cloud p-4">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="lazyOnload"
        onLoad={renderWidget}
        onReady={renderWidget}
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
