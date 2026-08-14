import { auth, isAuthConfigured } from "@/auth";
import {
  findActiveAdminByGithubId,
  type ActiveAdmin,
} from "./admin-store";

export class AuthConfigurationError extends Error {
  constructor() {
    super("Authentication is not configured.");
    this.name = "AuthConfigurationError";
  }
}

export class AdminAuthorizationError extends Error {
  constructor() {
    super("Administrative access is required.");
    this.name = "AdminAuthorizationError";
  }
}

/**
 * Privileged code must call this helper itself. A valid JWT is not enough:
 * the database allowlist is re-read on every call so revocation is immediate.
 */
export async function requireAdmin(): Promise<ActiveAdmin> {
  if (!isAuthConfigured()) throw new AuthConfigurationError();

  const session = await auth();
  const githubId = session?.user?.githubId;
  if (!githubId) throw new AdminAuthorizationError();

  let admin: ActiveAdmin | null;
  try {
    admin = await findActiveAdminByGithubId(githubId);
  } catch {
    throw new AuthConfigurationError();
  }
  if (!admin) throw new AdminAuthorizationError();
  return admin;
}
