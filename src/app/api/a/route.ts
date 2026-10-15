import type { NextRequest } from "next/server";
import { MAX_BATCH } from "@/lib/analytics";
import { allow, isBot, record } from "@/lib/analytics-server";

/** Ingest for the consent-free analytics (src/components/analytics.tsx).
 *
 *  One request carries one page view: an array of events, each validated and counted on its own.
 *  Always answers 204, whatever happened: the beacon's sender is not waiting and must not learn
 *  what was filtered. Nothing here sets a cookie or stores an address. */

/** Room for MAX_BATCH events with a long landing referrer, and nothing like a payload. */
const MAX_BODY = 8000;

export async function POST(request: NextRequest) {
  const h = request.headers;
  const ownHost = h.get("host");

  const origin = h.get("origin");
  const sameOrigin = !origin || (() => {
    try {
      return new URL(origin).host === ownHost;
    } catch {
      return false;
    }
  })();
  // Do Not Track and Global Privacy Control are honoured here as well as in the browser, so a
  // client that sends the header but runs somebody else's script is still not counted.
  const optedOut = h.get("dnt") === "1" || h.get("sec-gpc") === "1";
  const prefetch = /prefetch|prerender/i.test(`${h.get("sec-purpose") ?? ""} ${h.get("purpose") ?? ""}`);
  const userAgent = h.get("user-agent");

  if (!sameOrigin || optedOut || prefetch || isBot(userAgent)) return new Response(null, { status: 204 });

  // x-forwarded-for can only be trusted where the platform overwrites it (Vercel), the same rule
  // as the form quotas in src/lib/public-forms.ts. It is used as an in-memory key and never stored.
  const trusted = process.env.VERCEL === "1" || process.env.NODE_ENV === "development";
  const address = trusted ? (h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null) : null;

  const text = await request.text();
  if (text.length > MAX_BODY) return new Response(null, { status: 204 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 204 });
  }
  // A single object is one event on its own, which is what an older tab still sends.
  const events = Array.isArray(body) ? body : [body];
  if (events.length === 0 || events.length > MAX_BATCH) return new Response(null, { status: 204 });
  if (!allow(address, Date.now(), events.length)) return new Response(null, { status: 204 });

  const ctx = { userAgent: userAgent ?? "", acceptLanguage: h.get("accept-language"), ownHost };
  await Promise.all(events.map((event) => record(event, ctx)));
  return new Response(null, { status: 204 });
}
