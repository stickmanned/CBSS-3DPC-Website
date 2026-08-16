import Link from "next/link";
import { signOut, type ActiveAdmin } from "@/app/lib/auth";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/admin/sign-in" });
}

/**
 * Always rendered on a dark ground (the attention band and the detail masthead),
 * so its type is white-on-dark. It previously used `text-ink` here, which was
 * invisible against `bg-ink` on the request detail page.
 */
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
    <div className="flex flex-col gap-4 border-b border-white/15 pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        {backHref && (
          <Link
            href={backHref}
            className="mb-3 inline-flex min-h-11 items-center gap-2 whitespace-nowrap text-sm text-white/70 underline decoration-white/30 underline-offset-4 transition-colors duration-[var(--dur-hover)] hover:text-white hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            <span aria-hidden="true">←</span>
            {backLabel ?? "Back"}
          </Link>
        )}
        <p className="font-display text-sm font-bold tracking-[0.02em] text-white">
          CBSS print queue
        </p>
        <p className="mt-1 truncate text-sm text-white/60">
          Private workspace · signed in as <strong className="font-bold text-white">{name}</strong>
        </p>
      </div>
      <form action={signOutAction}>
        <button type="submit" className="btn btn--light btn--sm w-full whitespace-nowrap sm:w-auto">
          Sign out
        </button>
      </form>
    </div>
  );
}
