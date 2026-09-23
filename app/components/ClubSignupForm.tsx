"use client";

import { useEffect, useRef } from "react";
import { signupForm } from "@/app/lib/content";

const EMBED_SCRIPT = "https://server.fillout.com/embed/v1/";

/**
 * Fillout's embed script has no re-init API: it scans the page for embed divs
 * once, when it executes. After a client-side navigation back to /about the
 * script is already cached and would never see the new div, so every mount
 * appends a fresh copy. Divs it has already filled carry
 * data-fillout-initialized and are skipped, so a re-run is harmless.
 */
export default function ClubSignupForm() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const script = document.createElement("script");
    script.src = EMBED_SCRIPT;
    script.async = true;
    container.appendChild(script);
    return () => script.remove();
  }, []);

  return (
    <div ref={containerRef}>
      <div
        data-fillout-id={signupForm.id}
        data-fillout-embed-type="standard"
        data-fillout-inherit-parameters
        data-fillout-dynamic-resize
        style={{ width: "100%", height: 500 }}
      />
    </div>
  );
}
