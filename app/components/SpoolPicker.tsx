"use client";

import { useMemo, useState } from "react";
import { FILAMENT_COLORS, type FilamentColor } from "../lib/filament-colors";
import Spool from "./Spool";
import SwatchGrid from "./SwatchGrid";

/* The club's real filament inventory, on a spool you can actually load.
   Pick a colour on the right and the spool takes it — including the gradient
   filaments, which the old swatch wall had to leave out because a two-stop
   gradient reads as mud at 22px. At this size they are the best-looking things
   in the catalogue, so they are back.

   The grid and the spool are shared with the request form's colour step, so
   choosing a colour works the same way in both places. */

/* Sunflower Yellow is --color-signal, so the section loads in the site's own
   accent instead of whichever colour happens to sort first (White, which on
   paper stock is an invisible way to introduce a spool). */
const DEFAULT_SLUG = "sunflower-yellow";

export default function SpoolPicker() {
  const [active, setActive] = useState<FilamentColor>(
    () =>
      FILAMENT_COLORS.find((color) => color.slug === DEFAULT_SLUG) ??
      FILAMENT_COLORS[0]
  );

  const colors = useMemo(() => FILAMENT_COLORS, []);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-2xl text-ink sm:text-3xl">
          {colors.length} colours you can ask for.
        </h2>
        <p className="text-slate">Load one onto the spool.</p>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:gap-8">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <Spool fill={active.swatch ?? active.hex} />

          <div className="mt-4 text-center lg:text-left">
            <p className="font-display text-xl font-bold leading-snug text-ink">
              {active.name}
            </p>
            <p className="mt-1 text-sm text-slate">
              {active.materials.join(" · ")}
              {active.finish ? ` · ${active.finish}` : ""}
            </p>
            {/* A multicolour filament has no single hex, and printing its
                first stop as though it did is a small lie. */}
            <p className="mt-1 text-sm text-slate">
              {active.swatch ? "Multicolour" : active.hex}
            </p>
          </div>
        </div>

        <SwatchGrid
          label="Filament colours"
          colors={colors}
          selectedSlugs={[active.slug]}
          selectFollowsFocus
          onSelect={setActive}
        />
      </div>
    </div>
  );
}
