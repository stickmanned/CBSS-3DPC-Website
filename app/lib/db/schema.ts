import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const materialKind = pgEnum("material_kind", ["pla", "petg", "asa"]);

export const requestStatus = pgEnum("request_status", [
  "submitted",
  "under_review",
  "approved",
  "needs_changes",
  "declined",
  "queued",
  "printing",
  "ready_for_pickup",
  "print_failed",
  "picked_up",
]);

export const emailRecipientKind = pgEnum("email_recipient_kind", [
  "requester",
  "club",
]);

export const emailDeliveryState = pgEnum("email_delivery_state", [
  "pending",
  "sending",
  "sent",
  "failed",
  "uncertain",
  "obsolete",
]);

export const printRequestRefSequence = pgSequence("print_request_ref_seq", {
  startWith: 1,
  increment: 1,
  minValue: 1,
  maxValue: 9999,
  cycle: false,
});

export const adminUser = pgTable(
  "admin_user",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    githubId: text("github_id").notNull(),
    githubLogin: text("github_login").notNull(),
    displayName: text("display_name"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("admin_user_github_id_uidx").on(table.githubId),
    uniqueIndex("admin_user_github_login_lower_uidx").on(sql`lower(${table.githubLogin})`),
    check("admin_user_github_id_not_blank", sql`length(btrim(${table.githubId})) > 0`),
    check("admin_user_github_login_not_blank", sql`length(btrim(${table.githubLogin})) > 0`),
  ],
);

export const printRequest = pgTable(
  "print_request",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ref: text("ref")
      .notNull()
      .default(sql`'CBSS-' || lpad(nextval('print_request_ref_seq')::text, 4, '0')`),
    requesterTokenHash: text("requester_token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    requesterName: text("requester_name").notNull(),
    requesterEmail: text("requester_email").notNull(),
    quantity: smallint("quantity").notNull(),
    deadline: date("deadline", { mode: "string" }),
    purpose: text("purpose").notNull(),
    material: materialKind("material").notNull(),
    colors: text("colors").array().notNull().default(sql`array[]::text[]`),
    modelUrl: text("model_url"),
    currentStatus: requestStatus("current_status").notNull().default("submitted"),
    adminNotes: text("admin_notes"),
    assigneeId: uuid("assignee_id").references(() => adminUser.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    version: integer("version").notNull().default(0),
    idempotencyKey: text("idempotency_key").notNull(),
    submitterIpHmac: text("submitter_ip_hmac").notNull(),
  },
  (table) => [
    uniqueIndex("print_request_ref_uidx").on(table.ref),
    uniqueIndex("print_request_requester_token_hash_uidx").on(table.requesterTokenHash),
    uniqueIndex("print_request_idempotency_key_uidx").on(table.idempotencyKey),
    index("print_request_status_created_at_idx").on(table.currentStatus, table.createdAt.desc()),
    index("print_request_created_at_idx").on(table.createdAt.desc()),
    index("print_request_requester_email_idx").on(table.requesterEmail),
    index("print_request_assignee_id_idx").on(table.assigneeId),
    index("print_request_assignee_status_created_at_idx").on(
      table.assigneeId,
      table.currentStatus,
      table.createdAt.desc(),
    ),
    check("print_request_ref_format", sql`${table.ref} ~ '^CBSS-[0-9]{4}$'`),
    check(
      "print_request_requester_token_hash_format",
      sql`${table.requesterTokenHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check("print_request_requester_name_length", sql`length(${table.requesterName}) between 1 and 120`),
    check(
      "print_request_requester_email_normalized",
      sql`${table.requesterEmail} = lower(${table.requesterEmail}) and length(${table.requesterEmail}) between 3 and 320`,
    ),
    check("print_request_quantity_range", sql`${table.quantity} between 1 and 50`),
    check(
      "print_request_deadline_not_before_submission",
      sql`${table.deadline} is null or ${table.deadline} >= (${table.createdAt} at time zone 'America/Vancouver')::date`,
    ),
    check("print_request_purpose_length", sql`length(${table.purpose}) between 1 and 4000`),
    check("print_request_colors_count", sql`cardinality(${table.colors}) between 0 and 4`),
    check(
      "print_request_colors_not_blank",
      sql`array_position(${table.colors}, '') is null and array_position(${table.colors}, null) is null`,
    ),
    check(
      "print_request_model_url_https",
      sql`${table.modelUrl} is null or ${table.modelUrl} ~ '^https://'`,
    ),
    check("print_request_version_nonnegative", sql`${table.version} >= 0`),
    check(
      "print_request_idempotency_key_length",
      sql`length(${table.idempotencyKey}) between 8 and 200`,
    ),
    check(
      "print_request_submitter_ip_hmac_format",
      sql`${table.submitterIpHmac} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const requestFile = pgTable(
  "request_file",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => printRequest.id, { onDelete: "cascade", onUpdate: "cascade" }),
    storageKey: text("storage_key").notNull(),
    originalName: text("original_name").notNull(),
    verifiedByteSize: bigint("verified_byte_size", { mode: "number" }).notNull(),
    fileKind: text("file_kind").notNull(),
    thumbnailDataUri: text("thumbnail_data_uri"),
    bboxMm: numeric("bbox_mm", { precision: 10, scale: 3, mode: "number" }).array(),
    etag: text("etag").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
    purgedAt: timestamp("purged_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("request_file_request_id_uidx").on(table.requestId),
    uniqueIndex("request_file_storage_key_uidx").on(table.storageKey),
    index("request_file_purged_at_idx").on(table.purgedAt),
    check("request_file_storage_key_not_blank", sql`length(btrim(${table.storageKey})) > 0`),
    check("request_file_original_name_length", sql`length(${table.originalName}) between 1 and 255`),
    check("request_file_verified_byte_size_positive", sql`${table.verifiedByteSize} > 0`),
    check("request_file_kind_allowed", sql`${table.fileKind} in ('stl', '3mf')`),
    check(
      "request_file_thumbnail_data_uri",
      sql`${table.thumbnailDataUri} is null or (${table.thumbnailDataUri} ~ '^data:image/(png|jpeg|webp)' and position(chr(59) || 'base64,' in ${table.thumbnailDataUri}) > 0 and octet_length(${table.thumbnailDataUri}) <= 524288)`,
    ),
    check(
      "request_file_bbox_mm_valid",
      sql`${table.bboxMm} is null or (cardinality(${table.bboxMm}) = 3 and ${table.bboxMm}[1] > 0 and ${table.bboxMm}[1] <= 1000000 and ${table.bboxMm}[2] > 0 and ${table.bboxMm}[2] <= 1000000 and ${table.bboxMm}[3] > 0 and ${table.bboxMm}[3] <= 1000000)`,
    ),
    check("request_file_etag_not_blank", sql`length(btrim(${table.etag})) > 0`),
    check(
      "request_file_purge_after_upload",
      sql`${table.purgedAt} is null or ${table.purgedAt} >= ${table.uploadedAt}`,
    ),
  ],
);

export const requestEvent = pgTable(
  "request_event",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => printRequest.id, { onDelete: "cascade", onUpdate: "cascade" }),
    fromStatus: requestStatus("from_status"),
    toStatus: requestStatus("to_status").notNull(),
    reasonKey: text("reason_key"),
    requesterVisibleNote: text("requester_visible_note"),
    emailed: boolean("emailed").notNull().default(false),
    actor: text("actor").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("request_event_request_id_created_at_idx").on(table.requestId, table.createdAt.desc()),
    index("request_event_to_status_created_at_idx").on(table.toStatus, table.createdAt.desc()),
    index("request_event_unemailed_created_at_idx")
      .on(table.createdAt)
      .where(sql`${table.emailed} = false`),
    uniqueIndex("request_event_singleton_system_reason_uidx")
      .on(table.requestId, table.reasonKey)
      .where(
        sql`${table.reasonKey} in ('uncollected_14d', 'file_purged_90d')`,
      ),
    check(
      "request_event_status_changed",
      sql`${table.fromStatus} is null or ${table.fromStatus} <> ${table.toStatus}`,
    ),
    check("request_event_actor_not_blank", sql`length(btrim(${table.actor})) > 0`),
    check(
      "request_event_reason_key_format",
      sql`${table.reasonKey} is null or ${table.reasonKey} ~ '^[a-z0-9_]+$'`,
    ),
    check(
      "request_event_system_reason_guard",
      sql`(${table.reasonKey} not in ('uncollected_14d', 'file_purged_90d')) or (${table.actor} = 'system' and ((${table.reasonKey} = 'uncollected_14d' and ${table.toStatus} = 'ready_for_pickup') or (${table.reasonKey} = 'file_purged_90d' and ${table.toStatus} = 'picked_up')))`,
    ),
  ],
);

export const emailDelivery = pgTable(
  "email_delivery",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    eventId: bigint("event_id", { mode: "number" })
      .notNull()
      .references(() => requestEvent.id, { onDelete: "cascade", onUpdate: "cascade" }),
    recipientKind: emailRecipientKind("recipient_kind").notNull(),
    state: emailDeliveryState("state").notNull().default("pending"),
    providerId: text("provider_id"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastErrorCode: text("last_error_code"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("email_delivery_event_recipient_uidx").on(
      table.eventId,
      table.recipientKind,
    ),
    index("email_delivery_claimable_created_at_idx")
      .on(table.recipientKind, table.createdAt, table.id)
      .where(sql`${table.state} in ('pending', 'failed')`),
    index("email_delivery_review_updated_at_idx")
      .on(table.updatedAt, table.id)
      .where(sql`${table.state} in ('sending', 'uncertain')`),
    check("email_delivery_attempt_count_nonnegative", sql`${table.attemptCount} >= 0`),
    check(
      "email_delivery_error_code_format",
      sql`${table.lastErrorCode} is null or ${table.lastErrorCode} ~ '^[a-z0-9_]+$'`,
    ),
    check(
      "email_delivery_sent_fields",
      sql`${table.state} <> 'sent' or (${table.providerId} is not null and ${table.sentAt} is not null)`,
    ),
    check(
      "email_delivery_sent_at_state",
      sql`${table.sentAt} is null or ${table.state} = 'sent'`,
    ),
    check(
      "email_delivery_attempt_fields",
      sql`${table.state} not in ('sending', 'failed', 'uncertain', 'sent') or (${table.attemptCount} > 0 and ${table.lastAttemptAt} is not null)`,
    ),
    check(
      "email_delivery_claimed_fields",
      sql`${table.state} <> 'sending' or ${table.claimedAt} is not null`,
    ),
  ],
);

export const rateLimitBucket = pgTable(
  "rate_limit_bucket",
  {
    scope: text("scope").notNull(),
    keyHmac: text("key_hmac").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    requestCount: integer("request_count").notNull().default(1),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "rate_limit_bucket_pk",
      columns: [table.scope, table.keyHmac, table.windowStart],
    }),
    index("rate_limit_bucket_expires_at_idx").on(table.expiresAt),
    check("rate_limit_bucket_scope_not_blank", sql`length(btrim(${table.scope})) > 0`),
    check("rate_limit_bucket_key_hmac_format", sql`${table.keyHmac} ~ '^[0-9a-f]{64}$'`),
    check("rate_limit_bucket_request_count_positive", sql`${table.requestCount} > 0`),
    check("rate_limit_bucket_expiry_valid", sql`${table.expiresAt} > ${table.windowStart}`),
  ],
);

export type AdminUser = typeof adminUser.$inferSelect;
export type PrintRequest = typeof printRequest.$inferSelect;
export type RequestFile = typeof requestFile.$inferSelect;
export type RequestEvent = typeof requestEvent.$inferSelect;
export type EmailDelivery = typeof emailDelivery.$inferSelect;
