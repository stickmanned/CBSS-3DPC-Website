import Link from "next/link";
import { signOut, type ActiveAdmin } from "@/app/lib/auth";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/admin/sign-in" });
}

export default function AdminHeader({
  admin,
  backHref,
  backLabel,
}: {
  admin: ActiveAdmin;
  backHref?: string;
  backLabel?: string;
}) {
  const name = admin.displayName?.trim() || admin.githubLogin;
  return (
    <div className="flex flex-col gap-4 border-b border-mist pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        {backHref && (
          <Link href={backHref} className="text-link mb-3 text-sm">
            <span aria-hidden="true">←</span>
            {backLabel ?? "Back"}
          </Link>
        )}
        <p className="eyebrow text-slate">Private administrator workspace</p>
        <p className="mt-2 truncate text-sm text-slate">
          Signed in as <strong className="text-ink">{name}</strong>
        </p>
      </div>
      <form action={signOutAction}>
        <button type="submit" className="btn btn--secondary btn--sm w-full sm:w-auto">
          Sign out
        </button>
      </form>
    </div>
  );
}

