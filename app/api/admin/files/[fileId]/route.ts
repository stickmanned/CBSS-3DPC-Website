import { z } from "zod";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth/require-admin";
import { genericError } from "@/app/lib/security/request-security";
import { findDownloadableRequestFile } from "@/app/lib/storage/file-store";
import { createPresignedDownload } from "@/app/lib/storage/upload-lifecycle";
import { StorageConfigurationError } from "@/app/lib/storage/r2";

const paramsSchema = z.object({ fileId: z.string().uuid() });

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ fileId: string }> },
) {
  try {
    await requireAdmin();
    const { fileId } = paramsSchema.parse(await context.params);
    const file = await findDownloadableRequestFile(fileId);
    if (!file) return genericError(404);

    const url = await createPresignedDownload({
      key: file.storageKey,
      filename: file.originalName,
      contentType: file.fileKind === "stl" ? "model/stl" : "model/3mf",
      size: file.verifiedByteSize,
      etag: file.etag,
    });
    const response = NextResponse.redirect(url, { status: 307 });
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    if (error instanceof StorageConfigurationError) return genericError(503);
    return genericError(404);
  }
}
