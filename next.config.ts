import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Static CSP (no nonces) so the public pages can stay a prerendered static shell.
// All Supabase traffic is server-side, so the browser only ever talks to this origin.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Instagram media is served from scontent*.cdninstagram.com; next/image proxies it, but the
  // optimizer still emits same-origin URLs, so only 'self' is needed here.
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src https://www.google.com https://maps.google.com https://www.openstreetmap.org",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

// Local Supabase (`supabase start`) serves over plain http on a loopback port, not https like the
// hosted project, so the protocol and port have to come from the URL too, not be assumed.
const supabaseStorageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [
      ...(supabaseStorageUrl
        ? [
            {
              protocol: supabaseStorageUrl.protocol.replace(":", "") as "http" | "https",
              hostname: supabaseStorageUrl.hostname,
              port: supabaseStorageUrl.port || undefined,
              pathname: "/storage/v1/object/public/gallery/**",
            },
          ]
        : []),
      // Instagram serves media from per-region scontent hosts, so the hostname cannot be pinned to one.
      // `**` because those hosts nest (scontent.xx.fbcdn.net) and `*` matches one label only.
      // Only while the feed is configured (src/lib/instagram.ts needs both variables; read at build
      // time, so enabling the feed means a redeploy), and only the `/v/` media path those hosts use
      // for post images. Otherwise anyone could push arbitrary URLs under these domains through
      // /_next/image and run up transformations. The query string stays open on purpose: Instagram's
      // signed parameters (`oh`, `oe`, `_nc_*`) differ per post and expire.
      ...(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_USER_ID
        ? [
            { protocol: "https" as const, hostname: "**.cdninstagram.com", pathname: "/v/**" },
            { protocol: "https" as const, hostname: "**.fbcdn.net", pathname: "/v/**" },
          ]
        : []),
    ],
    // The optimizer follows redirects without re-checking remotePatterns, so a pattern host that
    // redirects elsewhere would be an open proxy. None of the allowed sources redirect.
    maximumRedirects: 0,
    // Source images are small (gallery uploads are resized in the browser, Instagram stills are well
    // under 1 MB), so a large hostile file cannot be pulled through the optimizer.
    maximumResponseBody: 10_000_000,
    // Next.js refuses to fetch images from loopback/private IPs by default (SSRF guard); local
    // Supabase runs on 127.0.0.1, so dev needs the escape hatch. Never enabled in production, where
    // the Supabase host above is always the hosted https project, never a private IP.
    ...(isDev ? { dangerouslyAllowLocalIP: true } : {}),
  },
  experimental: {
    // The site has a root layout per language, so there is no single layout a 404 could be
    // composed from; global-not-found.tsx renders its own document instead.
    globalNotFound: true,
    // Gallery uploads are resized in the browser to well under 5 MB before they reach the server action.
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // A retired URL space that still lives in bookmarks, installed apps and sent mails: the staff app
  // was /admin until it became /staff. (English used to be redirected to German here too; /en is a
  // real language again, see src/lib/i18n.ts.)
  async redirects() {
    return [
      { source: "/admin", destination: "/staff", permanent: true },
      { source: "/admin/:path*", destination: "/staff/:path*", permanent: true },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
