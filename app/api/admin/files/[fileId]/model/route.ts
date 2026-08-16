import { z } from "zod";
import { requireAdmin } from "@/app/lib/auth/require-admin";
import { genericError } from "@/app/lib/security/request-security";
import { findDownloadableRequestFile } from "@/app/lib/storage/file-store";
import { createPresignedDownload } from "@/app/lib/storage/upload-lifecycle";
import { StorageConfigurationError } from "@/app/lib/storage/r2";
import { PREVIEW_MAX_BYTES } from "@/app/lib/storage/upload-policy";

const paramsSchema = z.object({ fileId: z.string().uuid() });

export const runtime = "nodejs";

/**
 * The sibling route hands the browser a presigned R2 URL, which is right for a
 * download but useless to `fetch()` — the bucket's CORS policy allows PUT only,
 * by design. Serving the bytes from our own origin keeps the viewer working
 * without widening that policy, at the cost of the transfer passing through here.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ fileId: string }> },
) {
  try {
    await requireAdmin();
    const { fileId } = paramsSchema.parse(await context.params);
    const file = await findDownloadableRequestFile(fileId);
    if (!file) return genericError(404);
    if (file.verifiedByteSize > PREVIEW_MAX_BYTES) return genericError(413);

    const url = await createPresignedDownload({
      key: file.storageKey,
      filename: file.originalName,
      contentType: file.fileKind === "stl" ? "model/stl" : "model/3mf",
      size: file.verifiedByteSize,
      etag: file.etag,
    });

    const upstream = await fetch(url);
    if (!upstream.ok || !upstream.body) {
      return genericError(404, {
        route: "admin/files/model",
        error: new Error(`upstream ${upstream.status}`),
      });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        // Deliberately not the model media type: the browser never renders this
        // directly, and an opaque type keeps it from being treated as anything.
        "Content-Type": "application/octet-stream",
        "Content-Length": String(file.verifiedByteSize),
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    const cause = { route: "admin/files/model", error };
    if (error instanceof StorageConfigurationError) return genericError(503, cause);
    return genericError(404, cause);
  }
}
