import type { MaterialSlug, RequestFieldErrors } from "./types";

export const MAX_MODEL_BYTES = 50 * 1024 * 1024;
export const ACCEPTED_MODEL_EXTENSIONS = ["stl", "3mf"] as const;

export type RequestValidationInput = {
  requesterName: string;
  requesterEmail: string;
  quantity: string;
  deadline: string;
  purpose: string;
  modelUrl: string;
  material: MaterialSlug | "";
  colorSlugs: string[];
  verifiedFileToken: string;
};

export type ModelSource = "MakerWorld" | "Printables" | "Thingiverse" | "Thangs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function todayLocalIso(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(value.trim());
}

export function getSchoolEmailWarning(value: string) {
  const email = value.trim().toLowerCase();
  if (!isValidEmail(email) || email.endsWith("@sd43.bc.ca")) return "";
  return "If you have an @sd43.bc.ca address, use it so the club can identify you easily. Other valid email addresses are still accepted.";
}

export function getQuantityNote(value: string) {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity <= 5) return "";
  return "More than five copies needs a closer review. The club will confirm what is practical after looking at your request.";
}

export function parseHttpsUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function recognizeModelSource(value: string): ModelSource | null {
  const url = parseHttpsUrl(value);
  if (!url) return null;

  const hostname = url.hostname.toLowerCase();
  const sources: Array<[string, ModelSource]> = [
    ["makerworld.com", "MakerWorld"],
    ["printables.com", "Printables"],
    ["thingiverse.com", "Thingiverse"],
    ["thangs.com", "Thangs"],
  ];

  return (
    sources.find(([domain]) => hostname === domain || hostname.endsWith(`.${domain}`))?.[1] ??
    null
  );
}

export function validateRequest(input: RequestValidationInput, today = todayLocalIso()) {
  const errors: RequestFieldErrors = {};
  const add = (field: string, message: string) => {
    errors[field] = [...(errors[field] ?? []), message];
  };

  if (!input.requesterName.trim()) add("requesterName", "Enter your name.");

  if (!input.requesterEmail.trim()) {
    add("requesterEmail", "Enter your email address.");
  } else if (!isValidEmail(input.requesterEmail)) {
    add("requesterEmail", "Enter a valid email address.");
  }

  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
    add("quantity", "Choose a whole number from 1 to 50.");
  }

  if (input.deadline && input.deadline < today) {
    add("deadline", "Choose today or a future date.");
  }

  if (!input.purpose.trim()) add("purpose", "Tell us what the object is for.");
  if (!input.material) add("material", "Choose a material.");
  if (input.colorSlugs.length > 4) add("colors", "Choose no more than four colors.");

  if (input.modelUrl.trim() && !parseHttpsUrl(input.modelUrl)) {
    add("modelUrl", "Enter a complete HTTPS link, beginning with https://.");
  }

  if (!input.modelUrl.trim() && !input.verifiedFileToken) {
    add("modelSource", "Add an HTTPS model link or finish uploading an STL or 3MF file.");
  }

  return errors;
}

export function validateModelFile(file: Pick<File, "name" | "size">) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (!ACCEPTED_MODEL_EXTENSIONS.includes(extension as (typeof ACCEPTED_MODEL_EXTENSIONS)[number])) {
    return "Choose an STL or 3MF file.";
  }

  if (file.size === 0) return "This file is empty. Choose a model that contains data.";
  if (file.size > MAX_MODEL_BYTES) return "This file is larger than 50 MiB.";
  return "";
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function moveItem<T>(items: readonly T[], from: number, to: number) {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length || from === to) {
    return [...items];
  }

  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function firstErrorId(errors: RequestFieldErrors) {
  const field = Object.keys(errors)[0];
  if (!field) return null;
  if (field === "modelSource") return "model-source";
  if (field === "colors") return "color-picker";
  return field;
}

