import { describe, expect, it } from "vitest";
import { triangleCount } from "@/app/components/admin/AdminModelViewer";

/** Minimal stand-ins for three.js BufferGeometry — only the two accessors used. */
function geometry(options: { position?: number; index?: number }) {
  return {
    getIndex: () => (options.index == null ? null : { count: options.index }),
    getAttribute: (name: string) =>
      name === "position" && options.position != null ? { count: options.position } : undefined,
  } as unknown as Parameters<typeof triangleCount>[0];
}

describe("triangleCount", () => {
  it("counts non-indexed geometry by vertices, as STL parses", () => {
    // A box is 12 triangles; non-indexed that is 36 positions.
    expect(triangleCount(geometry({ position: 36 }))).toBe(12);
  });

  it("counts indexed geometry by its index, as 3MF parses", () => {
    // The same box indexed: 8 unique vertices, 36 index entries. Reading the
    // position count here would report 2 triangles instead of 12.
    expect(triangleCount(geometry({ position: 8, index: 36 }))).toBe(12);
  });

  it("reports nothing for empty geometry", () => {
    expect(triangleCount(geometry({}))).toBe(0);
    expect(triangleCount(geometry({ position: 0 }))).toBe(0);
  });
});
