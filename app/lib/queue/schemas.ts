import { z } from "zod";
import {
  DECLINED_REASON_KEYS,
  FILE_KINDS,
  MATERIAL_KINDS,
  NEEDS_CHANGES_REASON_KEYS,
  PRINT_FAILED_REASON_KEYS,
  REQUEST_STATUSES,
} from "./domain";
import { recognizeModelLink } from "./model-links";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]+$/;
const THUMBNAIL_DATA_URI_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

function collapseWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function isRealDateOnly(value: string) {
  if (!DATE_ONLY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function vancouverDateOnly(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const optionalDateOnlySchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().refine(isRealDateOnly, "Use a real date in YYYY-MM-DD format.").optional(),
);

const optionalHttpsUrlSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z
    .string()
    .trim()
    .max(2048)
    .transform((value, context) => {
      try {
        return recognizeModelLink(value).url;
      } catch {
        context.addIssue({ code: "custom", message: "Use a valid HTTPS model link." });
        return z.NEVER;
      }
    })
    .optional(),
);

const optionalFileTokenSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(32).max(16_384).optional(),
);

export const submissionSchema = z
  .object({
    requesterName: z.string().transform(collapseWhitespace).pipe(z.string().min(1).max(120)),
    requesterEmail: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.string().email().max(320)),
    quantity: z.coerce.number().int().min(1).max(50),
    deadline: optionalDateOnlySchema,
    purpose: z.string().trim().min(1).max(4000),
    material: z.enum(MATERIAL_KINDS),
    colors: z
      .array(z.string().transform(collapseWhitespace).pipe(z.string().min(1).max(80)))
      .max(4),
    modelUrl: optionalHttpsUrlSchema,
    fileToken: optionalFileTokenSchema,
    idempotencyKey: z
      .string()
      .trim()
      .min(8)
      .max(200)
      .regex(IDEMPOTENCY_KEY_PATTERN, "The idempotency key contains unsupported characters."),
  })
  .superRefine((value, context) => {
    if (!value.modelUrl && !value.fileToken) {
      context.addIssue({
        code: "custom",
        path: ["modelUrl"],
        message: "Add a model link or upload a verified model file.",
      });
    }

    if (value.deadline && value.deadline < vancouverDateOnly()) {
      context.addIssue({
        code: "custom",
        path: ["deadline"],
        message: "The deadline cannot be in the past.",
      });
    }

    const normalizedColors = new Set(value.colors.map((color) => color.toLocaleLowerCase("en-CA")));
    if (normalizedColors.size !== value.colors.length) {
      context.addIssue({
        code: "custom",
        path: ["colors"],
        message: "Choose each color only once.",
      });
    }
  });

export type SubmissionInput = z.infer<typeof submissionSchema>;

export const uploadMetadataSchema = z
  .object({
    storageKey: z
      .string()
      .trim()
      .min(1)
      .max(1024)
      .refine(
        (value) => !value.startsWith("/") && !value.split("/").includes(".."),
        "The server storage key is invalid.",
      ),
    originalName: z.string().transform(collapseWhitespace).pipe(z.string().min(1).max(255)),
    verifiedByteSize: z.number().int().positive().safe(),
    fileKind: z.enum(FILE_KINDS),
    thumbnailDataUri: z
      .string()
      .max(512 * 1024)
      .regex(THUMBNAIL_DATA_URI_PATTERN)
      .nullable()
      .optional(),
    bboxMm: z
      .tuple([
        z.number().positive().finite().max(1_000_000),
        z.number().positive().finite().max(1_000_000),
        z.number().positive().finite().max(1_000_000),
      ])
      .nullable()
      .optional(),
    etag: z.string().trim().min(1).max(512),
  })
  .superRefine((value, context) => {
    const extension = value.originalName.split(".").pop()?.toLowerCase();
    if (extension !== value.fileKind) {
      context.addIssue({
        code: "custom",
        path: ["originalName"],
        message: "The verified file type does not match its filename.",
      });
    }
  });

export type UploadMetadata = z.infer<typeof uploadMetadataSchema>;

const printFailedReasonSchema = z.enum(PRINT_FAILED_REASON_KEYS);
const needsChangesReasonSchema = z.enum(NEEDS_CHANGES_REASON_KEYS);
const declinedReasonSchema = z.enum(DECLINED_REASON_KEYS);

export const adminTransitionSchema = z
  .object({
    requestId: z.string().uuid(),
    expectedVersion: z.coerce.number().int().nonnegative(),
    toStatus: z.enum(REQUEST_STATUSES),
    reasonKey: z.string().trim().regex(/^[a-z0-9_]+$/).optional(),
    requesterVisibleNote: z
      .preprocess(
        (value) => (typeof value === "string" && value.trim() === "" ? null : value),
        z.string().trim().max(4000).nullable().optional(),
      ),
    adminNotes: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? null : value),
      z.string().trim().max(10_000).nullable().optional(),
    ),
    assigneeId: z.string().uuid().nullable().optional(),
  })
  .superRefine((value, context) => {
    const requiredSchema =
      value.toStatus === "print_failed"
        ? printFailedReasonSchema
        : value.toStatus === "needs_changes"
          ? needsChangesReasonSchema
          : value.toStatus === "declined"
            ? declinedReasonSchema
            : null;

    if (requiredSchema && !requiredSchema.safeParse(value.reasonKey).success) {
      context.addIssue({
        code: "custom",
        path: ["reasonKey"],
        message: `Choose a valid ${value.toStatus} reason.`,
      });
    } else if (!requiredSchema && value.reasonKey) {
      context.addIssue({
        code: "custom",
        path: ["reasonKey"],
        message: "This status does not accept a reason.",
      });
    }
  });

export type AdminTransitionInput = z.infer<typeof adminTransitionSchema>;

const statusFilterSchema = z.preprocess(
  (value) => {
    if (typeof value === "string") return value.split(",").map((part) => part.trim()).filter(Boolean);
    return value;
  },
  z.array(z.enum(REQUEST_STATUSES)).max(REQUEST_STATUSES.length).optional(),
);

export const csvFilterSchema = z
  .object({
    statuses: statusFilterSchema,
    createdFrom: optionalDateOnlySchema,
    createdTo: optionalDateOnlySchema,
    assigneeId: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().uuid().optional(),
    ),
    search: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^CBSS-[0-9]{4}$/)
        .optional(),
    ),
  })
  .superRefine((value, context) => {
    if (value.createdFrom && value.createdTo && value.createdFrom > value.createdTo) {
      context.addIssue({
        code: "custom",
        path: ["createdTo"],
        message: "The end date must be on or after the start date.",
      });
    }
  });

export type CsvFilterInput = z.infer<typeof csvFilterSchema>;
