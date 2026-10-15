import "server-only";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import {
  deviceFromWidth,
  isEvent,
  isStaffPath,
  isValidDetail,
  normalizePath,
  type Beacon,
} from "@/lib/analytics";

/** Crawlers, link-preview fetchers, monitors and headless browsers. A JS-running bot sends the
 *  beacon like anyone else, so the user agent is the only thing that can tell them apart. */
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|node-fetch|axios|go-http|java\//i;

export function isBot(userAgent: string | null) {
  return !userAgent || BOT.test(userAgent);
}

/** Browser family, coarse on purpose. In-app browsers get their own bucket because "people arrive
 *  from Instagram" is a question this site actually has. */
export function browserFamily(ua: string): string {
  if (/Instagram/i.test(ua)) return "instagram";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "facebook";
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  if (/Edg(e|A|iOS)?\//.test(ua)) return "edge";
  if (/OPR\/|Opera/.test(ua)) return "opera";
  if (/Firefox\/|FxiOS\//.test(ua)) return "firefox";
  if (/Chrome\/|CriOS\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "other";
}

/** The visitor's first preferred language, reduced to the three the site cares about. */
export function browserLanguage(acceptLanguage: string | null): string {
  const primary = acceptLanguage?.split(",")[0]?.trim().slice(0, 2).toLowerCase();
  return primary === "de" || primary === "es" || primary === "en" ? primary : "other";
}

/** com, de, co.uk, com.au, but not "com.evil.example". */
const TLD = "(com|[a-z]{2}|(co|com)\\.[a-z]{2})";

/** Referrers worth telling apart: search engines, social apps, maps and the review sites this shop is
 *  listed on. Each pattern (a domain with or without any subdomain) maps to the one host that is
 *  stored for it, so m.facebook.com, l.facebook.com and facebook.com are a single row. */
const KNOWN_REFERRERS: readonly (readonly [RegExp, string])[] = [
  [new RegExp(`(^|\\.)google\\.${TLD}$`), "google.com"],
  [/(^|\.)bing\.com$/, "bing.com"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo.com"],
  [/(^|\.)ecosia\.org$/, "ecosia.org"],
  [/(^|\.)yahoo\.com$/, "yahoo.com"],
  [/(^|\.)(instagram\.com|l\.instagram\.com)$/, "instagram.com"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "facebook.com"],
  [/(^|\.)(t\.co|x\.com|twitter\.com)$/, "x.com"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube.com"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "whatsapp.com"],
  [/(^|\.)tiktok\.com$/, "tiktok.com"],
  [/(^|\.)linkedin\.com$/, "linkedin.com"],
  [new RegExp(`(^|\\.)pinterest\\.${TLD}$`), "pinterest.com"],
  [/(^|\.)reddit\.com$/, "reddit.com"],
  [new RegExp(`(^|\\.)tripadvisor\\.${TLD}$`), "tripadvisor.com"],
  [new RegExp(`(^|\\.)yelp\\.${TLD}$`), "yelp.com"],
  [/(^|\.)restaurantguru\.com$/, "restaurantguru.com"],
  [/(^|\.)coolibri\.de$/, "coolibri.de"],
  [/(^|\.)werkenntdenbesten\.de$/, "werkenntdenbesten.de"],
  [/(^|\.)openstreetmap\.org$/, "openstreetmap.org"],
];

/** What is stored for a referrer that is not on KNOWN_REFERRERS. */
export const OTHER_REFERRER = "other";

/** Host of the referring page, or "" for a visit that came from this site or from nowhere. Only the
 *  host is kept: the path and query of a referrer can carry search terms or tokens.
 *
 *  The host is then bucketed. The referrer is part of analytics_daily's primary key and `r` is
 *  whatever the sender types (the endpoint accepts origin-less clients), so an open-ended host would
 *  let one script mint a new row per request. Anything not on KNOWN_REFERRERS is "other", which keeps
 *  the dimension to a few dozen values however it is abused. */
export function referrerHost(referrer: string | undefined, ownHost: string | null): string {
  if (!referrer) return "";
  try {
    const url = new URL(referrer);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!host || host === ownHost?.split(":")[0]?.replace(/^www\./, "")) return "";
    return KNOWN_REFERRERS.find(([pattern]) => pattern.test(host))?.[1] ?? OTHER_REFERRER;
  } catch {
    return "";
  }
}

/** A per-process limiter: at most `MAX_PER_WINDOW` beacons per address per minute, held in memory and
 *  gone when the instance is. Nothing is written anywhere, so the address is never stored, and it is
 *  only a speed bump: the counters can only be inflated, never filled with new rows, because every
 *  dimension is validated against a closed list (the referrer is bucketed, see referrerHost).
 *
 *  An address must not outlive its window, so expiry does not wait for the map to get big: a call
 *  sweeps stale entries at most every SWEEP_MS, and an unref'd timer sweeps once the traffic stops,
 *  so the last visitor's address is gone about a minute later even if nobody else ever arrives. The
 *  size cap is the backstop for a flood of distinct addresses inside one window: oldest go first. */
const WINDOW_MS = 60_000;
const SWEEP_MS = 5_000;
const MAX_PER_WINDOW = 60;
const MAX_ADDRESSES = 5000;
const seen = new Map<string, { start: number; count: number }>();
let lastSweep = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

function sweep(now: number) {
  lastSweep = now;
  for (const [key, v] of seen) if (now - v.start >= WINDOW_MS) seen.delete(key);
}

function scheduleSweep() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = undefined;
    sweep(Date.now());
    if (seen.size > 0) scheduleSweep();
  }, WINDOW_MS + 1000);
  timer.unref?.();
}

/** How many addresses the limiter holds right now. For tests. */
export function trackedAddresses() {
  return seen.size;
}

export function allow(address: string | null, now = Date.now()) {
  if (!address) return true;
  if (now - lastSweep >= SWEEP_MS) sweep(now);
  const entry = seen.get(address);
  if (!entry || now - entry.start >= WINDOW_MS) {
    // Delete first so the Map's insertion order stays the order of window starts: oldest first.
    seen.delete(address);
    seen.set(address, { start: now, count: 1 });
    while (seen.size > MAX_ADDRESSES) seen.delete(seen.keys().next().value as string);
    scheduleSweep();
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_PER_WINDOW;
}

/** Validates one beacon and, if it is acceptable, bumps its counter. Silent by design: analytics
 *  must never be able to break the site, so a missing RPC (the migration not pushed yet), a database
 *  hiccup or a malformed body all end the same way, with nothing. */
export async function record(
  beacon: unknown,
  ctx: { userAgent: string; acceptLanguage: string | null; ownHost: string | null },
) {
  try {
    const b = beacon as Partial<Beacon> | null;
    if (!b || typeof b !== "object" || !isEvent(b.e)) return;
    const detail = typeof b.d === "string" ? b.d : "";
    if (!isValidDetail(b.e, detail)) return;
    if (typeof b.p !== "string" || b.p.length > 200 || !b.p.startsWith("/") || isStaffPath(b.p)) return;

    const supabase = createPrivilegedClient();
    await supabase.rpc("track_event", {
      p_event: b.e,
      p_detail: detail,
      p_path: normalizePath(b.p),
      // Only a landing page has an outside referrer; later events in the same visit send none.
      p_referrer: b.e === "pageview" ? referrerHost(typeof b.r === "string" ? b.r : undefined, ctx.ownHost) : "",
      p_device: deviceFromWidth(typeof b.w === "number" ? b.w : NaN),
      p_browser: browserFamily(ctx.userAgent),
      p_lang: browserLanguage(ctx.acceptLanguage),
    });
  } catch {
    // Deliberately nothing. See above.
  }
}
