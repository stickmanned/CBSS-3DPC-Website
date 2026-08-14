import "server-only";

import {
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { inArray } from "drizzle-orm";
import { getDatabase, requestFile } from "@/app/lib/db";
import { assertServerOwnedKey, getR2Connection } from "./r2";

const ABANDONED_UPLOAD_GRACE_MS = 24 * 60 * 60 * 1_000;
const MAX_LISTED_OBJECTS_PER_AREA = 10_000;
const MAX_DELETIONS_PER_AREA = 100;

type UploadArea = "temp" | "final";

async function expiredObjectKeys(
  area: UploadArea,
  cutoff: Date,
): Promise<string[]> {
  const { client, bucket } = getR2Connection();
  const keys: string[] = [];
  let scanned = 0;
  let pages = 0;
  let continuationToken: string | undefined;

  do {
    const maxKeys = Math.min(1_000, MAX_LISTED_OBJECTS_PER_AREA - scanned);
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `uploads/${area}/`,
        ContinuationToken: continuationToken,
        MaxKeys: maxKeys,
      }),
    );
    pages += 1;
    scanned += page.Contents?.length ?? 0;

    for (const object of page.Contents ?? []) {
      if (!object.Key || !object.LastModified || object.LastModified > cutoff) continue;
      assertServerOwnedKey(object.Key, area);
      keys.push(object.Key);
      if (keys.length >= MAX_LISTED_OBJECTS_PER_AREA) break;
    }

    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken && scanned < MAX_LISTED_OBJECTS_PER_AREA && pages < 10);

  return keys;
}

async function deleteExactUploadObject(area: UploadArea, key: string): Promise<void> {
  assertServerOwnedKey(key, area);
  const { client, bucket } = getR2Connection();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** Delete exactly one verified final object. The database row is retained. */
export async function deleteRetainedModelObject(key: string): Promise<void> {
  assertServerOwnedKey(key, "final");
  const { client, bucket } = getR2Connection();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * Removes expired upload residue that never became a request. Intent and
 * verified-file tokens live for at most 15 and 30 minutes, respectively, so a
 * 24-hour grace period cannot overlap a valid claim. Database-linked final
 * objects are always preserved for the request retention worker.
 */
export async function deleteAbandonedUploadObjects(now = new Date()): Promise<{
  tempDeleted: number;
  finalDeleted: number;
  failures: number;
}> {
  const cutoff = new Date(now.getTime() - ABANDONED_UPLOAD_GRACE_MS);
  const [tempCandidates, finalCandidates] = await Promise.all([
    expiredObjectKeys("temp", cutoff),
    expiredObjectKeys("final", cutoff),
  ]);

  const finalBatch = finalCandidates.slice(0, MAX_LISTED_OBJECTS_PER_AREA);
  const claimedRows = finalBatch.length
    ? await getDatabase()
        .select({ storageKey: requestFile.storageKey })
        .from(requestFile)
        .where(inArray(requestFile.storageKey, finalBatch))
    : [];
  const claimed = new Set(claimedRows.map((row) => row.storageKey));
  const deletionQueue: Array<{ area: UploadArea; key: string }> = [
    ...tempCandidates
      .slice(0, MAX_DELETIONS_PER_AREA)
      .map((key) => ({ area: "temp" as const, key })),
    ...finalBatch
      .filter((key) => !claimed.has(key))
      .slice(0, MAX_DELETIONS_PER_AREA)
      .map((key) => ({ area: "final" as const, key })),
  ];

  let tempDeleted = 0;
  let finalDeleted = 0;
  let failures = 0;
  for (const item of deletionQueue) {
    try {
      await deleteExactUploadObject(item.area, item.key);
      if (item.area === "temp") tempDeleted += 1;
      else finalDeleted += 1;
    } catch {
      failures += 1;
    }
  }

  return { tempDeleted, finalDeleted, failures };
}
