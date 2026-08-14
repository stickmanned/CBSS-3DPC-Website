import { findDownloadableRequestFile as findFile } from "@/app/lib/queue/repository";

export type DownloadableRequestFile = {
  id: string;
  requestId: string;
  storageKey: string;
  originalName: string;
  verifiedByteSize: number;
  fileKind: "stl" | "3mf";
  etag: string;
};

export async function findDownloadableRequestFile(
  fileId: string,
): Promise<DownloadableRequestFile | null> {
  const file = await findFile(fileId);
  if (!file || (file.fileKind !== "stl" && file.fileKind !== "3mf")) return null;
  return {
    id: file.id,
    requestId: file.requestId,
    storageKey: file.storageKey,
    originalName: file.originalName,
    verifiedByteSize: file.verifiedByteSize,
    fileKind: file.fileKind,
    etag: file.etag,
  };
}
