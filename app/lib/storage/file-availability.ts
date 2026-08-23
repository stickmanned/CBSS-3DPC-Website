import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { getR2Connection } from "./r2";

/**
 * Whether the bytes behind a request file are still in the bucket.
 *
 * The database row and the object have separate lifetimes, and the row is the
 * one that survives. The retention worker deletes a picked-up model 90 days on
 * and stamps `purgedAt`, which the admin page already reads. What it could not
 * see was the other way for an object to vanish — deleted without the row ever
 * being stamped. Then the page offered a viewer that 404s and a download button
 * that redirected the admin to a raw `NoSuchKey` XML document from R2, which
 * reads like the site is broken rather than like the file is gone.
 *
 * Asking the bucket covers both causes at once: a purged object and a lost one
 * are equally absent, and neither should be offered for download.
 *
 * "unknown" exists so a credential or network fault cannot masquerade as a
 * missing file and hide a model that is really there. Callers treat it as
 * present, because wrongly hiding a working download is worse than showing one
 * that might fail.
 */
export type ModelPresence = "present" | "missing" | "unknown";

export async function modelObjectPresence(key: string): Promise<ModelPresence> {
  try {
    const { client, bucket } = getR2Connection();
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return "present";
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;
    const status = (error as { $metadata?: { httpStatusCode?: number } } | null)
      ?.$metadata?.httpStatusCode;
    if (name === "NotFound" || name === "NoSuchKey" || status === 404) return "missing";
    console.error(
      `[file-availability] could not determine presence of ${key}:`,
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
    return "unknown";
  }
}
