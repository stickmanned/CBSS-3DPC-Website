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

/**
 * The proxy now forwards the requested path here, so this value is reachable by
 * anyone who can craft a link. Only in-app admin paths are honoured — a scheme,
 * a protocol-relative `//host`, or a backslash would otherwise turn the club's
 * sign-in page into an open redirector.
 */
function safeCallbackPath(value: unknown): string {
  if (typeof value !== "string") return "/admin";
  // The boundary matters: "/adminredirect@host" is not the admin area.
  if (!/^\/admin(?:[/?#]|$)/.test(value)) return "/admin";
  if (value.startsWith("//") || value.includes("\\")) return "/admin";
  // Control characters and spaces can smuggle a second path or header.
  if (/[\u0000-\u0020\u007f]/.test(value)) return "/admin";
  return value;
}

async function githubSignInAction(formData: FormData) {
  "use server";
  if (!authIsConfigured()) return;
  await signIn("github", { redirectTo: safeCallbackPath(formData.get("callbackUrl")) });
}

export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const callbackUrl = safeCallbackPath(
    Array.isArray(raw.callbackUrl) ? raw.callbackUrl[0] : raw.callbackUrl,
  );
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
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
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
