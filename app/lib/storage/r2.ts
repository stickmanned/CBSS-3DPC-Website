import {
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

type R2Connection = {
  client: S3Client;
  bucket: string;
};

let cachedConnection: R2Connection | undefined;

export class StorageConfigurationError extends Error {
  constructor() {
    super("File storage is not configured.");
    this.name = "StorageConfigurationError";
  }
}

export class StorageVerificationError extends Error {
  constructor() {
    super("The uploaded file could not be verified.");
    this.name = "StorageVerificationError";
  }
}

function r2Endpoint(): string {
  const explicit = process.env.R2_ENDPOINT;
  const accountId = process.env.R2_ACCOUNT_ID;
  const raw = explicit || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  if (!raw) throw new StorageConfigurationError();

  let endpoint: URL;
  try {
    endpoint = new URL(raw);
  } catch {
    throw new StorageConfigurationError();
  }

  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.pathname !== "/" ||
    endpoint.search ||
    endpoint.hash ||
    !endpoint.hostname.endsWith(".r2.cloudflarestorage.com")
  ) {
    throw new StorageConfigurationError();
  }
  return endpoint.origin;
}

export function isStorageConfigured(): boolean {
  return Boolean(
    (process.env.R2_ENDPOINT || process.env.R2_ACCOUNT_ID) &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME,
  );
}

export function getR2Connection(): R2Connection {
  if (cachedConnection) return cachedConnection;

  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!accessKeyId || !secretAccessKey || !bucket) {
    throw new StorageConfigurationError();
  }

  cachedConnection = {
    bucket,
    client: new S3Client({
      region: "auto",
      endpoint: r2Endpoint(),
      credentials: { accessKeyId, secretAccessKey },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    }),
  };
  return cachedConnection;
}

export function assertServerOwnedKey(key: string, area: "temp" | "final"): void {
  const expected = new RegExp(
    `^uploads/${area}/[A-Za-z0-9_-]+\\.(?:stl|3mf)$`,
  );
  if (!expected.test(key)) throw new StorageVerificationError();
}

export async function readObjectRange(
  key: string,
  start: number,
  end: number,
): Promise<Uint8Array> {
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end < start ||
    end - start > 512 * 1024
  ) {
    throw new StorageVerificationError();
  }

  const { client, bucket } = getR2Connection();
  const result = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=${start}-${end}` }),
  );
  if (!result.Body) throw new StorageVerificationError();
  const bytes = await result.Body.transformToByteArray();
  if (bytes.length !== end - start + 1) {
    throw new StorageVerificationError();
  }
  return bytes;
}

export async function deleteTempObject(key: string): Promise<void> {
  assertServerOwnedKey(key, "temp");
  const { client, bucket } = getR2Connection();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function deleteTempObjectQuietly(key: string): Promise<void> {
  try {
    await deleteTempObject(key);
  } catch {
    // Cleanup is best-effort here. The route returns failure and lifecycle cleanup
    // removes any residue without exposing object identifiers in logs.
  }
}

export function resetR2ConnectionForTests(): void {
  cachedConnection?.client.destroy();
  cachedConnection = undefined;
}
