import { findActiveAdminByGithubId as findAdmin } from "@/app/lib/queue/repository";

export type ActiveAdmin = {
  id: string;
  githubId: string;
  githubLogin: string;
  displayName: string | null;
};

export async function findActiveAdminByGithubId(
  githubId: string,
): Promise<ActiveAdmin | null> {
  const admin = await findAdmin(githubId);
  if (!admin) return null;
  return {
    id: admin.id,
    githubId: admin.githubId,
    githubLogin: admin.githubLogin,
    displayName: admin.displayName,
  };
}
