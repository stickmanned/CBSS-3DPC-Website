import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com https://server.fillout.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.r2.cloudflarestorage.com https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com https://embed.fillout.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(!isDevelopment ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
] as const;

/* The club's own home is cbss.3dprintingclub.org. The apex is being kept back
   for a general hub for other clubs, so apex and www move to the subdomain
   instead of serving a second copy of the same pages under a name that is
   going to mean something else.

   307, not 308. A permanent redirect is cached by browsers more or less
   forever, and the apex has a different future; a cached 308 would keep
   sending people to the club site long after the apex stopped being it.

   The *.vercel.app alias is deliberately left alone. It is the only hostname
   for this site that resolves on the school network, where the whole
   3dprintingclub.org zone is sinkholed, so redirecting it would take away the
   one address that still works from a school device. */
const canonicalOrigin = "https://cbss.3dprintingclub.org";
const clubHostPattern = "(?:www\\.)?3dprintingclub\\.org";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: clubHostPattern }],
        destination: `${canonicalOrigin}/:path*`,
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...securityHeaders],
      },
      {
        source: "/status/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
    ];
  },
};

export default nextConfig;
