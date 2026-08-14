"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { uploadModelFile } from "../../lib/client-upload";
import ModelPreview from "./ModelPreview";
import { formatFileSize, isValidEmail, validateModelFile } from "./request-form-utils";
import type { PreviewMetadata, VerifiedUpload } from "./types";

type Stage = "idle" | "parsing" | "ready" | "uploading" | "uploaded" | "error";

export default function ModelFileUpload({
  email,
  getFormStartedAt,
  website,
  turnstileRequired,
  turnstileToken,
  onTurnstileConsumed,
  disabled,
  error,
  onVerified,
}: {
  email: string;
  getFormStartedAt: () => number;
  website: string;
  turnstileRequired: boolean;
  turnstileToken: string;
  onTurnstileConsumed: () => void;
  disabled: boolean;
  error?: string;
  onVerified: (upload: VerifiedUpload | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewMetadata | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [localError, setLocalError] = useState("");
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const [verified, setVerified] = useState<VerifiedUpload | null>(null);

  const clearVerification = useCallback(() => {
    setVerified(null);
    onVerified(null);
  }, [onVerified]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const verificationNeedsRefresh = Boolean(
    verified && verified.uploadedForEmail !== email.trim().toLowerCase(),
  );
  const displayedStage: Stage = verificationNeedsRefresh ? "ready" : stage;
  const displayedNotice = verificationNeedsRefresh
    ? "Your email changed. Upload the model again so the private file stays tied to the right request."
    : notice;
  const displayedError =
    (localError.startsWith("Enter a valid email") && isValidEmail(email)) ||
    (localError.startsWith("Complete the security check") && turnstileToken)
      ? ""
      : localError;
  const buildPlate = (() => {
    const x = Number(process.env.NEXT_PUBLIC_BUILD_PLATE_X_MM);
    const y = Number(process.env.NEXT_PUBLIC_BUILD_PLATE_Y_MM);
    const z = Number(process.env.NEXT_PUBLIC_BUILD_PLATE_Z_MM);
    return [x, y, z].every((value) => Number.isFinite(value) && value > 0)
      ? { x, y, z }
      : null;
  })();
  const exceedsConfiguredBuildPlate = Boolean(
    preview &&
      buildPlate &&
      (preview.bboxMm.x > buildPlate.x ||
        preview.bboxMm.y > buildPlate.y ||
        preview.bboxMm.z > buildPlate.z),
  );

  function chooseFile(nextFile: File | null, droppedCount = 1) {
    abortRef.current?.abort();
    clearVerification();
    setNotice("");
    setProgress(0);
    setPreview(null);

    if (droppedCount > 1) {
      setFile(null);
      setStage("error");
      setLocalError("Choose one model file at a time.");
      return;
    }

    if (!nextFile) return;
    const validationError = validateModelFile(nextFile);
    if (validationError) {
      setFile(null);
      setStage("error");
      setLocalError(validationError);
      return;
    }

    setFile(nextFile);
    setStage("parsing");
    setLocalError("");
  }

  const handlePreviewReady = useCallback((metadata: PreviewMetadata) => {
    setPreview(metadata);
    setStage("ready");
    setLocalError("");
    setNotice(
      metadata.webglAvailable
        ? "Model checked locally. Upload it when you are ready."
        : "Model checked locally. The visual preview is unavailable, but you can still upload it.",
    );
  }, []);

  const handlePreviewError = useCallback((message: string) => {
    setPreview(null);
    setStage("error");
    setLocalError(message);
    clearVerification();
  }, [clearVerification]);

  async function startUpload() {
    if (!file || !preview || disabled || stage === "uploading") return;
    if (!isValidEmail(email)) {
      setLocalError("Enter a valid email above before uploading. The private file must be tied to your request.");
      document.getElementById("requesterEmail")?.focus();
      return;
    }
    if (turnstileRequired && !turnstileToken) {
      setLocalError("Complete the security check below before uploading your model.");
      document.getElementById("turnstile")?.scrollIntoView({ block: "center" });
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    clearVerification();
    setStage("uploading");
    setProgress(0);
    setLocalError("");
    setNotice("Uploading directly to the club’s private file storage.");

    try {
      const result = await uploadModelFile({
        file,
        email,
        formStartedAt: getFormStartedAt(),
        website,
        turnstileToken,
        onTurnstileConsumed,
        thumbnail: preview.thumbnail,
        bboxMm: preview.bboxMm,
        onProgress: setProgress,
        signal: controller.signal,
      });
      const next: VerifiedUpload = {
        verifiedFileToken: result.verifiedFileToken,
        file: result.file,
        bboxMm: result.file.bboxMm ?? result.bboxMm,
        thumbnail: result.file.thumbnail ?? result.thumbnail,
        uploadedForEmail: email.trim().toLowerCase(),
      };
      setVerified(next);
      onVerified(next);
      setStage("uploaded");
      setProgress(100);
      setNotice("Upload complete and verified. The model is ready to include with this request.");
    } catch (uploadError: unknown) {
      if (uploadError instanceof DOMException && uploadError.name === "AbortError") return;
      setStage("error");
      setLocalError(
        uploadError instanceof Error
          ? uploadError.message
          : "The model could not be uploaded. Your form details are still here; try again.",
      );
      clearVerification();
    }
  }

  function clearFile() {
    abortRef.current?.abort();
    clearVerification();
    setFile(null);
    setPreview(null);
    setStage("idle");
    setProgress(0);
    setLocalError("");
    setNotice("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = Array.from(event.dataTransfer.files);
    chooseFile(files[0] ?? null, files.length);
  }

  const describedBy = [
    "model-file-help",
    displayedError ? "model-file-error" : "",
    error ? "model-source-error" : "",
    displayedNotice ? "model-file-status" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div id="model-file" aria-busy={displayedStage === "parsing" || displayedStage === "uploading"}>
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={handleDrop}
        className={`rounded-[var(--radius-card)] border-2 border-dashed p-5 transition-colors sm:p-6 ${
          dragging ? "border-navy bg-cloud" : "border-slate/40 bg-white"
        }`}
      >
        <input
          ref={inputRef}
          id="model-file-input"
          type="file"
          accept=".stl,.3mf,model/stl,application/vnd.ms-package.3dmanufacturing-3dmodel+xml"
          className="sr-only"
          tabIndex={-1}
          aria-describedby={describedBy}
          onChange={(event) => {
            const nextFile = event.currentTarget.files?.[0] ?? null;
            chooseFile(nextFile, event.currentTarget.files?.length ?? 0);
            event.currentTarget.value = "";
          }}
        />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-lg font-bold text-ink">STL or 3MF model</p>
            <p id="model-file-help" className="mt-1 text-sm text-slate">
              Optional if you provide a model link. Maximum 50 MiB. The file is checked in this browser before it uploads.
            </p>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="min-h-11 shrink-0 cursor-pointer rounded-full border border-navy/35 bg-white px-5 font-display text-sm font-bold text-navy transition-colors hover:bg-cloud disabled:cursor-not-allowed disabled:opacity-55"
          >
            {file ? "Choose another file" : "Choose a file"}
          </button>
        </div>

        {!file && (
          <p className="mt-5 rounded-xl bg-cloud px-4 py-3 text-center font-mono text-xs font-semibold uppercase tracking-[0.06em] text-slate">
            Or drag one file here
          </p>
        )}
      </div>

      {file && (
        <div className="mt-4 grid gap-4">
          <ModelPreview file={file} onReady={handlePreviewReady} onError={handlePreviewError} />

          {exceedsConfiguredBuildPlate && preview && buildPlate && (
            <p className="rounded-xl border border-signal bg-[#fff9e8] px-4 py-3 text-sm font-medium text-ink" role="status">
              This model’s {preview.bboxMm.x} × {preview.bboxMm.y} × {preview.bboxMm.z} mm bounds exceed the configured {buildPlate.x} × {buildPlate.y} × {buildPlate.z} mm build area. The club may need to scale or split it.
            </p>
          )}

          <div className="rounded-xl border border-mist bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-bold text-ink">{file.name}</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.06em] text-slate">
                  {formatFileSize(file.size)} · {file.name.split(".").pop()?.toUpperCase()}
                </p>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={clearFile}
                className="min-h-11 cursor-pointer rounded-full px-4 font-display text-sm font-bold text-navy underline decoration-mist underline-offset-4 hover:decoration-navy disabled:cursor-not-allowed disabled:opacity-55"
              >
                Remove file
              </button>
            </div>

            {displayedStage === "uploading" && (
              <div className="mt-4">
                <div className="flex items-center justify-between gap-4 text-sm font-semibold text-ink">
                  <span>Uploading model</span>
                  <span className="tnum">{progress}%</span>
                </div>
                <progress
                  className="mt-2 h-3 w-full accent-[var(--color-navy)]"
                  max={100}
                  value={progress}
                  aria-label={`Model upload ${progress}% complete`}
                />
              </div>
            )}

            {(displayedStage === "ready" || (displayedStage === "error" && preview)) && (
              <button
                type="button"
                disabled={disabled}
                onClick={startUpload}
                className="btn btn--secondary mt-4"
              >
                {displayedStage === "error" ? "Try upload again" : "Upload this model"}
              </button>
            )}

            {displayedStage === "uploaded" && verified && (
              <p className="mt-4 flex items-center gap-2 font-display text-sm font-bold text-navy">
                <span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-navy text-xs text-white">
                  ✓
                </span>
                Uploaded and verified
              </p>
            )}
          </div>
        </div>
      )}

      {displayedError && (
        <p id="model-file-error" role="alert" className="mt-3 text-sm font-semibold text-[#9b3028]">
          {displayedError}
        </p>
      )}
      {error && (
        <p id="model-source-error" className="mt-3 text-sm font-semibold text-[#9b3028]">
          {error}
        </p>
      )}
      <p id="model-file-status" className="mt-3 text-sm text-slate" role="status" aria-live="polite">
        {displayedNotice}
      </p>
    </div>
  );
}
