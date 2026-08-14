import {
  CopyObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storageState = vi.hoisted(() => ({
  objects: new Map<string, {
    size: number;
    contentType: string;
    etag: string;
    metadata: Record<string, string>;
  }>(),
  copies: 0,
  deletes: 0,
  failNextCopy: false,
  presignedInput: null as null | { ContentLength?: number; ContentType?: string },
  presignOptions: null as null | { signableHeaders?: Set<string> },
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async (
    _client: unknown,
    command: { input: { ContentLength?: number; ContentType?: string } },
    options: { signableHeaders?: Set<string> },
  ) => {
    storageState.presignedInput = command.input;
    storageState.presignOptions = options;
    return "https://upload.example.test/signed";
  }),
}));

vi.mock("@/app/lib/storage/file-structure", () => ({
  assertSafeModelStructure: vi.fn(async () => undefined),
}));

vi.mock("@/app/lib/storage/r2", async () => {
  const actual = await vi.importActual<typeof import("@/app/lib/storage/r2")>(
    "@/app/lib/storage/r2",
  );
  const client = {
    send: vi.fn(async (command: HeadObjectCommand | CopyObjectCommand) => {
      if (command instanceof HeadObjectCommand) {
        const object = storageState.objects.get(command.input.Key!);
        if (!object) throw { name: "NotFound", $metadata: { httpStatusCode: 404 } };
        return {
          ContentLength: object.size,
          ContentType: object.contentType,
          ETag: `"${object.etag}"`,
          Metadata: object.metadata,
        };
      }
      if (command instanceof CopyObjectCommand) {
        if (storageState.failNextCopy) {
          storageState.failNextCopy = false;
          throw new Error("transient copy failure");
        }
        const sourceKey = decodeURIComponent(command.input.CopySource!).split("/").slice(1).join("/");
        const source = storageState.objects.get(sourceKey);
        if (!source || command.input.CopySourceIfMatch !== `"${source.etag}"`) {
          throw new Error("copy precondition failed");
        }
        storageState.copies += 1;
        storageState.objects.set(command.input.Key!, {
          size: source.size,
          contentType: command.input.ContentType!,
          etag: "final-etag",
          metadata: command.input.Metadata!,
        });
        return {};
      }
      throw new Error("unexpected command");
    }),
  };

  return {
    ...actual,
    getR2Connection: () => ({ bucket: "test-bucket", client }),
    deleteTempObject: vi.fn(async (key: string) => {
      storageState.deletes += 1;
      storageState.objects.delete(key);
    }),
    deleteTempObjectQuietly: vi.fn(async (key: string) => {
      storageState.deletes += 1;
      storageState.objects.delete(key);
    }),
  };
});

import {
  completeModelUpload,
  presignModelUpload,
} from "@/app/lib/storage/upload-lifecycle";
import {
  createUploadIntent,
  verifyUploadIntentToken,
} from "@/app/lib/storage/upload-tokens";

describe("immutable upload completion", () => {
  beforeEach(() => {
    process.env.UPLOAD_TOKEN_SECRET = "test-only-upload-token-secret-32-bytes-minimum";
    storageState.objects.clear();
    storageState.copies = 0;
    storageState.deletes = 0;
    storageState.failNextCopy = false;
    storageState.presignedInput = null;
    storageState.presignOptions = null;
  });

  it("binds the declared byte length and content type into the PUT signature", async () => {
    await presignModelUpload({
      name: "part.stl",
      contentType: "model/stl",
      size: 134,
      format: "stl",
      email: "student@sd43.bc.ca",
    });

    expect(storageState.presignedInput).toMatchObject({
      ContentLength: 134,
      ContentType: "model/stl",
    });
    expect(storageState.presignOptions?.signableHeaders).toEqual(
      new Set(["cache-control", "content-type"]),
    );
  });

  it("copies once to the random final key and treats replay as an idempotent read", async () => {
    const created = createUploadIntent({
      name: "part.stl",
      contentType: "model/stl",
      size: 134,
      format: "stl",
      email: "student@sd43.bc.ca",
    });
    const intent = verifyUploadIntentToken(created.token);
    storageState.objects.set(intent.tempKey, {
      size: intent.size,
      contentType: intent.contentType,
      etag: "source-etag",
      metadata: {
        "upload-nonce": intent.nonce,
        "declared-size": String(intent.size),
        "file-format": intent.format,
      },
    });

    const acquire = vi.fn(async () => ({ allowed: true, leaseVersion: 1 }));
    const release = vi.fn(async () => undefined);
    const lease = { acquire, release };
    const first = await completeModelUpload(created.token, lease);
    expect(first.file.name).toBe("part.stl");
    expect(storageState.copies).toBe(1);
    expect(storageState.deletes).toBe(1);

    // The old PUT URL may recreate/overwrite only the temporary object.
    storageState.objects.set(intent.tempKey, {
      size: intent.size,
      contentType: intent.contentType,
      etag: "different-source",
      metadata: {
        "upload-nonce": intent.nonce,
        "declared-size": String(intent.size),
        "file-format": intent.format,
      },
    });
    const replay = await completeModelUpload(created.token, lease);
    expect(replay.file.name).toBe("part.stl");
    expect(storageState.copies).toBe(1);
    expect(acquire).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("rejects and cleans a temp object whose real size differs", async () => {
    const created = createUploadIntent({
      name: "part.stl",
      contentType: "model/stl",
      size: 134,
      format: "stl",
      email: "student@sd43.bc.ca",
    });
    const intent = verifyUploadIntentToken(created.token);
    storageState.objects.set(intent.tempKey, {
      size: 135,
      contentType: intent.contentType,
      etag: "source-etag",
      metadata: {
        "upload-nonce": intent.nonce,
        "declared-size": String(intent.size),
        "file-format": intent.format,
      },
    });

    await expect(
      completeModelUpload(created.token, {
        acquire: async () => ({ allowed: true, leaseVersion: 1 }),
        release: async () => undefined,
      }),
    ).rejects.toThrow();
    expect(storageState.objects.has(intent.tempKey)).toBe(false);
    expect(storageState.copies).toBe(0);
  });

  it("releases the completion lease so a transient R2 failure can be retried", async () => {
    const created = createUploadIntent({
      name: "part.stl",
      contentType: "model/stl",
      size: 134,
      format: "stl",
      email: "student@sd43.bc.ca",
    });
    const intent = verifyUploadIntentToken(created.token);
    storageState.objects.set(intent.tempKey, {
      size: intent.size,
      contentType: intent.contentType,
      etag: "source-etag",
      metadata: {
        "upload-nonce": intent.nonce,
        "declared-size": String(intent.size),
        "file-format": intent.format,
      },
    });
    storageState.failNextCopy = true;

    let held = false;
    const lease = {
      acquire: vi.fn(async () => {
        if (held) return { allowed: false, retryAfterSeconds: 30 };
        held = true;
        return { allowed: true, leaseVersion: 1 };
      }),
      release: vi.fn(async () => {
        held = false;
      }),
    };

    await expect(completeModelUpload(created.token, lease)).rejects.toThrow(
      "transient copy failure",
    );
    await expect(completeModelUpload(created.token, lease)).resolves.toMatchObject({
      file: { name: "part.stl" },
    });
    expect(lease.acquire).toHaveBeenCalledTimes(2);
    expect(lease.release).toHaveBeenCalledTimes(2);
    expect(storageState.copies).toBe(1);
  });
});
