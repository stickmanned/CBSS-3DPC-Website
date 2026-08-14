import { describe, expect, it } from "vitest";
import {
  assertHumanTiming,
  canonicalContentType,
  formatFromFilename,
  sanitizeFilename,
  UploadPolicyError,
} from "@/app/lib/storage/upload-policy";

describe("upload policy", () => {
  it("removes path and header injection from original filenames", () => {
    expect(sanitizeFilename("../../student\r\nmodel.STL")).toBe("studentmodel.stl");
    expect(formatFromFilename(sanitizeFilename("..\\folder\\model.3MF"))).toBe("3mf");
  });

  it("canonicalizes known browser types and rejects cross-format types", () => {
    expect(canonicalContentType("stl", "application/octet-stream")).toBe("model/stl");
    expect(canonicalContentType("3mf", "application/zip")).toBe("model/3mf");
    expect(() => canonicalContentType("stl", "application/zip")).toThrow(UploadPolicyError);
  });

  it("always rejects honeypots and implausibly fast form fills", () => {
    const now = 2_000_000;
    expect(() => assertHumanTiming("bot", now - 10_000, now)).toThrow(UploadPolicyError);
    expect(() => assertHumanTiming("", now - 100, now)).toThrow(UploadPolicyError);
    expect(() => assertHumanTiming("", now - 2_000, now)).not.toThrow();
  });
});
