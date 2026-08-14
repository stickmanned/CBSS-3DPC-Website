import Link from "next/link";
import { signIn } from "@/app/lib/auth";

export const dynamic = "force-dynamic";

function authIsConfigured() {
  const secret = process.env.AUTH_SECRET;
  return Boolean(
    secret &&
      Buffer.byteLength(secret, "utf8") >= 32 &&
      process.env.AUTH_GITHUB_ID &&
      process.env.AUTH_GITHUB_SECRET &&
      process.env.DATABASE_URL,
  );
}

async function githubSignInAction() {
  "use server";
  if (!authIsConfigured()) return;
  await signIn("github", { redirectTo: "/admin" });
}

export default function AdminSignInPage() {
  const configured = authIsConfigured();
  return (
    <div className="build-grid min-h-[70vh] px-5 py-16 sm:py-24">
      <section className="mx-auto max-w-xl rounded-[20px] border border-mist bg-white p-7 shadow-[0_24px_60px_rgb(18_23_43/0.12)] sm:p-10">
        <p className="eyebrow text-slate">Private workspace</p>
        <h1 className="mt-4 text-[clamp(2.5rem,8vw,4.5rem)] text-ink">Print queue admin</h1>
        <p className="mt-6 text-base text-slate">
          This area is only for authorized CBSS 3D Printing Club members. GitHub confirms your
          identity, and the club&apos;s active administrator list controls access.
        </p>

        {configured ? (
          <form action={githubSignInAction} className="mt-8">
            <button type="submit" className="btn btn--dark btn--lg w-full">
              Continue with GitHub <span aria-hidden="true">→</span>
            </button>
          </form>
        ) : (
          <div className="mt-8 rounded-2xl border border-signal bg-signal/20 p-5 text-sm text-ink">
            <p className="font-display font-bold">Administrator sign-in is not configured yet.</p>
            <p className="mt-2">
              A site manager needs to connect GitHub authentication and the queue database before
              authorized members can sign in.
            </p>
          </div>
        )}

        <p className="mt-7 text-sm text-slate">
          Looking for your own request? Use the private status link in your confirmation email.
        </p>
        <Link href="/" className="text-link mt-6 text-sm">
          <span aria-hidden="true">←</span> Return to the club website
        </Link>
      </section>
    </div>
  );
}
