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
const DISALLOW = [
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
  "/specials/confirm",
  "/es/specials/confirm",
  "/en/specials/confirm",
];

/**
 * The crawlers behind AI search and assistants, named so that being quoted by them is a decision
 * written down rather than an accident of `*`. A restaurant wants to be the answer when somebody
 * asks ChatGPT, Perplexity, Claude or Gemini where to eat empanadas in Frankfurt.
 *
 * A crawler obeys only the most specific group that names it, so each of these repeats the same
 * disallow list: naming a bot with `allow: "/"` alone would hand it the token pages.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "Google-Extended",
  "Applebot-Extended",
  "Amazonbot",
  "meta-externalagent",
  "MistralAI-User",
  "DuckAssistBot",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      { userAgent: AI_CRAWLERS, allow: "/", disallow: DISALLOW },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
