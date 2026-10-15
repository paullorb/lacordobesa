import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * What crawlers may read.
 *
 * The disallowed paths are the ones whose URL *is* a credential: a reservation, a pre-order or an
 * unsubscribe token. Those pages already send `noindex` and `referrer: no-referrer`, so this is the
 * belt to that pair of braces, and it keeps the tokens out of any crawler's logs. `/staff` is
 * disallowed for tidiness rather than safety, since every page behind it requires a session.
 *
 * Note that disallowing a path does not hide it from a crawler that already knows the URL; it only
 * asks politely. The tokens are 18 random bytes, which is what actually protects them.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/staff",
          "/reservierung/",
          "/vorbestellung/",
          "/abmelden/",
          // Rules match from the start of the path, so the Spanish and English token pages need their own.
          "/es/reservierung/",
          "/es/vorbestellung/",
          "/es/abmelden/",
          "/en/reservierung/",
          "/en/vorbestellung/",
          "/en/abmelden/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
