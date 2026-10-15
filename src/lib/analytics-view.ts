/** Shaping analytics_breakdown rows for the staff page. Pure, so the arithmetic can be tested. */

import { addDays } from "@/lib/dates";
import type { Bar } from "@/lib/staff-stats";

export type Row = { bucket: string; total: number };

const PAGE_LABEL: Record<string, string> = {
  "/": "Startseite",
  "/karte": "Karte",
  "/gallery": "Galerie",
  "/vorbestellen": "Vorbestellen",
  "/catering": "Feiern und Catering",
  "/datenschutz": "Datenschutz",
  "/impressum": "Impressum",
  "/reservierung/*": "Reservierung verwalten",
  "/vorbestellung/*": "Vorbestellung verwalten",
  "/abmelden/*": "Specials abmelden",
  "/other": "Sonstige Seiten",
};

/** A readable name for a stored path; the Spanish pages carry the same name with " (ES)". */
export function pageLabel(path: string): string {
  if (path === "/es") return "Startseite (ES)";
  if (path.startsWith("/es/")) return `${PAGE_LABEL[path.slice(3)] ?? path} (ES)`;
  return PAGE_LABEL[path] ?? path;
}

const DEVICE_LABEL: Record<string, string> = { phone: "Handy", tablet: "Tablet", desktop: "Desktop", "": "Unbekannt" };
const BROWSER_LABEL: Record<string, string> = {
  instagram: "Instagram-App",
  facebook: "Facebook-App",
  samsung: "Samsung Internet",
  edge: "Edge",
  opera: "Opera",
  firefox: "Firefox",
  chrome: "Chrome",
  safari: "Safari",
  other: "Andere",
};
const LANG_LABEL: Record<string, string> = { de: "Deutsch", es: "Spanisch", en: "Englisch", other: "Andere" };

export const deviceLabel = (k: string) => DEVICE_LABEL[k] ?? k;
export const browserLabel = (k: string) => BROWSER_LABEL[k] ?? k;
export const langLabel = (k: string) => LANG_LABEL[k] ?? k;

export const sum = (rows: Row[]) => rows.reduce((n, r) => n + r.total, 0);

/** Rows to bars, biggest first, with the tail folded into "Weitere" so a long list of referrers
 *  stays readable. An empty key (no referrer) is the direct visit. */
export function toBars(rows: Row[], label: (key: string) => string, limit = 8): Bar[] {
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  const head = sorted.slice(0, limit).map((r) => ({ label: label(r.bucket), value: r.total }));
  const rest = sum(sorted.slice(limit));
  return rest > 0 ? [...head, { label: "Weitere", value: rest }] : head;
}

/** One bar per calendar day, zeros included, so a quiet day shows as a short bar and not as a
 *  missing one. Oldest first. */
export function dailyBars(rows: Row[], from: string, to: string): Bar[] {
  const byDay = new Map(rows.map((r) => [r.bucket, r.total]));
  const bars: Bar[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const [, m, d] = day.split("-");
    bars.push({ label: `${d}.${m}.`, value: byDay.get(day) ?? 0 });
  }
  return bars;
}

export type VitalLine = { name: string; good: number; improve: number; poor: number; total: number; goodPercent: number | null };

/** Web Vitals rows ("LCP:good") grouped per metric. The share is of the measurements that came in,
 *  and the total is kept so a share of three samples does not read like a share of three thousand. */
export function vitalLines(rows: Row[], order: readonly string[]): VitalLine[] {
  return order.map((name) => {
    const count = (rating: string) => rows.find((r) => r.bucket === `${name}:${rating}`)?.total ?? 0;
    const good = count("good");
    const improve = count("needs-improvement");
    const poor = count("poor");
    const total = good + improve + poor;
    return { name, good, improve, poor, total, goodPercent: total > 0 ? Math.round((good / total) * 100) : null };
  });
}

/** "x von y", as a percentage, or null when there is nothing to divide by. */
export const share = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);
