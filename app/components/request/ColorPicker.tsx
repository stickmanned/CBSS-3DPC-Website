"use client";

import { useMemo, useState } from "react";
import {
  FILAMENT_COLORS,
  type FilamentColor,
  type FilamentMaterial,
} from "../../lib/filament-colors";
import Spool from "../Spool";
import SwatchGrid from "../SwatchGrid";
import { moveItem } from "./request-form-utils";
import type { MaterialSlug } from "./types";

/* Choosing print colours is the one step where seeing the colour matters, and
   the old version of this control was the one place you could not: thirteen
   collapsed families of name-and-dot rows, three to a line, roughly two
   thousand pixels tall when opened.

   It is now the same grid the homepage uses, with the same spool showing what
   you picked — up to four, in the order they are printed. */

const MATERIAL_LABELS: Record<MaterialSlug, FilamentMaterial> = {
  pla: "PLA",
  petg: "PETG",
  asa: "ASA",
};

const COLORS_BY_SLUG = new Map(FILAMENT_COLORS.map((color) => [color.slug, color]));

export function getFilamentColor(slug: string) {
  return COLORS_BY_SLUG.get(slug);
}

export function colorsUnavailableForMaterial(
  slugs: readonly string[],
  material: MaterialSlug
) {
  const materialLabel = MATERIAL_LABELS[material];
  return slugs
    .map((slug) => COLORS_BY_SLUG.get(slug))
    .filter((color): color is FilamentColor => Boolean(color))
    .filter((color) => !color.materials.includes(materialLabel));
}

export default function ColorPicker({
  material,
  selected,
  onChange,
  disabled = false,
  error,
}: {
  material: MaterialSlug;
  selected: string[];
  onChange: (slugs: string[]) => void;
  disabled?: boolean;
  error?: string;
}) {
  const [search, setSearch] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const materialLabel = MATERIAL_LABELS[material];
  const atLimit = selected.length >= 4;

  const selectedColors = selected
    .map((slug) => COLORS_BY_SLUG.get(slug))
    .filter((color): color is FilamentColor => Boolean(color));

  const available = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return FILAMENT_COLORS.filter(
      (color) =>
        color.materials.includes(materialLabel) &&
        (!query || color.name.toLocaleLowerCase().includes(query))
    );
  }, [materialLabel, search]);

  /* The spool shows the first colour, because that is the one the print
     starts in. The rest are listed beneath it in order. */
  const previewFill = selectedColors[0]
    ? selectedColors[0].swatch ?? selectedColors[0].hex
    : "var(--color-cloud)";

  function toggleColor(color: FilamentColor) {
    if (disabled) return;
    const index = selected.indexOf(color.slug);
    if (index >= 0) {
      onChange(selected.filter((slug) => slug !== color.slug));
      setAnnouncement(
        `${color.name} removed. ${selected.length - 1} of 4 selected.`
      );
      return;
    }
    if (atLimit) {
      setAnnouncement(
        "Four colors are already selected. Remove one before choosing another."
      );
      return;
    }
    onChange([...selected, color.slug]);
    setAnnouncement(
      `${color.name} added in position ${selected.length + 1}. ${
        selected.length + 1
      } of 4 selected.`
    );
  }

  function reorder(index: number, direction: -1 | 1) {
    const color = selectedColors[index];
    if (!color) return;
    onChange(moveItem(selected, index, index + direction));
    setAnnouncement(`${color.name} moved to position ${index + direction + 1}.`);
  }

  return (
    <fieldset
      id="color-picker"
      aria-invalid={Boolean(error)}
      aria-describedby={["color-picker-help", error ? "colors-error" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <legend className="font-display text-lg font-bold text-ink">
            Colors
          </legend>
          <p id="color-picker-help" className="mt-1 max-w-[64ch] text-sm text-slate">
            Optional. Pick up to four in print order. Multicolor and gradient
            filament uses one slot. Leave this empty for the club&rsquo;s choice.
          </p>
        </div>
        <p className="rounded-[var(--radius-chip)] border-2 border-ink bg-signal px-3 py-1.5 font-display text-sm font-bold text-ink">
          {selected.length} of 4 selected
        </p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:gap-7">
        <div>
          <Spool fill={previewFill} className="lg:mx-0" />

          {selectedColors.length === 0 && (
            <p className="mt-4 text-sm text-slate">
              No colors selected — the club will choose an available color.
            </p>
          )}

          {atLimit && (
            <p
              id="color-limit-message"
              className="mt-3 text-sm font-semibold text-ink"
              role="status"
            >
              Four-color limit reached. Remove one before choosing another.
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="color-search"
            className="mb-2 block font-display text-[15px] font-bold text-ink"
          >
            Search {materialLabel} colors by name
          </label>
          <input
            id="color-search"
            type="search"
            value={search}
            disabled={disabled}
            onChange={(event) => setSearch(event.currentTarget.value)}
            className="field border-navy/30"
            placeholder="Try navy, copper, or rainbow"
            autoComplete="off"
          />

          <div className="mt-4">
            <SwatchGrid
              label={`${materialLabel} colours`}
              colors={available}
              selectedSlugs={selected}
              multiple
              disabled={disabled}
              badge={(color) => {
                const index = selected.indexOf(color.slug);
                return index === -1 ? null : index + 1;
              }}
              onSelect={toggleColor}
              emptyMessage={`No ${materialLabel} colors match “${search}”. Try another name.`}
              className="max-h-[20rem]"
            />
          </div>
        </div>
      </div>

      {/* Print order runs left to right across the full width rather than
          stacked beside the spool: three 44px controls and a colour name do
          not fit in a 14rem column without wrapping onto a second line. */}
      {selectedColors.length > 0 && (
        <ol
          className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          aria-label="Selected colors in print order"
        >
          {selectedColors.map((color, index) => (
            <li
              key={color.slug}
              className="rounded-[var(--radius-card)] border-2 border-ink/15 bg-white p-3"
            >
              <div className="flex items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-chip)] bg-ink text-xs font-bold text-white">
                  {index + 1}
                </span>
                <span
                  aria-hidden="true"
                  className="size-7 shrink-0 rounded-[var(--radius-chip)] border border-ink/30"
                  style={{ background: color.swatch ?? color.hex }}
                />
                <span className="min-w-0 flex-1 truncate font-display text-sm font-bold text-ink">
                  {color.name}
                </span>
              </div>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  disabled={disabled || index === 0}
                  onClick={() => reorder(index, -1)}
                  className="grid h-11 flex-1 cursor-pointer place-items-center rounded-[var(--radius-chip)] border-2 border-ink/20 bg-white text-ink hover:bg-cloud disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Move ${color.name} earlier`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={disabled || index === selectedColors.length - 1}
                  onClick={() => reorder(index, 1)}
                  className="grid h-11 flex-1 cursor-pointer place-items-center rounded-[var(--radius-chip)] border-2 border-ink/20 bg-white text-ink hover:bg-cloud disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Move ${color.name} later`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleColor(color)}
                  className="grid h-11 flex-1 cursor-pointer place-items-center rounded-[var(--radius-chip)] border-2 border-ink/20 bg-white text-ink hover:bg-cloud disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Remove ${color.name}`}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {error && (
        <p id="colors-error" className="mt-3 text-sm font-semibold text-[#9b3028]">
          {error}
        </p>
      )}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </fieldset>
  );
}
