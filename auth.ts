import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { findActiveAdminByGithubId } from "@/app/lib/auth/admin-store";

const AUTH_SESSION_SECONDS = 8 * 60 * 60;

export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.AUTH_SECRET &&
      Buffer.byteLength(process.env.AUTH_SECRET, "utf8") >= 32 &&
      process.env.AUTH_GITHUB_ID &&
      process.env.AUTH_GITHUB_SECRET &&
      process.env.DATABASE_URL,
  );
}

const github = GitHub({
  // Placeholders keep imports and static builds safe. Every runtime auth entry
  // point fails closed before these values can be used.
  clientId: process.env.AUTH_GITHUB_ID ?? "configuration-required",
  clientSecret: process.env.AUTH_GITHUB_SECRET ?? "configuration-required",
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: process.env.AUTH_TRUST_HOST === "true" || Boolean(process.env.VERCEL),
  providers: [github],
  session: { strategy: "jwt", maxAge: AUTH_SESSION_SECONDS },
  callbacks: {
    async signIn({ account, profile }) {
      if (!isAuthConfigured() || account?.provider !== "github") return false;
      const githubId = account.providerAccountId || String(profile?.id ?? "");
      if (!githubId) return false;

      try {
        return Boolean(await findActiveAdminByGithubId(githubId));
      } catch {
        return false;
      }
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === "github") {
        token.githubId = account.providerAccountId;
        token.githubLogin =
          typeof profile?.login === "string" ? profile.login : token.name ?? "";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.githubId =
          typeof token.githubId === "string" ? token.githubId : undefined;
        session.user.githubLogin =
          typeof token.githubLogin === "string" ? token.githubLogin : undefined;
      }
      return session;
    },
  },
});
