import { describe, expect, it } from "vitest";
import { colorsUnavailableForMaterial } from "../../app/components/request/ColorPicker";
import {
  getQuantityNote,
  getSchoolEmailWarning,
  moveItem,
  recognizeModelSource,
  validateModelFile,
  validateRequest,
} from "../../app/components/request/request-form-utils";

const validRequest = {
  requesterName: "Ada Student",
  requesterEmail: "ada@sd43.bc.ca",
  quantity: "1",
  deadline: "",
  purpose: "A bracket for a robotics project",
  modelUrl: "https://www.printables.com/model/123",
  material: "pla" as const,
  colorSlugs: [] as string[],
  verifiedFileToken: "",
};

describe("request form validation", () => {
  it("reports every required part of an empty request", () => {
    const errors = validateRequest(
      {
        ...validRequest,
        requesterName: "",
        requesterEmail: "",
        quantity: "0",
        purpose: "",
        modelUrl: "",
        material: "",
      },
      "2026-08-13",
    );

    expect(errors.requesterName).toBeTruthy();
    expect(errors.requesterEmail).toBeTruthy();
    expect(errors.quantity).toBeTruthy();
    expect(errors.purpose).toBeTruthy();
    expect(errors.material).toBeTruthy();
    expect(errors.modelSource).toBeTruthy();
  });

  it("accepts non-SD43 email with a soft warning", () => {
    const errors = validateRequest(
      { ...validRequest, requesterEmail: "ada@example.com" },
      "2026-08-13",
    );
    expect(errors.requesterEmail).toBeUndefined();
    expect(getSchoolEmailWarning("ada@example.com")).toContain("still accepted");
    expect(getSchoolEmailWarning("ada@sd43.bc.ca")).toBe("");
  });

  it.each(["0", "51", "1.5", "not-a-number"])("rejects invalid quantity %s", (quantity) => {
    expect(validateRequest({ ...validRequest, quantity }, "2026-08-13").quantity).toBeTruthy();
  });

  it("notes larger requests without promising timing", () => {
    const note = getQuantityNote("6");
    expect(note).toContain("closer review");
    expect(note).not.toMatch(/day|week|hour/i);
  });

  it("rejects past deadlines and insecure model URLs", () => {
    expect(
      validateRequest(
        { ...validRequest, deadline: "2026-08-12", modelUrl: "http://example.com/model" },
        "2026-08-13",
      ),
    ).toMatchObject({ deadline: expect.any(Array), modelUrl: expect.any(Array) });
  });

  it("recognizes known model hosts without rejecting other HTTPS links", () => {
    expect(recognizeModelSource("https://makerworld.com/en/models/1")).toBe("MakerWorld");
    expect(recognizeModelSource("https://subdomain.thangs.com/designer/example")).toBe("Thangs");
    expect(recognizeModelSource("https://example.com/model")).toBeNull();
    expect(validateRequest({ ...validRequest, modelUrl: "https://example.com/model" }).modelUrl).toBeUndefined();
  });
});

describe("model file validation", () => {
  it("accepts STL and 3MF case-insensitively", () => {
    expect(validateModelFile({ name: "part.STL", size: 2048 })).toBe("");
    expect(validateModelFile({ name: "part.3mf", size: 2048 })).toBe("");
  });

  it("rejects unsupported, empty, and oversized files", () => {
    expect(validateModelFile({ name: "part.obj", size: 2048 })).toContain("STL or 3MF");
    expect(validateModelFile({ name: "part.stl", size: 0 })).toContain("empty");
    expect(validateModelFile({ name: "part.stl", size: 50 * 1024 * 1024 + 1 })).toContain(
      "larger than 50 MiB",
    );
  });
});

describe("ordered color choices", () => {
  it("moves selections without mutating the source", () => {
    const source = ["red", "blue", "green"];
    expect(moveItem(source, 2, 1)).toEqual(["red", "green", "blue"]);
    expect(source).toEqual(["red", "blue", "green"]);
  });

  it("identifies colors that block a material switch", () => {
    expect(colorsUnavailableForMaterial(["jade-white"], "petg").map((color) => color.slug)).toEqual([
      "jade-white",
    ]);
    expect(colorsUnavailableForMaterial(["white"], "asa")).toEqual([]);
  });
});

