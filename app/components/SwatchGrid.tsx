"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  COLOR_FAMILIES,
  type FilamentColor,
} from "../lib/filament-colors";

/* The filament grid, shared by the homepage spool picker and the request
   form's colour step. Both needed the same three things — tiles big enough to
   judge a colour by, family grouping that survives scrolling, and a keyboard
   contract that does not cost 238 tab stops — so they use one component
   rather than two that drift apart.

   Single-select (homepage) sets `selectFollowsFocus`; multi-select (the form)
   leaves it off and passes `badge` to number the chosen colours in print
   order. */

type Tip = { name: string; x: number; top: number; bottom: number };

function fillOf(color: FilamentColor) {
  return color.swatch ?? color.hex;
}

/* "PLA, PETG and ASA" rather than "PLA and PETG and ASA", which is what a
   plain join gives you and what a screen reader would then read out. */
function listOf(items: readonly string[]) {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export default function SwatchGrid({
  colors,
  selectedSlugs,
  onSelect,
  selectFollowsFocus = false,
  multiple = false,
  disabled = false,
  badge,
  label,
  emptyMessage,
  className = "max-h-[24rem] lg:max-h-[30rem]",
}: {
  colors: readonly FilamentColor[];
  selectedSlugs: readonly string[];
  onSelect: (color: FilamentColor) => void;
  /** Single-select lists select whatever the arrow keys land on. */
  selectFollowsFocus?: boolean;
  multiple?: boolean;
  disabled?: boolean;
  /** Position number drawn on a chosen tile, for ordered selections. */
  badge?: (color: FilamentColor) => number | null;
  label: string;
  emptyMessage?: string;
  className?: string;
}) {
  const groups = useMemo(
    () =>
      COLOR_FAMILIES.map((family) => ({
        family,
        colors: colors.filter((color) => color.family === family.slug),
      })).filter((group) => group.colors.length > 0),
    [colors]
  );

  /* Flattened in render order — arrows have to walk what the eye walks,
     across family boundaries, not restart inside each group. */
  const ordered = useMemo(() => groups.flatMap((group) => group.colors), [groups]);

  const [focusSlug, setFocusSlug] = useState<string | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const tiles = useRef(new Map<string, HTMLButtonElement>());
  const tipRef = useRef<HTMLSpanElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  /* The tile that owns the single tab stop: whatever was focused last, else
     the first selected colour, else the first tile. */
  const tabbableSlug =
    (focusSlug && ordered.some((color) => color.slug === focusSlug)
      ? focusSlug
      : null) ??
    ordered.find((color) => selectedSlugs.includes(color.slug))?.slug ??
    ordered[0]?.slug ??
    null;

  /* The label is one element positioned from the hovered tile rather than a
     child of each tile. Inside a scrolling box a per-tile tooltip gets clipped
     at the edges, and there is no CSS that knows how many tiles fit in a row,
     so the flip is measured here instead of guessed. */
  useLayoutEffect(() => {
    const element = tipRef.current;
    const box = scroller.current;
    if (!element || !box || !tip) return;

    const half = element.offsetWidth / 2 + 8;
    element.style.left = `${Math.min(
      Math.max(tip.x, half),
      Math.max(half, box.clientWidth - half)
    )}px`;

    const fitsAbove = tip.top - box.scrollTop > element.offsetHeight + 10;
    element.style.top = fitsAbove
      ? `${tip.top - element.offsetHeight - 8}px`
      : `${tip.bottom + 8}px`;
  }, [tip]);

  function showTip(color: FilamentColor) {
    const tile = tiles.current.get(color.slug);
    if (!tile) return;
    setTip({
      name: color.name,
      x: tile.offsetLeft + tile.offsetWidth / 2,
      top: tile.offsetTop,
      bottom: tile.offsetTop + tile.offsetHeight,
    });
  }

  function focusAt(index: number) {
    const color = ordered[(index + ordered.length) % ordered.length];
    if (!color) return;

    setFocusSlug(color.slug);
    const tile = tiles.current.get(color.slug);
    tile?.focus();
    /* "nearest" scrolls only when it has to, which stops the grid lurching on
       every keypress. */
    tile?.scrollIntoView({ block: "nearest" });
    showTip(color);
    if (selectFollowsFocus) onSelect(color);
  }

  /* Up and down are measured from the laid-out grid rather than a column
     count: the grid is `auto-fill`, so the number of tiles in a row changes
     with the viewport and again inside every family. Find the nearest row in
     the direction of travel, then the tile in it closest to where the cursor
     already was horizontally. */
  function step(from: number, direction: 1 | -1) {
    const current = tiles.current.get(ordered[from]?.slug ?? "");
    if (!current) return;

    const centre = current.offsetLeft + current.offsetWidth / 2;
    const entries = ordered
      .map((color, index) => ({ index, node: tiles.current.get(color.slug) }))
      .filter(
        (entry): entry is { index: number; node: HTMLButtonElement } =>
          Boolean(entry.node)
      )
      .filter(({ node }) =>
        direction === 1
          ? node.offsetTop > current.offsetTop
          : node.offsetTop < current.offsetTop
      );
    if (entries.length === 0) return;

    const rowTop =
      direction === 1
        ? Math.min(...entries.map(({ node }) => node.offsetTop))
        : Math.max(...entries.map(({ node }) => node.offsetTop));

    const row = entries.filter(({ node }) => node.offsetTop === rowTop);
    const best = row.reduce((closest, entry) => {
      const distance = Math.abs(
        entry.node.offsetLeft + entry.node.offsetWidth / 2 - centre
      );
      const closestDistance = Math.abs(
        closest.node.offsetLeft + closest.node.offsetWidth / 2 - centre
      );
      return distance < closestDistance ? entry : closest;
    });

    focusAt(best.index);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const from = ordered.findIndex((color) => color.slug === tabbableSlug);
    if (from === -1) return;

    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        focusAt(from + 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        focusAt(from - 1);
        break;
      case "ArrowDown":
        event.preventDefault();
        step(from, 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        step(from, -1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(ordered.length - 1);
        break;
    }
  }

  if (ordered.length === 0) {
    return (
      <p
        role="status"
        className="rounded-[var(--radius-card)] border-2 border-ink/15 bg-white px-4 py-5 text-sm text-slate"
      >
        {emptyMessage ?? "No colours match."}
      </p>
    );
  }

  return (
    <div
      ref={scroller}
      role="listbox"
      aria-label={label}
      aria-multiselectable={multiple || undefined}
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
      onMouseLeave={() => setTip(null)}
      className={`relative overflow-y-auto overscroll-contain rounded-[var(--radius-card)] border-2 border-ink/15 bg-white ${className}`}
    >
      {groups.map(({ family, colors: familyColors }) => (
        <div
          key={family.slug}
          role="group"
          aria-labelledby={`swatch-family-${family.slug}`}
        >
          <h4
            id={`swatch-family-${family.slug}`}
            className="sticky top-0 z-10 border-y border-mist bg-cloud px-4 py-2 font-display text-sm font-bold text-ink"
          >
            {family.label}
            <span className="ml-2 font-normal text-slate">
              {familyColors.length}
            </span>
          </h4>

          <div className="swatch-grid">
            {familyColors.map((color) => {
              const isSelected = selectedSlugs.includes(color.slug);
              const position = badge?.(color) ?? null;
              return (
                <button
                  key={color.slug}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={disabled}
                  /* The tile is a block of colour, so its name has to come
                     from the label — there is no text inside it. */
                  aria-label={`${color.name}, available in ${listOf(
                    color.materials
                  )}`}
                  /* One tab stop for the whole grid. Tabbing through hundreds
                     of colours to reach the next field is not navigation, it
                     is a punishment. */
                  tabIndex={color.slug === tabbableSlug ? 0 : -1}
                  ref={(node) => {
                    if (node) tiles.current.set(color.slug, node);
                    else tiles.current.delete(color.slug);
                  }}
                  onClick={() => {
                    setFocusSlug(color.slug);
                    onSelect(color);
                  }}
                  onMouseEnter={() => showTip(color)}
                  onFocus={() => showTip(color)}
                  onBlur={() => setTip(null)}
                  className="swatch"
                  style={{ background: fillOf(color) }}
                >
                  {position !== null && (
                    <span aria-hidden="true" className="swatch__badge">
                      {position}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <span
        ref={tipRef}
        aria-hidden="true"
        className={`swatch-tip${tip ? " is-on" : ""}`}
      >
        {tip?.name}
      </span>
    </div>
  );
}
