"use client";

import { useMemo, useState } from "react";
import {
  COLOR_FAMILIES,
  FILAMENT_COLORS,
  type ColorFamily,
  type FilamentColor,
  type FilamentMaterial,
} from "../../lib/filament-colors";
import { moveItem } from "./request-form-utils";
import type { MaterialSlug } from "./types";

const MATERIAL_LABELS: Record<MaterialSlug, FilamentMaterial> = {
  pla: "PLA",
  petg: "PETG",
  asa: "ASA",
};

const COLORS_BY_SLUG = new Map(FILAMENT_COLORS.map((color) => [color.slug, color]));

export function getFilamentColor(slug: string) {
  return COLORS_BY_SLUG.get(slug);
}

export function colorsUnavailableForMaterial(slugs: readonly string[], material: MaterialSlug) {
  const materialLabel = MATERIAL_LABELS[material];
  return slugs
    .map((slug) => COLORS_BY_SLUG.get(slug))
    .filter((color): color is FilamentColor => Boolean(color))
    .filter((color) => !color.materials.includes(materialLabel));
}

function Swatch({ color }: { color: FilamentColor }) {
  return (
    <span
      aria-hidden="true"
      className="size-8 shrink-0 rounded-full border border-ink/25 shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.45)]"
      style={{ background: color.swatch ?? color.hex }}
    />
  );
}

function FamilySection({
  family,
  colors,
  open,
  onToggle,
  selected,
  atLimit,
  disabled,
  onToggleColor,
}: {
  family: ColorFamily;
  colors: readonly FilamentColor[];
  open: boolean;
  onToggle: (open: boolean) => void;
  selected: readonly string[];
  atLimit: boolean;
  disabled: boolean;
  onToggleColor: (color: FilamentColor) => void;
}) {
  if (colors.length === 0) return null;

  return (
    <details
      open={open}
      onToggle={(event) => onToggle(event.currentTarget.open)}
      className="group/family border-b border-mist last:border-b-0"
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-lg px-2 py-3 font-display font-bold text-ink hover:bg-cloud [&::-webkit-details-marker]:hidden">
        <span>{family.label}</span>
        <span className="flex items-center gap-3">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-slate">
            {colors.length}
          </span>
          <span aria-hidden="true" className="text-navy transition-transform group-open/family:rotate-180">
            ↓
          </span>
        </span>
      </summary>

      <ul className="grid gap-2 pb-4 pt-1 sm:grid-cols-2 lg:grid-cols-3">
        {colors.map((color) => {
          const isSelected = selected.includes(color.slug);
          const blocked = disabled || (atLimit && !isSelected);

          return (
            <li key={color.slug}>
              <button
                type="button"
                aria-pressed={isSelected}
                aria-disabled={blocked}
                aria-describedby={atLimit && !isSelected ? "color-limit-message" : undefined}
                onClick={() => onToggleColor(color)}
                className={`flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  isSelected
                    ? "border-navy bg-cloud shadow-[inset_0_0_0_1px_var(--color-navy)]"
                    : "border-mist bg-white hover:border-navy/45 hover:bg-cloud/50"
                } ${disabled ? "cursor-not-allowed opacity-55" : ""}`}
              >
                <Swatch color={color} />
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-sm font-bold leading-snug text-ink">
                    {color.name}
                  </span>
                  {(color.finish || color.specialty) && (
                    <span className="mt-0.5 block truncate text-xs text-slate">
                      {color.finish || "Specialty finish"}
                    </span>
                  )}
                </span>
                {isSelected && (
                  <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-navy text-xs text-white">
                    ✓
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </details>
  );
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
  const [expanded, setExpanded] = useState(() => new Set<string>(["neutrals"]));
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
        (!query || color.name.toLocaleLowerCase().includes(query)),
    );
  }, [materialLabel, search]);

  const grouped = useMemo(
    () =>
      COLOR_FAMILIES.map((family) => ({
        family,
        colors: available.filter((color) => color.family === family.slug),
      })),
    [available],
  );

  function toggleColor(color: FilamentColor) {
    if (disabled) return;
    const selectedIndex = selected.indexOf(color.slug);
    if (selectedIndex >= 0) {
      onChange(selected.filter((slug) => slug !== color.slug));
      setAnnouncement(`${color.name} removed. ${selected.length - 1} of 4 selected.`);
      return;
    }
    if (atLimit) {
      setAnnouncement("Four colors are already selected. Remove one before choosing another.");
      return;
    }
    onChange([...selected, color.slug]);
    setAnnouncement(`${color.name} added in position ${selected.length + 1}. ${selected.length + 1} of 4 selected.`);
  }

  function reorder(index: number, direction: -1 | 1) {
    const color = selectedColors[index];
    if (!color) return;
    const next = moveItem(selected, index, index + direction);
    onChange(next);
    setAnnouncement(`${color.name} moved to position ${index + direction + 1}.`);
  }

  return (
    <fieldset
      id="color-picker"
      aria-invalid={Boolean(error)}
      aria-describedby={["color-picker-help", error ? "colors-error" : ""].filter(Boolean).join(" ")}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <legend className="font-display text-lg font-bold text-ink">Colors</legend>
          <p id="color-picker-help" className="mt-1 max-w-[64ch] text-sm text-slate">
            Optional. Pick up to four in print order. Multicolor and gradient filament uses one slot. Leave this empty for the club’s choice.
          </p>
        </div>
        <p className="rounded-full bg-ink px-4 py-2 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-white">
          {selected.length} of 4 selected
        </p>
      </div>

      {selectedColors.length > 0 ? (
        <ol className="mt-5 grid gap-2" aria-label="Selected colors in print order">
          {selectedColors.map((color, index) => (
            <li
              key={color.slug}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-mist bg-cloud p-3"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink font-mono text-xs font-bold text-white">
                {index + 1}
              </span>
              <Swatch color={color} />
              <span className="min-w-32 flex-1 font-display text-sm font-bold text-ink">{color.name}</span>
              <span className="flex gap-1.5">
                <button
                  type="button"
                  disabled={disabled || index === 0}
                  onClick={() => reorder(index, -1)}
                  className="grid size-11 cursor-pointer place-items-center rounded-full border border-navy/30 bg-white font-mono text-navy hover:bg-mist disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Move ${color.name} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={disabled || index === selectedColors.length - 1}
                  onClick={() => reorder(index, 1)}
                  className="grid size-11 cursor-pointer place-items-center rounded-full border border-navy/30 bg-white font-mono text-navy hover:bg-mist disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Move ${color.name} down`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleColor(color)}
                  className="min-h-11 cursor-pointer rounded-full px-3 font-display text-sm font-bold text-navy underline decoration-mist underline-offset-4 hover:decoration-navy disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Remove <span className="sr-only">{color.name}</span>
                </button>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-5 rounded-xl bg-cloud px-4 py-3 text-sm font-medium text-ink">
          No colors selected — the club will choose an available color.
        </p>
      )}

      {atLimit && (
        <p id="color-limit-message" className="mt-3 text-sm font-semibold text-navy" role="status">
          Four-color limit reached. Remove a selected color before choosing another.
        </p>
      )}

      <div className="mt-6">
        <label htmlFor="color-search" className="mb-2 block font-display text-[15px] font-bold text-ink">
          Search {materialLabel} colors by name
        </label>
        <input
          id="color-search"
          type="search"
          value={search}
          disabled={disabled}
          onChange={(event) => setSearch(event.currentTarget.value)}
          className="field"
          placeholder="Try navy, copper, or rainbow"
          autoComplete="off"
        />
      </div>

      <div className="mt-5 border-y border-mist" aria-label={`${materialLabel} color families`}>
        {grouped.map(({ family, colors }) => (
          <FamilySection
            key={family.slug}
            family={family}
            colors={colors}
            open={Boolean(search.trim()) || expanded.has(family.slug)}
            onToggle={(open) => {
              if (search.trim()) return;
              setExpanded((current) => {
                const next = new Set(current);
                if (open) next.add(family.slug);
                else next.delete(family.slug);
                return next;
              });
            }}
            selected={selected}
            atLimit={atLimit}
            disabled={disabled}
            onToggleColor={toggleColor}
          />
        ))}
      </div>

      {available.length === 0 && (
        <p className="mt-4 rounded-xl bg-cloud px-4 py-3 text-sm text-slate" role="status">
          No {materialLabel} colors match “{search}”. Try another name.
        </p>
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
