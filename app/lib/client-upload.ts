import type { BoundingBoxMm } from "../components/request/types";

type PresignResponse = {
  uploadUrl: string;
  headers: Record<string, string>;
  intentToken: string;
  expiresIn?: number;
};

type CompleteResponse = {
  verifiedFileToken: string;
  file: {
    name: string;
    size: number;
    format: string;
    bboxMm?: BoundingBoxMm;
    thumbnail?: string | null;
  };
};

export type ClientUploadResult = CompleteResponse & {
  bboxMm: BoundingBoxMm;
  thumbnail: string | null;
};

export class ClientUploadError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ClientUploadError";
  }
}

async function readError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    return body.error || body.message || fallback;
  } catch {
    return fallback;
  }
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new ClientUploadError(
      await readError(response, "The upload service could not complete that request."),
      response.status,
    );
  }

  return (await response.json()) as T;
}

function putFile({
  uploadUrl,
  headers,
  file,
  signal,
  onProgress,
}: {
  uploadUrl: string;
  headers: Record<string, string>;
  file: File;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
}) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abort);
      callback();
    };

    const abort = () => {
      request.abort();
      finish(() => reject(new DOMException("The upload was cancelled.", "AbortError")));
    };

    request.open("PUT", uploadUrl, true);
    Object.entries(headers).forEach(([name, value]) => request.setRequestHeader(name, value));

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    });

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100);
        finish(resolve);
        return;
      }

      finish(() =>
        reject(new ClientUploadError("The model could not be uploaded. Try again.", request.status)),
      );
    });
    request.addEventListener("error", () =>
      finish(() => reject(new ClientUploadError("The upload lost its connection. Try again."))),
    );
    request.addEventListener("abort", () =>
      finish(() => reject(new DOMException("The upload was cancelled.", "AbortError"))),
    );

    if (signal?.aborted) {
      abort();
      return;
    }

    signal?.addEventListener("abort", abort, { once: true });
    request.send(file);
  });
}

export async function uploadModelFile({
  file,
  email,
  formStartedAt,
  website,
  thumbnail,
  bboxMm,
  onProgress,
  turnstileToken,
  onTurnstileConsumed,
  signal,
}: {
  file: File;
  email: string;
  formStartedAt: number;
  website: string;
  thumbnail: string | null;
  bboxMm: BoundingBoxMm;
  onProgress?: (percent: number) => void;
  turnstileToken?: string;
  onTurnstileConsumed?: () => void;
  signal?: AbortSignal;
}): Promise<ClientUploadResult> {
  onProgress?.(0);

  let presign: PresignResponse;
  try {
    presign = await postJson<PresignResponse>(
      "/api/uploads/presign",
      {
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        email: email.trim(),
        formStartedAt,
        website,
        turnstileToken: turnstileToken || undefined,
      },
      signal,
    );
  } finally {
    // Siteverify tokens are single-use even when a later presign step fails.
    // Reset after every attempt that sent one so the next retry is usable.
    if (turnstileToken) onTurnstileConsumed?.();
  }

  await putFile({
    uploadUrl: presign.uploadUrl,
    headers: presign.headers ?? {},
    file,
    signal,
    onProgress,
  });

  const completed = await postJson<CompleteResponse>(
    "/api/uploads/complete",
    {
      intentToken: presign.intentToken,
      thumbnail,
      bboxMm,
    },
    signal,
  );

  return { ...completed, bboxMm, thumbnail };
}
