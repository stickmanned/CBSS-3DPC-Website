import { describe, expect, it } from "vitest";
import {
  adminTransitionSchema,
  csvFilterSchema,
  submissionSchema,
  uploadMetadataSchema,
  vancouverDateOnly,
} from "../../app/lib/queue/schemas";
import { recognizeModelLink } from "../../app/lib/queue/model-links";

const validSubmission = {
  requesterName: "  Alex   Smith ",
  requesterEmail: " ALEX@SD43.BC.CA ",
  quantity: 1,
  purpose: "Prototype enclosure",
  material: "pla",
  colors: ["  Signal Yellow ", "Navy"],
  modelUrl: "https://www.printables.com/model/42-example#files",
  idempotencyKey: "request-12345678",
};

describe("submissionSchema", () => {
  it("normalizes names, email, colors, and model URLs", () => {
    const parsed = submissionSchema.parse(validSubmission);
    expect(parsed.requesterName).toBe("Alex Smith");
    expect(parsed.requesterEmail).toBe("alex@sd43.bc.ca");
    expect(parsed.colors).toEqual(["Signal Yellow", "Navy"]);
    expect(parsed.modelUrl).toBe("https://www.printables.com/model/42-example");
  });

  it.each([0, 51])("rejects quantity %s", (quantity) => {
    expect(submissionSchema.safeParse({ ...validSubmission, quantity }).success).toBe(false);
  });

  it("allows club's choice and rejects more than four ordered colors", () => {
    expect(submissionSchema.safeParse({ ...validSubmission, colors: [] }).success).toBe(true);
    expect(
      submissionSchema.safeParse({
        ...validSubmission,
        colors: ["one", "two", "three", "four", "five"],
      }).success,
    ).toBe(false);
  });

  it("rejects a past deadline", () => {
    const yesterday = new Date(Date.now() - 48 * 60 * 60 * 1_000);
    expect(
      submissionSchema.safeParse({
        ...validSubmission,
        deadline: vancouverDateOnly(yesterday),
      }).success,
    ).toBe(false);
  });

  it("requires a model URL or verified file token", () => {
    expect(
      submissionSchema.safeParse({
        ...validSubmission,
        modelUrl: undefined,
        fileToken: undefined,
      }).success,
    ).toBe(false);
    expect(
      submissionSchema.safeParse({
        ...validSubmission,
        modelUrl: undefined,
        fileToken: "v".repeat(64),
      }).success,
    ).toBe(true);
  });
});

describe("model link recognition", () => {
  it.each([
    ["https://makerworld.com/en/models/1", "makerworld"],
    ["https://www.printables.com/model/1", "printables"],
    ["https://thingiverse.com/thing:1", "thingiverse"],
    ["https://thangs.com/designer/example", "thangs"],
    ["https://example.org/model", "other"],
  ])("recognizes %s as %s", (url, provider) => {
    expect(recognizeModelLink(url).provider).toBe(provider);
  });

  it("rejects non-HTTPS links", () => {
    expect(() => recognizeModelLink("http://printables.com/model/1")).toThrow();
  });
});

describe("other queue schemas", () => {
  it("accepts verified upload metadata when preview generation was unavailable", () => {
    expect(
      uploadMetadataSchema.parse({
        storageKey: "uploads/final/abc.stl",
        originalName: "part.stl",
        verifiedByteSize: 42,
        fileKind: "stl",
        etag: "etag",
      }),
    ).toMatchObject({ storageKey: "uploads/final/abc.stl" });
  });

  it("requires a reason from the target status's catalog", () => {
    const base = {
      requestId: "481b7ef7-50a5-41bc-930f-0ba3d700f021",
      expectedVersion: 2,
    };
    expect(
      adminTransitionSchema.safeParse({ ...base, toStatus: "print_failed" }).success,
    ).toBe(false);
    expect(
      adminTransitionSchema.safeParse({
        ...base,
        toStatus: "print_failed",
        reasonKey: "layer_shift",
      }).success,
    ).toBe(true);
  });

  it("rejects forged or reserved reasons on transitions that take no reason", () => {
    const base = {
      requestId: "481b7ef7-50a5-41bc-930f-0ba3d700f021",
      expectedVersion: 2,
      toStatus: "under_review",
    };
    expect(adminTransitionSchema.safeParse(base).success).toBe(true);
    expect(
      adminTransitionSchema.safeParse({ ...base, reasonKey: "uncollected_14d" }).success,
    ).toBe(false);
    expect(
      adminTransitionSchema.safeParse({ ...base, reasonKey: "file_purged_90d" }).success,
    ).toBe(false);
    expect(
      adminTransitionSchema.safeParse({ ...base, reasonKey: "made_up_reason" }).success,
    ).toBe(false);
  });

  it("normalizes CSV filters and checks the date range", () => {
    expect(csvFilterSchema.parse({ statuses: "queued,printing" }).statuses).toEqual([
      "queued",
      "printing",
    ]);
    expect(
      csvFilterSchema.safeParse({ createdFrom: "2026-08-13", createdTo: "2026-08-12" })
        .success,
    ).toBe(false);
  });
});
