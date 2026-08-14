"use client";

import { useCallback, useRef, useState } from "react";
import { submitPrintRequest } from "../request/actions";
import Button from "./Button";
import ColorPicker, { colorsUnavailableForMaterial } from "./request/ColorPicker";
import MaterialSelector from "./request/MaterialSelector";
import ModelFileUpload from "./request/ModelFileUpload";
import TurnstileField from "./request/TurnstileField";
import {
  firstErrorId,
  getQuantityNote,
  getSchoolEmailWarning,
  parseHttpsUrl,
  recognizeModelSource,
  todayLocalIso,
  validateRequest,
} from "./request/request-form-utils";
import type {
  MaterialSlug,
  RequestFieldErrors,
  VerifiedUpload,
} from "./request/types";

type SubmitResult = {
  ok: boolean;
  fieldErrors?: Record<string, string | string[]>;
  formError?: string;
  statusUrl?: string;
  ref?: string;
  emailSent?: boolean;
  emailState?: "sent" | "failed" | "uncertain";
};

type SuccessState = {
  statusUrl: string;
  ref: string;
  emailSent?: boolean;
  emailState?: "sent" | "failed" | "uncertain";
};

const fieldClass = "field border-navy/30";
const labelClass = "mb-2 block font-display text-[15px] font-bold text-ink";

const FIELD_LABELS: Record<string, string> = {
  requesterName: "Your name",
  requesterEmail: "Email",
  quantity: "Number of copies",
  deadline: "Deadline",
  purpose: "What it’s for",
  material: "Material",
  colors: "Colors",
  colorSlugs: "Colors",
  modelUrl: "Model link",
  modelSource: "Model link or file",
  verifiedFileToken: "Model file",
  turnstile: "Security check",
  form: "Request",
};

function normalizeActionErrors(errors?: Record<string, string | string[]>) {
  const normalized: RequestFieldErrors = {};
  Object.entries(errors ?? {}).forEach(([field, messages]) => {
    const key =
      field === "colorSlugs"
        ? "colors"
        : field === "verifiedFileToken"
          ? "modelSource"
          : field === "cf-turnstile-response" || field === "turnstileToken"
            ? "turnstile"
          : field;
    normalized[key] = Array.isArray(messages) ? messages : [messages];
  });
  return normalized;
}

function makeIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `request-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-2 text-sm font-semibold text-[#9b3028]">
      {message}
    </p>
  );
}

export default function RequestForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const idempotencyRef = useRef("");
  const pendingRef = useRef(false);
  const formStartedAtRef = useRef(0);
  const emailValueRef = useRef("");

  const [email, setEmail] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [deadline, setDeadline] = useState("");
  const [modelUrl, setModelUrl] = useState("");
  const [material, setMaterial] = useState<MaterialSlug>("pla");
  const [colorSlugs, setColorSlugs] = useState<string[]>([]);
  const [verifiedUpload, setVerifiedUpload] = useState<VerifiedUpload | null>(null);
  const [website, setWebsite] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<RequestFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [materialSwitchMessage, setMaterialSwitchMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);

  const emailWarning = getSchoolEmailWarning(email);
  const quantityNote = getQuantityNote(quantity);
  const modelSource = recognizeModelSource(modelUrl);
  const validModelUrl = Boolean(parseHttpsUrl(modelUrl));
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  const getFormStartedAt = useCallback(() => {
    if (!formStartedAtRef.current) formStartedAtRef.current = Date.now();
    return formStartedAtRef.current;
  }, []);

  const handleVerifiedUpload = useCallback((upload: VerifiedUpload | null) => {
    if (
      upload &&
      upload.uploadedForEmail !== emailValueRef.current.trim().toLowerCase()
    ) {
      setVerifiedUpload(null);
      return;
    }
    setVerifiedUpload(upload);
    if (upload) {
      setFieldErrors((current) => {
        if (!current.modelSource) return current;
        const next = { ...current };
        delete next.modelSource;
        return next;
      });
    }
  }, []);

  const handleTurnstileToken = useCallback((token: string) => {
    setTurnstileToken(token);
    if (token) {
      setFieldErrors((current) => {
        if (!current.turnstile) return current;
        const next = { ...current };
        delete next.turnstile;
        return next;
      });
    }
  }, []);

  const resetConsumedTurnstile = useCallback(() => {
    setTurnstileToken("");
    setTurnstileResetKey((current) => current + 1);
  }, []);

  function clearFieldError(field: string) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function showErrors(errors: RequestFieldErrors, message = "") {
    setFieldErrors(errors);
    setFormError(message);
    window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
  }

  function chooseMaterial(nextMaterial: MaterialSlug) {
    if (nextMaterial === material || pending) return;
    const unavailable = colorsUnavailableForMaterial(colorSlugs, nextMaterial);
    if (unavailable.length > 0) {
      const names = unavailable.map((color) => color.name).join(", ");
      setMaterialSwitchMessage(
        `${names} ${unavailable.length === 1 ? "is" : "are"} not available in ${nextMaterial.toUpperCase()}. Remove ${
          unavailable.length === 1 ? "it" : "them"
        } before switching material.`,
      );
      return;
    }

    setMaterial(nextMaterial);
    setMaterialSwitchMessage(`Material changed to ${nextMaterial.toUpperCase()}.`);
    clearFieldError("material");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current || success) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const clientErrors = validateRequest({
      requesterName: String(formData.get("requesterName") ?? ""),
      requesterEmail: email,
      quantity,
      deadline,
      purpose: String(formData.get("purpose") ?? ""),
      modelUrl,
      material,
      colorSlugs,
      verifiedFileToken: verifiedUpload?.verifiedFileToken ?? "",
    });
    if (turnstileSiteKey && !verifiedUpload && !turnstileToken) {
      clientErrors.turnstile = ["Complete the security check."];
    }

    if (Object.keys(clientErrors).length > 0) {
      showErrors(clientErrors, "Check the highlighted fields before sending your request.");
      return;
    }

    pendingRef.current = true;
    setPending(true);
    setFieldErrors({});
    setFormError("");
    if (!idempotencyRef.current) idempotencyRef.current = makeIdempotencyKey();

    const payload = formData;
    payload.delete("model-file");
    payload.set("requesterEmail", email.trim());
    payload.set("quantity", quantity);
    payload.set("deadline", deadline);
    payload.set("modelUrl", modelUrl.trim());
    payload.set("material", material);
    payload.set("colorSlugs", JSON.stringify(colorSlugs));
    payload.set("idempotencyKey", idempotencyRef.current);
    payload.set("formStartedAt", String(getFormStartedAt()));
    payload.set("website", website);

    if (verifiedUpload) {
      payload.set("verifiedFileToken", verifiedUpload.verifiedFileToken);
      payload.set("bboxMm", JSON.stringify(verifiedUpload.bboxMm));
      if (verifiedUpload.thumbnail) payload.set("thumbnail", verifiedUpload.thumbnail);
    } else {
      payload.delete("verifiedFileToken");
      payload.delete("bboxMm");
      payload.delete("thumbnail");
    }

    try {
      const result = (await submitPrintRequest(payload)) as SubmitResult;
      if (!result.ok) {
        showErrors(
          normalizeActionErrors(result.fieldErrors),
          result.formError || "The request could not be saved. Your details are still here; try again.",
        );
        return;
      }

      if (!result.statusUrl || !result.ref) {
        showErrors(
          {},
          "The request was received, but its private tracking details were missing. Try again with the same form so the club can safely recover them.",
        );
        return;
      }

      setSuccess({
        statusUrl: result.statusUrl,
        ref: result.ref,
        emailSent: result.emailSent,
        emailState: result.emailState,
      });
      window.requestAnimationFrame(() => successHeadingRef.current?.focus());
    } catch {
      showErrors(
        {},
        "The request could not reach the club. Your details and uploaded model are still here; check your connection and try again.",
      );
    } finally {
      if (turnstileSiteKey && turnstileToken) resetConsumedTurnstile();
      pendingRef.current = false;
      setPending(false);
    }
  }

  if (success) {
    return (
      <section
        className="build-grid overflow-hidden rounded-[var(--radius-card)] border border-mist bg-white p-6 shadow-md sm:p-8 lg:p-10"
        aria-labelledby="request-success-title"
      >
        <p className="eyebrow text-slate">Request received</p>
        <h2
          ref={successHeadingRef}
          id="request-success-title"
          tabIndex={-1}
          className="mt-4 max-w-[15ch] text-4xl text-ink sm:text-5xl"
        >
          Your place in the queue is ready.
        </h2>
        <p className="mt-5 max-w-[58ch] text-lg leading-relaxed text-slate">
          Save the private status link below. It is the reliable place to see updates about this request.
        </p>

        <dl className="mt-7 grid gap-4 rounded-[var(--radius-card)] bg-cloud p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:p-6">
          <dt className="eyebrow text-slate">Reference</dt>
          <dd className="break-all font-mono text-lg font-bold text-ink">{success.ref}</dd>
        </dl>

        <a href={success.statusUrl} className="btn btn--primary mt-7">
          Open your private status page <span aria-hidden="true">→</span>
        </a>
        <p className="mt-3 break-all text-sm text-slate">
          <span className="sr-only">Private status URL: </span>
          {success.statusUrl}
        </p>

        {success.emailState === "uncertain" ? (
          <p className="mt-6 rounded-xl border border-signal bg-[#fff9e8] px-5 py-4 text-sm font-medium text-ink" role="status">
            The request is saved, but email delivery could not be confirmed. Keep the status link above while the club reviews it.
          </p>
        ) : success.emailSent === false ? (
          <p className="mt-6 rounded-xl border border-signal bg-[#fff9e8] px-5 py-4 text-sm font-medium text-ink" role="status">
            The request is saved, but the email copy could not be sent. Keep the status link above; it works without the email.
          </p>
        ) : (
          <p className="mt-6 text-sm text-slate" role="status">
            {success.emailSent
              ? "We also sent the private status link by email."
              : "Keep this link somewhere safe, even if an email copy arrives later."}
          </p>
        )}
      </section>
    );
  }

  const errorEntries = Object.entries(fieldErrors);
  const hasErrors = Boolean(formError || errorEntries.length);

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit}
      onFocusCapture={getFormStartedAt}
      onPointerDownCapture={getFormStartedAt}
      aria-busy={pending}
      className="request-form rounded-[var(--radius-card)] border border-mist bg-white p-6 shadow-sm sm:p-8 lg:p-10"
    >
      <style>{`
        .request-form .field:focus-visible {
          outline: 3px solid var(--color-signal) !important;
          outline-offset: 2px !important;
          box-shadow: 0 0 0 5px var(--color-ink) !important;
        }
      `}</style>

      <div className="border-b border-mist pb-6">
        <p className="eyebrow text-slate">3D printing request</p>
        <h2 className="mt-3 max-w-[18ch] text-3xl text-ink sm:text-4xl">
          Give the club enough detail to assess the print.
        </h2>
        <p className="mt-4 max-w-[64ch] text-sm leading-relaxed text-slate">
          Required fields are marked. The club confirms feasibility and next steps after reviewing the model; this form does not promise a completion date.
        </p>
      </div>

      {hasErrors && (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          aria-labelledby="request-errors-title"
          className="mt-6 rounded-[var(--radius-card)] border-2 border-[#c2453b] bg-[#fff6f5] p-5 text-ink"
        >
          <h3 id="request-errors-title" className="text-2xl">
            Check this request
          </h3>
          {formError && <p className="mt-3 text-sm font-medium">{formError}</p>}
          {errorEntries.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
              {errorEntries.map(([field, messages]) => (
                <li key={field}>
                  <a className="font-semibold underline underline-offset-4" href={`#${firstErrorId({ [field]: messages })}`}>
                    {FIELD_LABELS[field] ?? "Field"}: {messages[0]}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <section className="border-b border-mist py-8" aria-labelledby="request-details-heading">
        <p className="eyebrow text-slate">01 · Request details</p>
        <h3 id="request-details-heading" className="mt-3 text-2xl text-ink">
          Tell us what you need
        </h3>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="requesterName">
              Your name <span aria-hidden="true">*</span>
            </label>
            <input
              id="requesterName"
              name="requesterName"
              required
              disabled={pending}
              autoComplete="name"
              className={fieldClass}
              aria-invalid={Boolean(fieldErrors.requesterName)}
              aria-describedby={fieldErrors.requesterName ? "requesterName-error" : undefined}
              style={fieldErrors.requesterName ? { borderColor: "#c2453b" } : undefined}
              onInput={() => clearFieldError("requesterName")}
            />
            <FieldError id="requesterName-error" message={fieldErrors.requesterName?.[0]} />
          </div>

          <div>
            <label className={labelClass} htmlFor="requesterEmail">
              Email <span aria-hidden="true">*</span>
            </label>
            <input
              id="requesterEmail"
              name="requesterEmail"
              type="email"
              required
              disabled={pending}
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              value={email}
              onChange={(event) => {
                const nextEmail = event.currentTarget.value;
                emailValueRef.current = nextEmail;
                setEmail(nextEmail);
                if (
                  verifiedUpload &&
                  verifiedUpload.uploadedForEmail !== nextEmail.trim().toLowerCase()
                ) {
                  setVerifiedUpload(null);
                }
                clearFieldError("requesterEmail");
              }}
              className={fieldClass}
              aria-invalid={Boolean(fieldErrors.requesterEmail)}
              aria-describedby={[
                emailWarning ? "requesterEmail-warning" : "",
                fieldErrors.requesterEmail ? "requesterEmail-error" : "",
              ].filter(Boolean).join(" ") || undefined}
              style={fieldErrors.requesterEmail ? { borderColor: "#c2453b" } : undefined}
            />
            {emailWarning && (
              <p id="requesterEmail-warning" className="mt-2 text-sm text-slate" role="status">
                {emailWarning}
              </p>
            )}
            <FieldError id="requesterEmail-error" message={fieldErrors.requesterEmail?.[0]} />
          </div>

          <div>
            <label className={labelClass} htmlFor="quantity">
              Number of copies <span aria-hidden="true">*</span>
            </label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min={1}
              max={50}
              step={1}
              required
              disabled={pending}
              inputMode="numeric"
              value={quantity}
              onChange={(event) => {
                setQuantity(event.currentTarget.value);
                clearFieldError("quantity");
              }}
              className={`${fieldClass} tnum`}
              aria-invalid={Boolean(fieldErrors.quantity)}
              aria-describedby={[
                quantityNote ? "quantity-note" : "",
                fieldErrors.quantity ? "quantity-error" : "",
              ].filter(Boolean).join(" ") || undefined}
              style={fieldErrors.quantity ? { borderColor: "#c2453b" } : undefined}
            />
            {quantityNote && (
              <p id="quantity-note" className="mt-2 text-sm text-slate" role="status">
                {quantityNote}
              </p>
            )}
            <FieldError id="quantity-error" message={fieldErrors.quantity?.[0]} />
          </div>

          <div>
            <label className={labelClass} htmlFor="deadline">
              Deadline <span className="font-normal text-slate">(optional)</span>
            </label>
            <input
              id="deadline"
              name="deadline"
              type="date"
              disabled={pending}
              min={todayLocalIso()}
              value={deadline}
              onChange={(event) => {
                setDeadline(event.currentTarget.value);
                clearFieldError("deadline");
              }}
              className={`${fieldClass} tnum`}
              aria-invalid={Boolean(fieldErrors.deadline)}
              aria-describedby={fieldErrors.deadline ? "deadline-error" : "deadline-help"}
              style={fieldErrors.deadline ? { borderColor: "#c2453b" } : undefined}
            />
            <p id="deadline-help" className="mt-2 text-sm text-slate">
              A date helps with review, but it does not guarantee completion by that day.
            </p>
            <FieldError id="deadline-error" message={fieldErrors.deadline?.[0]} />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="purpose">
              What it’s for <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="purpose"
              name="purpose"
              rows={5}
              required
              disabled={pending}
              autoComplete="off"
              aria-invalid={Boolean(fieldErrors.purpose)}
              aria-describedby={fieldErrors.purpose ? "purpose-error" : "purpose-help"}
              placeholder="Tell us what the object is for and anything else you want us to know before printing."
              className={`${fieldClass} min-h-36 resize-y`}
              style={fieldErrors.purpose ? { borderColor: "#c2453b" } : undefined}
              onInput={() => clearFieldError("purpose")}
            />
            <p id="purpose-help" className="mt-2 text-sm text-slate">
              Include approximate dimensions, fit requirements, or other details that help us assess the model.
            </p>
            <FieldError id="purpose-error" message={fieldErrors.purpose?.[0]} />
          </div>
        </div>
      </section>

      <section className="border-b border-mist py-8" aria-labelledby="request-material-heading">
        <p className="eyebrow text-slate">02 · Material</p>
        <h3 id="request-material-heading" className="sr-only">
          Choose a material
        </h3>
        <div className="mt-4">
          <MaterialSelector
            value={material}
            onChange={chooseMaterial}
            disabled={pending}
            error={fieldErrors.material?.[0]}
            switchMessage={materialSwitchMessage}
          />
        </div>
      </section>

      <section className="border-b border-mist py-8" aria-labelledby="request-colors-heading">
        <p className="eyebrow text-slate">03 · Color order</p>
        <h3 id="request-colors-heading" className="sr-only">
          Choose colors in order
        </h3>
        <div className="mt-4">
          <ColorPicker
            material={material}
            selected={colorSlugs}
            disabled={pending}
            error={fieldErrors.colors?.[0]}
            onChange={(next) => {
              setColorSlugs(next);
              setMaterialSwitchMessage("");
              clearFieldError("colors");
            }}
          />
        </div>
      </section>

      <section id="model-source" className="border-b border-mist py-8" aria-labelledby="request-model-heading">
        <p className="eyebrow text-slate">04 · Model</p>
        <h3 id="request-model-heading" className="mt-3 text-2xl text-ink">
          Add a model link, a file, or both
        </h3>
        <p className="mt-3 max-w-[64ch] text-sm text-slate">
          At least one source is required. A valid HTTPS link from any site is accepted.
        </p>

        <div className="mt-6">
          <label className={labelClass} htmlFor="modelUrl">
            Model link <span className="font-normal text-slate">(optional)</span>
          </label>
          <input
            id="modelUrl"
            name="modelUrl"
            type="url"
            disabled={pending}
            inputMode="url"
            placeholder="https://…"
            value={modelUrl}
            onChange={(event) => {
              setModelUrl(event.currentTarget.value);
              clearFieldError("modelUrl");
              clearFieldError("modelSource");
            }}
            className={fieldClass}
            aria-invalid={Boolean(fieldErrors.modelUrl)}
            aria-describedby={[
              "modelUrl-help",
              validModelUrl ? "modelUrl-source" : "",
              fieldErrors.modelUrl ? "modelUrl-error" : "",
            ].filter(Boolean).join(" ")}
            style={fieldErrors.modelUrl ? { borderColor: "#c2453b" } : undefined}
          />
          <p id="modelUrl-help" className="mt-2 text-sm text-slate">
            MakerWorld, Printables, Thingiverse, Thangs, or another secure HTTPS page.
          </p>
          {validModelUrl && (
            <p id="modelUrl-source" className="mt-2 text-sm font-semibold text-navy" role="status">
              {modelSource ? `Recognized ${modelSource} link.` : "Secure HTTPS model link accepted."}
            </p>
          )}
          <FieldError id="modelUrl-error" message={fieldErrors.modelUrl?.[0]} />
        </div>

        <div className="my-6 flex items-center gap-4" aria-hidden="true">
          <span className="h-px flex-1 bg-mist" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-slate">or</span>
          <span className="h-px flex-1 bg-mist" />
        </div>

        <ModelFileUpload
          email={email}
          getFormStartedAt={getFormStartedAt}
          website={website}
          turnstileRequired={Boolean(turnstileSiteKey)}
          turnstileToken={turnstileToken}
          onTurnstileConsumed={resetConsumedTurnstile}
          disabled={pending}
          error={fieldErrors.modelSource?.[0]}
          onVerified={handleVerifiedUpload}
        />
      </section>

      <div className="relative mt-8">
        <label className="absolute left-[-10000px] top-auto size-px overflow-hidden" aria-hidden="true">
          Website
          <input
            name="website"
            tabIndex={-1}
            disabled={pending}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.currentTarget.value)}
          />
        </label>

        {turnstileSiteKey && (
          <TurnstileField
            key={turnstileResetKey}
            siteKey={turnstileSiteKey}
            token={turnstileToken}
            error={fieldErrors.turnstile?.[0]}
            onTokenChange={handleTurnstileToken}
          />
        )}

        <div className="mt-6 rounded-[var(--radius-card)] bg-cloud p-5 text-sm leading-relaxed text-slate">
          <p className="font-display font-bold text-ink">Private by default</p>
          <p className="mt-2">
            Your name, email, and request metadata are retained for queue history. Model files stay in a private bucket and are deleted 90 days after pickup.
          </p>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-mist pt-7">
          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <span className="spinner" aria-hidden="true" /> Sending request…
              </>
            ) : (
              <>
                Send print request <span aria-hidden="true">→</span>
              </>
            )}
          </Button>
          <p className="max-w-[40ch] text-sm text-slate">
            You’ll get a private status link as soon as the request is saved, even if the email copy fails.
          </p>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {pending ? "Sending print request." : ""}
      </p>
    </form>
  );
}
