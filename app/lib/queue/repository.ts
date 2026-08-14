import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDatabase, type QueueDatabase } from "../db/client";
import {
  adminUser,
  emailDelivery,
  printRequest,
  requestEvent,
  requestFile,
  type PrintRequest,
  type RequestEvent,
  type RequestFile,
} from "../db/schema";
import { recipientsForQueueEvent } from "../email/outbox-policy";
import { canTransition, type MaterialKind, type RequestStatus } from "./domain";
import {
  IllegalQueueTransitionError,
  QueueConflictError,
  QueueNotFoundError,
} from "./errors";
import type { CsvFilterInput, UploadMetadata } from "./schemas";

export type CreateRequestRecord = {
  requesterTokenHash: string;
  requesterName: string;
  requesterEmail: string;
  quantity: number;
  deadline?: string;
  purpose: string;
  material: MaterialKind;
  colors: string[];
  modelUrl?: string;
  idempotencyKey: string;
  submitterIpHmac: string;
  file?: UploadMetadata;
};

export type CreateRequestResult = {
  created: boolean;
  request: PrintRequest;
  event: RequestEvent;
};

export type TransitionRequestRecord = {
  requestId: string;
  expectedVersion: number;
  toStatus: RequestStatus;
  reasonKey?: string;
  requesterVisibleNote?: string | null;
  adminNotes?: string | null;
  assigneeId?: string | null;
  actor: string;
};

export type TransitionRequestResult = {
  request: PrintRequest;
  event: RequestEvent;
};

function sameNumberArray(
  left: readonly number[] | null | undefined,
  right: readonly number[] | null | undefined,
): boolean {
  const a = left ?? null;
  const b = right ?? null;
  return a === b || (
    Boolean(a && b) &&
    a!.length === b!.length &&
    a!.every((value, index) => value === b![index])
  );
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameCreateRequest(
  existing: PrintRequest,
  existingFile: RequestFile | null,
  input: CreateRequestRecord,
): boolean {
  const file = input.file ?? null;
  const sameFile =
    existingFile === file ||
    Boolean(
      existingFile &&
        file &&
        existingFile.storageKey === file.storageKey &&
        existingFile.originalName === file.originalName &&
        existingFile.verifiedByteSize === file.verifiedByteSize &&
        existingFile.fileKind === file.fileKind &&
        existingFile.etag === file.etag &&
        (existingFile.thumbnailDataUri ?? null) === (file.thumbnailDataUri ?? null) &&
        sameNumberArray(existingFile.bboxMm, file.bboxMm),
    );

  return Boolean(
    sameFile &&
      existing.requesterTokenHash === input.requesterTokenHash &&
      existing.requesterName === input.requesterName &&
      existing.requesterEmail === input.requesterEmail &&
      existing.quantity === input.quantity &&
      (existing.deadline ?? undefined) === input.deadline &&
      existing.purpose === input.purpose &&
      existing.material === input.material &&
      sameStringArray(existing.colors, input.colors) &&
      (existing.modelUrl ?? undefined) === input.modelUrl &&
      existing.submitterIpHmac === input.submitterIpHmac
  );
}

export type RequesterQueueView = Pick<
  PrintRequest,
  | "id"
  | "ref"
  | "createdAt"
  | "updatedAt"
  | "requesterName"
  | "quantity"
  | "deadline"
  | "purpose"
  | "material"
  | "colors"
  | "modelUrl"
  | "currentStatus"
  | "version"
> & {
  fileName: string | null;
  bboxMm: number[] | null;
  thumbnailDataUri: string | null;
};

export type DownloadableRequestFile = Pick<
  RequestFile,
  | "id"
  | "requestId"
  | "storageKey"
  | "originalName"
  | "verifiedByteSize"
  | "fileKind"
  | "etag"
  | "uploadedAt"
> & { requestRef: string };

export interface QueueRepository {
  createRequest(input: CreateRequestRecord): Promise<CreateRequestResult>;
  transitionRequest(input: TransitionRequestRecord): Promise<TransitionRequestResult>;
  findForRequester(ref: string, requesterTokenHash: string): Promise<RequesterQueueView | null>;
  listForCsv(filters: CsvFilterInput): Promise<PrintRequest[]>;
  findActiveAdminByGithubId(githubId: string): Promise<typeof adminUser.$inferSelect | null>;
  findDownloadableRequestFile(fileId: string): Promise<DownloadableRequestFile | null>;
}

export class DrizzleQueueRepository implements QueueRepository {
  constructor(private readonly db: QueueDatabase) {}

  async createRequest(input: CreateRequestRecord): Promise<CreateRequestResult> {
    return this.db.transaction(async (transaction) => {
      // Serialize one logical submission before touching the finite reference
      // sequence. PostgreSQL evaluates nextval() even for a losing ON CONFLICT,
      // so a replay-safe pre-read must happen under a transaction advisory lock.
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${input.idempotencyKey}, 0))`,
      );

      const [existingRow] = await transaction
        .select({ request: printRequest, file: requestFile })
        .from(printRequest)
        .leftJoin(requestFile, eq(requestFile.requestId, printRequest.id))
        .where(eq(printRequest.idempotencyKey, input.idempotencyKey))
        .limit(1);

      if (existingRow) {
        if (!sameCreateRequest(existingRow.request, existingRow.file, input)) {
          throw new QueueConflictError(
            "The idempotency key belongs to a different submission.",
          );
        }
        const [initialEvent] = await transaction
          .select()
          .from(requestEvent)
          .where(
            and(
              eq(requestEvent.requestId, existingRow.request.id),
              isNull(requestEvent.fromStatus),
              eq(requestEvent.toStatus, "submitted"),
              eq(requestEvent.reasonKey, "submitted"),
            ),
          )
          .orderBy(requestEvent.createdAt)
          .limit(1);
        if (!initialEvent) {
          throw new QueueConflictError("The idempotent request is missing its initial event.");
        }
        await transaction
          .insert(emailDelivery)
          .values(
            recipientsForQueueEvent(initialEvent.toStatus, initialEvent.reasonKey).map(
              (recipientKind) => ({ eventId: initialEvent.id, recipientKind }),
            ),
          )
          .onConflictDoNothing();
        return { created: false, request: existingRow.request, event: initialEvent };
      }

      if (input.file) {
        // The same verified object cannot back two requests. Lock and reject a
        // claimed final key before nextval() allocates a finite public ref.
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`request-file:${input.file.storageKey}`}, 0))`,
        );
        const [claimedFile] = await transaction
          .select({ id: requestFile.id })
          .from(requestFile)
          .where(eq(requestFile.storageKey, input.file.storageKey))
          .limit(1);
        if (claimedFile) {
          throw new QueueConflictError("The verified model file was already submitted.");
        }
      }

      const [inserted] = await transaction
        .insert(printRequest)
        .values({
          requesterTokenHash: input.requesterTokenHash,
          requesterName: input.requesterName,
          requesterEmail: input.requesterEmail,
          quantity: input.quantity,
          deadline: input.deadline,
          purpose: input.purpose,
          material: input.material,
          colors: input.colors,
          modelUrl: input.modelUrl,
          idempotencyKey: input.idempotencyKey,
          submitterIpHmac: input.submitterIpHmac,
        })
        .returning();

      if (!inserted) throw new QueueConflictError("The request could not be allocated.");

      if (input.file) {
        await transaction.insert(requestFile).values({
          requestId: inserted.id,
          storageKey: input.file.storageKey,
          originalName: input.file.originalName,
          verifiedByteSize: input.file.verifiedByteSize,
          fileKind: input.file.fileKind,
          thumbnailDataUri: input.file.thumbnailDataUri ?? null,
          bboxMm: input.file.bboxMm ?? null,
          etag: input.file.etag,
        });
      }

      const [event] = await transaction
        .insert(requestEvent)
        .values({
          requestId: inserted.id,
          fromStatus: null,
          toStatus: "submitted",
          reasonKey: "submitted",
          actor: "requester",
        })
        .returning();

      if (!event) throw new QueueConflictError("The initial request event could not be saved.");
      await transaction.insert(emailDelivery).values(
        recipientsForQueueEvent(event.toStatus, event.reasonKey).map((recipientKind) => ({
          eventId: event.id,
          recipientKind,
        })),
      );

      return { created: true, request: inserted, event };
    });
  }

  async transitionRequest(input: TransitionRequestRecord): Promise<TransitionRequestResult> {
    return this.db.transaction(async (transaction) => {
      const [current] = await transaction
        .select({
          id: printRequest.id,
          currentStatus: printRequest.currentStatus,
          version: printRequest.version,
        })
        .from(printRequest)
        .where(eq(printRequest.id, input.requestId))
        .limit(1);

      if (!current) throw new QueueNotFoundError();
      if (current.version !== input.expectedVersion) {
        throw new QueueConflictError(undefined, input.expectedVersion);
      }
      if (!canTransition(current.currentStatus, input.toStatus)) {
        throw new IllegalQueueTransitionError(current.currentStatus, input.toStatus);
      }

      const [updated] = await transaction
        .update(printRequest)
        .set({
          currentStatus: input.toStatus,
          version: sql`${printRequest.version} + 1`,
          updatedAt: new Date(),
          ...(input.adminNotes !== undefined ? { adminNotes: input.adminNotes } : {}),
          ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
        })
        .where(
          and(
            eq(printRequest.id, input.requestId),
            eq(printRequest.version, input.expectedVersion),
            eq(printRequest.currentStatus, current.currentStatus),
          ),
        )
        .returning();

      // A competing transaction that used the same version can update the row,
      // but this predicate then returns no row and the transaction writes no event.
      if (!updated) throw new QueueConflictError(undefined, input.expectedVersion);

      const [event] = await transaction
        .insert(requestEvent)
        .values({
          requestId: input.requestId,
          fromStatus: current.currentStatus,
          toStatus: input.toStatus,
          reasonKey: input.reasonKey ?? "status_updated",
          requesterVisibleNote: input.requesterVisibleNote,
          actor: input.actor,
        })
        .returning();

      if (!event) throw new QueueConflictError("The request event could not be saved.");
      const recipients = recipientsForQueueEvent(event.toStatus, event.reasonKey);
      if (recipients.length) {
        await transaction.insert(emailDelivery).values(
          recipients.map((recipientKind) => ({ eventId: event.id, recipientKind })),
        );
      }

      return { request: updated, event };
    });
  }

  async findForRequester(
    ref: string,
    requesterTokenHash: string,
  ): Promise<RequesterQueueView | null> {
    const [row] = await this.db
      .select({
        id: printRequest.id,
        ref: printRequest.ref,
        createdAt: printRequest.createdAt,
        updatedAt: printRequest.updatedAt,
        requesterName: printRequest.requesterName,
        quantity: printRequest.quantity,
        deadline: printRequest.deadline,
        purpose: printRequest.purpose,
        material: printRequest.material,
        colors: printRequest.colors,
        modelUrl: printRequest.modelUrl,
        currentStatus: printRequest.currentStatus,
        version: printRequest.version,
        fileName: requestFile.originalName,
        bboxMm: requestFile.bboxMm,
        thumbnailDataUri: requestFile.thumbnailDataUri,
      })
      .from(printRequest)
      .leftJoin(requestFile, eq(requestFile.requestId, printRequest.id))
      .where(
        and(
          eq(printRequest.ref, ref.toUpperCase()),
          eq(printRequest.requesterTokenHash, requesterTokenHash),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async listForCsv(filters: CsvFilterInput): Promise<PrintRequest[]> {
    const conditions: SQL[] = [];
    if (filters.statuses?.length) {
      conditions.push(inArray(printRequest.currentStatus, filters.statuses));
    }
    if (filters.createdFrom) {
      conditions.push(
        sql`(${printRequest.createdAt} at time zone 'America/Vancouver')::date >= ${filters.createdFrom}::date`,
      );
    }
    if (filters.createdTo) {
      conditions.push(
        sql`(${printRequest.createdAt} at time zone 'America/Vancouver')::date <= ${filters.createdTo}::date`,
      );
    }
    if (filters.assigneeId) conditions.push(eq(printRequest.assigneeId, filters.assigneeId));
    if (filters.search) {
      conditions.push(eq(printRequest.ref, filters.search));
    }

    return this.db
      .select()
      .from(printRequest)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(printRequest.createdAt));
  }

  async findActiveAdminByGithubId(
    githubId: string,
  ): Promise<typeof adminUser.$inferSelect | null> {
    const [admin] = await this.db
      .select()
      .from(adminUser)
      .where(and(eq(adminUser.githubId, githubId), eq(adminUser.active, true)))
      .limit(1);
    return admin ?? null;
  }

  async findDownloadableRequestFile(fileId: string): Promise<DownloadableRequestFile | null> {
    const [file] = await this.db
      .select({
        id: requestFile.id,
        requestId: requestFile.requestId,
        storageKey: requestFile.storageKey,
        originalName: requestFile.originalName,
        verifiedByteSize: requestFile.verifiedByteSize,
        fileKind: requestFile.fileKind,
        etag: requestFile.etag,
        uploadedAt: requestFile.uploadedAt,
        requestRef: printRequest.ref,
      })
      .from(requestFile)
      .innerJoin(printRequest, eq(printRequest.id, requestFile.requestId))
      .where(and(eq(requestFile.id, fileId), isNull(requestFile.purgedAt)))
      .limit(1);
    return file ?? null;
  }
}

export function createQueueRepository(database = getDatabase()): QueueRepository {
  return new DrizzleQueueRepository(database);
}

export async function findActiveAdminByGithubId(
  githubId: string,
  database = getDatabase(),
) {
  return new DrizzleQueueRepository(database).findActiveAdminByGithubId(githubId);
}

export async function findDownloadableRequestFile(
  fileId: string,
  database = getDatabase(),
) {
  return new DrizzleQueueRepository(database).findDownloadableRequestFile(fileId);
}
