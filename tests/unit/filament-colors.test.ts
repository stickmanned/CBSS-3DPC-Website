import { describe, expect, it } from "vitest";
import { COLOR_FAMILIES, FILAMENT_COLORS } from "@/app/lib/filament-colors";

describe("filament catalog", () => {
  it("contains the exact 238-option catalog and family counts", () => {
    expect(FILAMENT_COLORS).toHaveLength(238);
    expect(COLOR_FAMILIES.reduce((total, family) => total + family.count, 0)).toBe(238);

    for (const family of COLOR_FAMILIES) {
      expect(FILAMENT_COLORS.filter((color) => color.family === family.slug)).toHaveLength(
        family.count,
      );
    }
  });

  it("uses unique stable slugs and valid swatch metadata", () => {
    expect(new Set(FILAMENT_COLORS.map((color) => color.slug)).size).toBe(238);
    for (const color of FILAMENT_COLORS) {
      expect(color.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(color.hex).toMatch(/^#[0-9A-F]{6}$/i);
      expect(color.materials.length).toBeGreaterThan(0);
    }
  });

  it("counts multicolor spools as one PLA slot and narrows ASA choices", () => {
    const gradients = FILAMENT_COLORS.filter(
      (color) => color.family === "multicolor-gradient",
    );
    expect(gradients).toHaveLength(32);
    expect(gradients.every((color) => color.materials.join(",") === "PLA")).toBe(true);

    const asa = FILAMENT_COLORS.filter((color) => color.materials.includes("ASA"));
    expect(asa.length).toBeGreaterThan(5);
    expect(asa.length).toBeLessThan(40);
    expect(asa.some((color) => color.name.startsWith("Silk"))).toBe(false);
  });
});

