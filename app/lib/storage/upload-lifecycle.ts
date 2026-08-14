import {
  CopyObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type HeadObjectOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { constantTimeEqualStrings } from "@/app/lib/security/hmac-token";
import { assertSafeModelStructure } from "./file-structure";
import {
  assertServerOwnedKey,
  deleteTempObject,
  deleteTempObjectQuietly,
  getR2Connection,
  StorageVerificationError,
} from "./r2";
import {
  downloadContentDisposition,
  normalizeEtag,
  type UploadFormat,
} from "./upload-policy";
import {
  createUploadIntent,
  createVerifiedFileToken,
  emailBinding,
  verifyUploadIntentToken,
  verifyVerifiedFileTokenSignature,
  type UploadIntentPayload,
  type VerifiedFilePayload,
} from "./upload-tokens";

export const UPLOAD_URL_TTL_SECONDS = 10 * 60;
export const DOWNLOAD_URL_TTL_SECONDS = 60;

export type PresignedUpload = {
  uploadUrl: string;
  headers: Record<string, string>;
  intentToken: string;
  expiresIn: number;
};

export type VerifiedFile = {
  token: string;
  file: {
    name: string;
    size: number;
    format: UploadFormat;
    contentType: "model/stl" | "model/3mf";
  };
};

export type CompletionLease = {
  acquire: (nonce: string) => Promise<{
    allowed: boolean;
    retryAfterSeconds?: number;
    leaseVersion?: number;
  }>;
  release: (nonce: string, leaseVersion: number) => Promise<void>;
};

export class CompletionInProgressError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds = 3) {
    super("Upload completion is already in progress.");
    this.name = "CompletionInProgressError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

type ObjectExpectation = Pick<
  UploadIntentPayload,
  "nonce" | "size" | "format" | "contentType"
> & { sourceEtag?: string };

function objectNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate.$metadata?.httpStatusCode === 404 ||
    candidate.name === "NotFound" ||
    candidate.name === "NoSuchKey"
  );
}

async function headObject(key: string): Promise<HeadObjectOutput | null> {
  const { client, bucket } = getR2Connection();
  try {
    return await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    if (objectNotFound(error)) return null;
    throw error;
  }
}

function assertHeadMatches(
  head: HeadObjectOutput,
  expected: ObjectExpectation,
): string {
  if (
    head.ContentLength !== expected.size ||
    head.ContentType?.toLowerCase() !== expected.contentType ||
    head.Metadata?.["upload-nonce"] !== expected.nonce ||
    head.Metadata?.["declared-size"] !== String(expected.size) ||
    head.Metadata?.["file-format"] !== expected.format ||
    (expected.sourceEtag && head.Metadata?.["source-etag"] !== expected.sourceEtag)
  ) {
    throw new StorageVerificationError();
  }
  return normalizeEtag(head.ETag);
}

function copySource(bucket: string, key: string): string {
  return `${encodeURIComponent(bucket)}/${key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

function verifiedResponse(intent: UploadIntentPayload, etag: string): VerifiedFile {
  const verified = createVerifiedFileToken(intent, etag);
  return {
    token: verified.token,
    file: {
      name: intent.name,
      size: intent.size,
      format: intent.format,
      contentType: intent.contentType,
    },
  };
}

async function existingFinal(intent: UploadIntentPayload): Promise<VerifiedFile | null> {
  const finalHead = await headObject(intent.finalKey);
  if (!finalHead) return null;
  const etag = assertHeadMatches(finalHead, intent);
  return verifiedResponse(intent, etag);
}

export async function presignModelUpload(input: {
  name: string;
  contentType: "model/stl" | "model/3mf";
  size: number;
  format: UploadFormat;
  email: string;
}): Promise<PresignedUpload> {
  const { payload, token } = createUploadIntent(input);
  const { client, bucket } = getR2Connection();
  const metadata = {
    "upload-nonce": payload.nonce,
    "declared-size": String(payload.size),
    "file-format": payload.format,
  };

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: payload.tempKey,
    // Content-Length becomes part of the SigV4 signed-header set. The browser
    // supplies the actual File byte length automatically; it cannot reuse this
    // URL for a larger object while the signature is valid.
    ContentLength: payload.size,
    ContentType: payload.contentType,
    CacheControl: "private, no-store",
    Metadata: metadata,
  });
  const metadataHeaderNames = [
    "x-amz-meta-upload-nonce",
    "x-amz-meta-declared-size",
    "x-amz-meta-file-format",
  ];

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: UPLOAD_URL_TTL_SECONDS,
    // The v3 presigner treats Content-Type as unsignable by default; bind it
    // explicitly so the browser cannot change the declared model type.
    signableHeaders: new Set(["cache-control", "content-type"]),
    // Every x-amz-* header is hoisted out of the signed-header set and into
    // the presigned URL's query string by default (@smithy/signature-v4's
    // moveHeadersToQuery). AWS S3 honors metadata supplied that way; R2 does
    // not — a live HeadObject after such a PUT comes back with an empty
    // Metadata object, so completeModelUpload's verification always fails.
    // Marking these unhoistable keeps them as real request headers, where
    // they're covered by X-Amz-SignedHeaders and R2 actually applies them.
    // Confirmed against the live bucket in both directions: hoisted +
    // resent as headers -> SignatureDoesNotMatch; hoisted + not resent ->
    // 200 OK with no metadata attached.
    unhoistableHeaders: new Set(metadataHeaderNames),
  });

  return {
    uploadUrl,
    intentToken: token,
    expiresIn: UPLOAD_URL_TTL_SECONDS,
    headers: {
      "Content-Type": payload.contentType,
      "Cache-Control": "private, no-store",
      "x-amz-meta-upload-nonce": payload.nonce,
      "x-amz-meta-declared-size": String(payload.size),
      "x-amz-meta-file-format": payload.format,
    },
  };
}

export async function completeModelUpload(
  intentToken: string,
  lease: CompletionLease,
): Promise<VerifiedFile> {
  const intent = verifyUploadIntentToken(intentToken);
  assertServerOwnedKey(intent.tempKey, "temp");
  assertServerOwnedKey(intent.finalKey, "final");

  const finalized = await existingFinal(intent);
  if (finalized) return finalized;

  const tempHead = await headObject(intent.tempKey);
  if (!tempHead) throw new StorageVerificationError();

  let sourceEtag: string;
  try {
    sourceEtag = assertHeadMatches(tempHead, intent);
    await assertSafeModelStructure(intent.tempKey, intent.format, intent.size);
  } catch (error) {
    await deleteTempObjectQuietly(intent.tempKey);
    throw error;
  }

  const guard = await lease.acquire(intent.nonce);
  if (!guard.allowed) {
    const completedWhileWaiting = await existingFinal(intent);
    if (completedWhileWaiting) return completedWhileWaiting;
    throw new CompletionInProgressError(guard.retryAfterSeconds);
  }
  if (!Number.isSafeInteger(guard.leaseVersion) || guard.leaseVersion! < 1) {
    throw new Error("Completion lease did not return a fencing version.");
  }
  const leaseVersion = guard.leaseVersion!;

  try {
    const completedAfterLock = await existingFinal(intent);
    if (completedAfterLock) return completedAfterLock;

    const { client, bucket } = getR2Connection();
    await client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: intent.finalKey,
        CopySource: copySource(bucket, intent.tempKey),
        CopySourceIfMatch: tempHead.ETag,
        MetadataDirective: "REPLACE",
        ContentType: intent.contentType,
        CacheControl: "private, no-store",
        ContentDisposition: downloadContentDisposition(intent.name),
        Metadata: {
          "upload-nonce": intent.nonce,
          "declared-size": String(intent.size),
          "file-format": intent.format,
          "source-etag": sourceEtag,
        },
      }),
    );

    const finalHead = await headObject(intent.finalKey);
    if (!finalHead) throw new StorageVerificationError();
    const finalEtag = assertHeadMatches(finalHead, { ...intent, sourceEtag });
    await deleteTempObject(intent.tempKey);
    return verifiedResponse(intent, finalEtag);
  } finally {
    // A crash leaves at most a 30-second lease. Releasing on both success and
    // failure lets a valid intent recover immediately from transient R2 errors.
    await lease.release(intent.nonce, leaseVersion).catch(() => undefined);
  }
}

export async function verifyVerifiedFileToken(
  token: string,
  expectedEmail: string,
): Promise<VerifiedFilePayload> {
  const payload = verifyVerifiedFileTokenSignature(token);
  if (!constantTimeEqualStrings(payload.emailHash, emailBinding(expectedEmail))) {
    throw new StorageVerificationError();
  }
  assertServerOwnedKey(payload.finalKey, "final");

  const head = await headObject(payload.finalKey);
  if (!head) throw new StorageVerificationError();
  const etag = assertHeadMatches(head, payload);
  if (!constantTimeEqualStrings(etag, payload.etag)) {
    throw new StorageVerificationError();
  }
  return payload;
}

export async function createPresignedDownload(input: {
  key: string;
  filename: string;
  contentType: string;
  size: number;
  etag: string;
}): Promise<string> {
  assertServerOwnedKey(input.key, "final");
  const head = await headObject(input.key);
  if (
    !head ||
    head.ContentLength !== input.size ||
    !constantTimeEqualStrings(normalizeEtag(head.ETag), normalizeEtag(input.etag))
  ) {
    throw new StorageVerificationError();
  }

  const { client, bucket } = getR2Connection();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: input.key,
      ResponseContentType: input.contentType,
      ResponseContentDisposition: downloadContentDisposition(input.filename),
      ResponseCacheControl: "private, no-store",
    }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
  );
}
