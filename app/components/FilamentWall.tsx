"use client";

import { useMemo, useState } from "react";
import { FILAMENT_COLORS } from "../lib/filament-colors";

/* The club stocks 238 filaments and the request form already lets you search
   all of them. That inventory is the most colourful honest thing the site
   owns, so it earns a place on the front page — no photography required.

   Hovering or focusing a swatch names it. That is the whole interaction:
   the reward is finding out that a colour you liked is called Mandarin
   Orange, which is true, and which nobody made up for a landing page. */
export default function FilamentWall() {
  const [active, setActive] = useState<string | null>(null);

  // Solid swatches only — gradients need two stops and read as mud at 22px.
  const swatches = useMemo(
    () => FILAMENT_COLORS.filter((color) => !color.swatch),
    []
  );

  const activeColor = active
    ? swatches.find((color) => color.slug === active)
    : null;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-display text-2xl font-bold text-ink sm:text-3xl">
          {swatches.length} colours you can ask for.
        </p>
        <p aria-live="polite" className="min-h-[1.5rem] text-slate">
          {activeColor ? (
            <>
              <span
                aria-hidden="true"
                className="mr-2 inline-block size-3 translate-y-px border border-ink/30"
                style={{ background: activeColor.hex }}
              />
              <span className="font-bold text-ink">{activeColor.name}</span>
              {" · "}
              {activeColor.materials.join(", ")}
            </>
          ) : (
            "Point at one."
          )}
        </p>
      </div>

      <ul className="mt-4 flex flex-wrap gap-1.5">
        {swatches.map((color) => (
          <li key={color.slug}>
            <button
              type="button"
              aria-label={`${color.name}, available in ${color.materials.join(
                " and "
              )}`}
              onMouseEnter={() => setActive(color.slug)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(color.slug)}
              onBlur={() => setActive(null)}
              className="filament-chip"
              style={{ background: color.hex }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
