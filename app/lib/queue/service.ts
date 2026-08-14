import { z } from "zod";
import type { RequestStatus } from "./domain";
import { recognizeModelLink, type ModelLinkProvider } from "./model-links";
import {
  adminTransitionSchema,
  submissionSchema,
  type SubmissionInput,
  type UploadMetadata,
} from "./schemas";
import {
  deriveRequesterToken,
  hashRequesterToken,
  hashSubmitterIp,
} from "./tokens";
import { InvalidQueueTokenError } from "./errors";
import type {
  CreateRequestResult,
  QueueRepository,
  RequesterQueueView,
  TransitionRequestResult,
} from "./repository";

export type QueueSecrets = {
  requesterTokenSecret: string;
  identifierHmacSecret: string;
};

export type SubmitRequestContext = {
  submitterIp: string;
  /** Supplied only after the canonical storage verifier checks fileToken. */
  verifiedFile?: UploadMetadata;
};

export type SubmitRequestResult = CreateRequestResult & {
  /** Returned to the requester; only its HMAC is stored. */
  requesterToken: string;
  modelProvider: ModelLinkProvider | null;
};

const actorSchema = z.string().trim().min(1).max(200);

export class QueueService {
  constructor(
    private readonly repository: QueueRepository,
    private readonly secrets: QueueSecrets,
  ) {}

  async submit(rawInput: unknown, context: SubmitRequestContext): Promise<SubmitRequestResult> {
    const input = submissionSchema.parse(rawInput);
    const requesterToken = deriveRequesterToken(
      input.idempotencyKey,
      this.secrets.requesterTokenSecret,
    );
    const file = this.requireVerifiedFile(input, context.verifiedFile);
    const recognizedModel = input.modelUrl ? recognizeModelLink(input.modelUrl) : null;

    const result = await this.repository.createRequest({
      requesterTokenHash: hashRequesterToken(requesterToken, this.secrets.requesterTokenSecret),
      requesterName: input.requesterName,
      requesterEmail: input.requesterEmail,
      quantity: input.quantity,
      deadline: input.deadline,
      purpose: input.purpose,
      material: input.material,
      colors: input.colors,
      modelUrl: recognizedModel?.url,
      idempotencyKey: input.idempotencyKey,
      submitterIpHmac: hashSubmitterIp(context.submitterIp, this.secrets.identifierHmacSecret),
      file,
    });

    return {
      ...result,
      requesterToken,
      modelProvider: recognizedModel?.provider ?? null,
    };
  }

  async transition(rawInput: unknown, actor: string): Promise<TransitionRequestResult> {
    const input = adminTransitionSchema.parse(rawInput);
    return this.repository.transitionRequest({
      ...input,
      actor: actorSchema.parse(actor),
    });
  }

  async findForRequester(ref: string, rawToken: string): Promise<RequesterQueueView | null> {
    const tokenHash = hashRequesterToken(rawToken, this.secrets.requesterTokenSecret);
    return this.repository.findForRequester(ref, tokenHash);
  }

  private requireVerifiedFile(
    input: SubmissionInput,
    verifiedFile: UploadMetadata | undefined,
  ): UploadMetadata | undefined {
    if (input.fileToken && !verifiedFile) {
      throw new InvalidQueueTokenError("The uploaded file was not verified by storage.");
    }
    if (!input.fileToken && verifiedFile) {
      throw new InvalidQueueTokenError("Verified file metadata requires a file token.");
    }
    return verifiedFile;
  }
}

export type QueueTransitionTarget = RequestStatus;
