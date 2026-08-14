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
  return (
    <fieldset
      id="material"
      aria-invalid={Boolean(error)}
      aria-describedby={[error ? "material-error" : "", switchMessage ? "material-switch-message" : ""].filter(Boolean).join(" ") || undefined}
    >
      <legend className="font-display text-lg font-bold text-ink">Material</legend>
      <p className="mt-1 max-w-[65ch] text-sm text-slate">
        Choose based on where the object will live and what it needs to handle.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {MATERIALS.map((material) => {
          const selected = value === material.slug;
          const descriptionId = `material-${material.slug}-description`;

          return (
            <button
              key={material.slug}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-describedby={descriptionId}
              onClick={() => onChange(material.slug)}
              className={`min-h-44 cursor-pointer rounded-[var(--radius-card)] border p-5 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 ${
                selected
                  ? "border-navy bg-cloud shadow-[inset_0_0_0_2px_var(--color-navy)]"
                  : "border-mist bg-white hover:border-navy/50 hover:bg-cloud/50"
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-display text-2xl font-bold text-ink">{material.name}</span>
                <span
                  aria-hidden="true"
                  className={`grid size-7 shrink-0 place-items-center rounded-full border ${
                    selected ? "border-navy bg-navy text-white" : "border-slate/50 text-transparent"
                  }`}
                >
                  ✓
                </span>
              </span>
              <span id={descriptionId} className="mt-4 block text-[15px] leading-relaxed text-slate">
                {material.description}
                <span className="mt-4 block border-t border-mist pt-4 font-mono text-[11px] font-semibold uppercase leading-relaxed tracking-[0.06em] text-navy">
                  {material.property}
                </span>
                <span className="mt-3 block text-sm font-medium text-ink">{material.goodFor}</span>
              </span>
            </button>
          );
        })}
      </div>

      {switchMessage && (
        <p id="material-switch-message" role="status" className="mt-4 rounded-xl bg-cloud px-4 py-3 text-sm font-medium text-ink">
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
