import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InvalidTokenError } from "@/app/lib/security/hmac-token";
import {
  createUploadIntent,
  createVerifiedFileToken,
  verifyUploadIntentToken,
  verifyVerifiedFileTokenSignature,
} from "@/app/lib/storage/upload-tokens";

const SECRET = "test-only-upload-token-secret-32-bytes-minimum";

describe("upload HMAC tokens", () => {
  beforeEach(() => {
    process.env.UPLOAD_TOKEN_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.UPLOAD_TOKEN_SECRET;
  });

  it("rejects tampered and expired upload intents", () => {
    const now = Date.UTC(2026, 7, 14, 12);
    const intent = createUploadIntent({
      name: "part.stl",
      contentType: "model/stl",
      size: 84,
      format: "stl",
      email: "student@sd43.bc.ca",
      now,
    });

    const [payload, signature] = intent.token.split(".");
    const replacement = signature.startsWith("A") ? "B" : "A";
    const tampered = `${payload}.${replacement}${signature.slice(1)}`;
    expect(() => verifyUploadIntentToken(tampered, now)).toThrow(InvalidTokenError);
    expect(() => verifyUploadIntentToken(`${intent.token}=`, now)).toThrow(
      InvalidTokenError,
    );
    expect(() => verifyUploadIntentToken(intent.token, now + 16 * 60 * 1_000)).toThrow(
      InvalidTokenError,
    );
  });

  it("uses random server-owned keys and carries the exact verified ETag", () => {
    const now = Date.UTC(2026, 7, 14, 12);
    const first = createUploadIntent({
      name: "part.stl",
      contentType: "model/stl",
      size: 134,
      format: "stl",
      email: "student@sd43.bc.ca",
      now,
    });
    const second = createUploadIntent({
      name: "part.stl",
      contentType: "model/stl",
      size: 134,
      format: "stl",
      email: "student@sd43.bc.ca",
      now,
    });
    expect(first.payload.tempKey).toMatch(/^uploads\/temp\/[A-Za-z0-9_-]+\.stl$/);
    expect(first.payload.finalKey).toMatch(/^uploads\/final\/[A-Za-z0-9_-]+\.stl$/);
    expect(first.payload.tempKey).not.toBe(second.payload.tempKey);
    expect(first.payload.finalKey).not.toBe(second.payload.finalKey);

    const verified = createVerifiedFileToken(first.payload, "abc123", now);
    expect(verifyVerifiedFileTokenSignature(verified.token, now).etag).toBe("abc123");
  });
});
