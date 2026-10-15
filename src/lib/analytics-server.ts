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

/** Host of the referring page, or "" for a visit that came from this site or from nowhere. Only the
 *  host is kept: the path and query of a referrer can carry search terms or tokens. */
export function referrerHost(referrer: string | undefined, ownHost: string | null): string {
  if (!referrer) return "";
  try {
    const url = new URL(referrer);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!host || host === ownHost?.split(":")[0]?.replace(/^www\./, "")) return "";
    return host.slice(0, 60);
  } catch {
    return "";
  }
}

/** A per-process limiter: at most `max` beacons per address per minute, held in memory and gone when
 *  the instance is. Nothing is written anywhere, so the address is never stored, and it is only a
 *  speed bump: the counters can only be inflated, never filled with new rows, because every
 *  dimension is validated against a closed list. */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
const seen = new Map<string, { start: number; count: number }>();

export function allow(address: string | null, now = Date.now()) {
  if (!address) return true;
  if (seen.size > 5000) {
    for (const [key, v] of seen) if (now - v.start > WINDOW_MS) seen.delete(key);
    if (seen.size > 5000) seen.clear();
  }
  const entry = seen.get(address);
  if (!entry || now - entry.start > WINDOW_MS) {
    seen.set(address, { start: now, count: 1 });
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
