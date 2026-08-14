import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const MAX_TOKEN_LENGTH = 16_384;
const MIN_SECRET_BYTES = 32;

export class TokenConfigurationError extends Error {
  constructor() {
    super("Secure token signing is not configured.");
    this.name = "TokenConfigurationError";
  }
}

export class InvalidTokenError extends Error {
  constructor() {
    super("The token is invalid or expired.");
    this.name = "InvalidTokenError";
  }
}

function tokenSecret(): string {
  const secret = process.env.UPLOAD_TOKEN_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES) {
    throw new TokenConfigurationError();
  }
  return secret;
}

function signature(payload: string): Buffer {
  return createHmac("sha256", tokenSecret()).update(payload).digest();
}

export function randomTokenNonce(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function signHmacToken(payload: object): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${signature(encoded).toString("base64url")}`;
}

export function verifyHmacTokenPayload(token: string): unknown {
  if (!token || token.length > MAX_TOKEN_LENGTH) {
    throw new InvalidTokenError();
  }

  const pieces = token.split(".");
  if (
    pieces.length !== 2 ||
    !pieces[0] ||
    !pieces[1] ||
    !/^[A-Za-z0-9_-]+$/.test(pieces[0]) ||
    !/^[A-Za-z0-9_-]+$/.test(pieces[1])
  ) {
    throw new InvalidTokenError();
  }

  let supplied: Buffer;
  try {
    supplied = Buffer.from(pieces[1], "base64url");
  } catch {
    throw new InvalidTokenError();
  }

  // Buffer's base64 decoder is intentionally forgiving. Requiring the
  // canonical encoding prevents alternate or malformed signature spellings
  // from being accepted as the same MAC.
  if (supplied.toString("base64url") !== pieces[1]) {
    throw new InvalidTokenError();
  }

  const expected = signature(pieces[0]);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new InvalidTokenError();
  }

  try {
    return JSON.parse(Buffer.from(pieces[0], "base64url").toString("utf8"));
  } catch {
    throw new InvalidTokenError();
  }
}

export function assertNotExpired(expiresAt: number, now = Date.now()): void {
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(now / 1000)) {
    throw new InvalidTokenError();
  }
}

export function createPrivacyHmac(label: string, value: string): string {
  return createHmac("sha256", tokenSecret())
    .update(label)
    .update("\0")
    .update(value)
    .digest("base64url");
}

export function constantTimeEqualStrings(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}
