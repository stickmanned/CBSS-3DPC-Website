import type { RequestStatus } from "./domain";

export class QueueNotFoundError extends Error {
  readonly code = "queue_request_not_found";

  constructor(message = "The print request was not found.") {
    super(message);
    this.name = "QueueNotFoundError";
  }
}

export class QueueConflictError extends Error {
  readonly code = "queue_version_conflict";

  constructor(
    message = "The print request changed before this update was saved.",
    readonly expectedVersion?: number,
  ) {
    super(message);
    this.name = "QueueConflictError";
  }
}

export class IllegalQueueTransitionError extends Error {
  readonly code = "illegal_queue_transition";

  constructor(
    readonly from: RequestStatus,
    readonly to: RequestStatus,
  ) {
    super(`Illegal print-request transition: ${from} -> ${to}.`);
    this.name = "IllegalQueueTransitionError";
  }
}

export class InvalidQueueTokenError extends Error {
  readonly code = "invalid_queue_token";

  constructor(message = "The queue token is invalid or expired.") {
    super(message);
    this.name = "InvalidQueueTokenError";
  }
}
