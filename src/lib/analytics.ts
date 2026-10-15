/** What the consent-free analytics may count, shared by the browser (what to send) and the server
 *  (what to accept). Everything is a closed list on purpose: nothing a visitor types and nothing
 *  that identifies them can become a counter.
 *
 *  What is stored is a daily count per (event, detail, path, referrer host, device, browser, language)
 *  and nothing else. There is no visitor id, so the numbers are visits and clicks, never "people".
 *  See migration 20261015085039 and the Datenschutzerklärung, section 5. */

export const FORMS = ["reservation", "waitlist", "preorder", "inquiry", "specials"] as const;
export type FormName = (typeof FORMS)[number];

export const CLICKS = ["phone", "whatsapp", "email", "maps", "instagram"] as const;
export type ClickTarget = (typeof CLICKS)[number];

export const VITALS = ["LCP", "CLS", "INP", "FCP", "TTFB"] as const;
export const RATINGS = ["good", "needs-improvement", "poor"] as const;

/** Which `detail` values each event accepts. A function rather than a list so vitals can be the
 *  cross product without writing it out. */
const DETAIL: Record<string, (detail: string) => boolean> = {
  pageview: (d) => d === "",
  click: (d) => (CLICKS as readonly string[]).includes(d),
  form_submit: (d) => (FORMS as readonly string[]).includes(d),
  form_success: (d) => (FORMS as readonly string[]).includes(d),
  form_error: (d) => (FORMS as readonly string[]).includes(d),
  reservation_step: (d) => d === "2" || d === "3" || d === "4",
  gallery_open: (d) => d === "",
  map_load: (d) => d === "",
  vital: (d) => {
    const [name, rating, extra] = d.split(":");
    return extra === undefined && (VITALS as readonly string[]).includes(name) && (RATINGS as readonly string[]).includes(rating);
  },
};

export type AnalyticsEvent = keyof typeof DETAIL;

export const isEvent = (v: unknown): v is AnalyticsEvent => typeof v === "string" && Object.hasOwn(DETAIL, v);
export const isValidDetail = (event: AnalyticsEvent, detail: string) => DETAIL[event](detail);

/** The pages that get their own row. Anything else is counted as OTHER_PATH, so a mistyped URL or a
 *  crawler probing /wp-admin cannot mint new rows. */
const PAGES = ["/", "/karte", "/gallery", "/vorbestellen", "/catering", "/datenschutz", "/impressum"];
export const KNOWN_PATHS = [
  ...PAGES,
  ...PAGES.map((p) => (p === "/" ? "/es" : `/es${p}`)),
  ...PAGES.map((p) => (p === "/" ? "/en" : `/en${p}`)),
];
export const OTHER_PATH = "/other";

/** The path to record for a URL path. The token pages (/reservierung/<token> and friends) are folded
 *  into one row each without the token, so a credential never reaches the table. */
export function normalizePath(raw: string): string {
  const path = raw.length > 1 ? raw.replace(/\/+$/, "") : raw;
  if (KNOWN_PATHS.includes(path)) return path;
  const token = /^(\/es|\/en)?\/(reservierung|vorbestellung|abmelden)\/[^/]+$/.exec(path);
  if (token) return `${token[1] ?? ""}/${token[2]}/*`;
  return OTHER_PATH;
}

/** Staff pages are never counted. */
export const isStaffPath = (path: string) => path === "/staff" || path.startsWith("/staff/");

export type Device = "phone" | "tablet" | "desktop";

/** Three buckets from the viewport width, which is all the layout cares about. */
export function deviceFromWidth(width: number): Device | "" {
  if (!Number.isFinite(width) || width <= 0) return "";
  if (width < 640) return "phone";
  if (width < 1024) return "tablet";
  return "desktop";
}

/** The wire format of one beacon. */
export type Beacon = { e: string; d?: string; p: string; r?: string; w?: number };
