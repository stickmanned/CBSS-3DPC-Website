"use client";

import { useRef } from "react";
import type { MaterialSlug } from "./types";

const MATERIALS: Array<{
  slug: MaterialSlug;
  name: string;
  description: string;
  property: string;
  goodFor: string;
}> = [
  {
    slug: "pla",
    name: "PLA",
    description:
      "The default, and usually the right call. Easiest to print, cheapest, and available in far more colors than anything else. Rigid, but it snaps rather than bends.",
    property: "Softens ~60 °C · not for sun or hot cars",
    goodFor:
      "Good for: display pieces, figurines, models, prototypes, anything living indoors.",
  },
  {
    slug: "petg",
    name: "PETG",
    description:
      "Tougher, and it flexes before it breaks. Handles heat and moisture far better than PLA, with a slight gloss. A bit fussier to print — it likes to string.",
    property: "Softens ~80 °C · water and chemical resistant",
    goodFor: "Good for: brackets, clips, phone stands, parts that take a little stress.",
  },
  {
    slug: "asa",
    name: "ASA",
    description:
      "The one that survives outside. UV-stable, so it won’t yellow or go chalky in sunlight. Strong and impact-resistant. Needs an enclosure and ventilation, so it’s the hardest of the three to print well.",
    property: "Holds past 100 °C · UV and weather resistant",
    goodFor: "Good for: outdoor signage, garden and car parts, anything facing sun or rain.",
  },
];

/* Three options, exactly one chosen: a radio group, not three toggle buttons.
   The old version used aria-pressed, which tells a screen reader "PLA,
   pressed" without ever saying the three are alternatives. */
export default function MaterialSelector({
  value,
  onChange,
  disabled = false,
  error,
  switchMessage,
}: {
  value: MaterialSlug;
  onChange: (material: MaterialSlug) => void;
  disabled?: boolean;
  error?: string;
  switchMessage?: string;
}) {
  const cards = useRef(new Map<MaterialSlug, HTMLButtonElement>());

  function move(offset: number) {
    const index = MATERIALS.findIndex((material) => material.slug === value);
    const next = MATERIALS[(index + offset + MATERIALS.length) % MATERIALS.length];
    onChange(next.slug);
    cards.current.get(next.slug)?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
    }
  }

  return (
    <fieldset
      id="material"
      aria-invalid={Boolean(error)}
      aria-describedby={
        [error ? "material-error" : "", switchMessage ? "material-switch-message" : ""]
          .filter(Boolean)
          .join(" ") || undefined
      }
    >
      <legend className="font-display text-lg font-bold text-ink">Material</legend>
      <p id="material-help" className="mt-1 max-w-[65ch] text-sm text-slate">
        Choose based on where the object will live and what it needs to handle.
      </p>

      <div
        role="radiogroup"
        aria-labelledby="material-help"
        onKeyDown={onKeyDown}
        className="mt-5 grid gap-4 lg:grid-cols-3"
      >
        {MATERIALS.map((material) => {
          const selected = value === material.slug;
          const descriptionId = `material-${material.slug}-description`;

          return (
            <button
              key={material.slug}
              type="button"
              role="radio"
              aria-checked={selected}
              /* One tab stop; arrows move between the three, as a radio
                 group is expected to behave. */
              tabIndex={selected ? 0 : -1}
              disabled={disabled}
              aria-describedby={descriptionId}
              ref={(node) => {
                if (node) cards.current.set(material.slug, node);
                else cards.current.delete(material.slug);
              }}
              onClick={() => onChange(material.slug)}
              className={`cursor-pointer rounded-[var(--radius-card)] border-2 p-5 text-left transition-[border-color,background-color,box-shadow] duration-200 disabled:cursor-not-allowed disabled:opacity-55 ${
                selected
                  ? "border-ink bg-signal/20 shadow-[3px_3px_0_var(--color-ink)]"
                  : "border-ink/15 bg-white hover:border-ink/45 hover:bg-cloud/60"
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-display text-2xl font-bold text-ink">
                  {material.name}
                </span>
                <span
                  aria-hidden="true"
                  className={`grid size-7 shrink-0 place-items-center rounded-full border-2 text-sm font-bold ${
                    selected
                      ? "border-ink bg-ink text-white"
                      : "border-ink/25 text-transparent"
                  }`}
                >
                  ✓
                </span>
              </span>
              <span
                id={descriptionId}
                className="mt-4 block text-[15px] leading-relaxed text-slate"
              >
                {material.description}
                <span className="mt-4 block border-t border-mist pt-4 font-display text-sm font-bold leading-relaxed text-ink">
                  {material.property}
                </span>
                <span className="mt-3 block text-sm text-slate">
                  {material.goodFor}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {switchMessage && (
        <p
          id="material-switch-message"
          role="status"
          className="mt-4 rounded-[var(--radius-card)] border-2 border-ink/15 bg-cloud px-4 py-3 text-sm font-medium text-ink"
        >
          {switchMessage}
        </p>
      )}
      {error && (
        <p id="material-error" className="mt-3 text-sm font-semibold text-[#9b3028]">
          {error}
        </p>
      )}
    </fieldset>
  );
}
