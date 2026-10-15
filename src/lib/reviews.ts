/** Independent places where guests rate La Cordobesa, shown on the home page as proof of quality.
 *
 *  Two halves, kept apart on purpose:
 *
 *  - REVIEW_PLATFORMS is the fixed part: who, where the profile lives, which mark to draw. Adding a
 *    place means appending here and dropping its mark into public/assets/platforms.
 *  - The numbers are not. They are copied by a person from the platform's own page, in /staff/bewertungen,
 *    and stored in site_settings under REVIEW_SCORES_KEY together with the date they were read. Nothing
 *    here scrapes or estimates a rating, and a platform with no number saved is shown as a plain link
 *    with its mark, never with stars.
 *
 *  Google needs the same treatment until somebody supplies a Places API key (which the site does not
 *  have): the profile link works, the stars appear as soon as the numbers are entered.
 *
 *  What is shown is a link to the profile plus the headline figure, never the text of any review. */

export const REVIEW_SCORES_KEY = "review_scores";

export type ReviewPlatformId = "google" | "coolibri" | "restaurantguru" | "werkenntdenbesten";

export type ReviewPlatform = {
  id: ReviewPlatformId;
  name: string;
  url: string;
  /** Path under /public of the platform's own mark. */
  mark: string;
  /** What the platform rates out of, so staff do not have to type it. */
  scale: string;
};

export const REVIEW_PLATFORMS: readonly ReviewPlatform[] = [
  {
    id: "google",
    name: "Google Maps",
    // The place's CID: stable, unlike a search URL, and opens straight onto the listing.
    url: "https://maps.google.com/?cid=5889401375445101453",
    mark: "/assets/platforms/google.svg",
    scale: "5",
  },
  {
    id: "coolibri",
    name: "coolibri",
    url: "https://coolibri.de/restaurant/la-cordobesa-frankfurt-am-main/",
    mark: "/assets/platforms/coolibri.svg",
    scale: "10",
  },
  {
    id: "restaurantguru",
    name: "Restaurant Guru",
    url: "https://de.restaurantguru.com/La-Cordobesa-Frankfurt",
    mark: "/assets/platforms/restaurantguru.png",
    scale: "5",
  },
  {
    id: "werkenntdenbesten",
    name: "Wer kennt den Besten",
    url: "https://www.werkenntdenbesten.de/e/114112398/suedamerikanisches-restaurant/frankfurt-am-main/la-cordobesa-bewertungen.html",
    mark: "/assets/platforms/werkenntdenbesten.png",
    scale: "5",
  },
];

export type ReviewScore = {
  /** As the platform shows it, with a decimal comma: "8,6". */
  value: string;
  /** What the platform rates out of: "10" or "5". */
  scale: string;
  /** How many ratings stand behind the value, when the platform says. */
  count: number | null;
  /** ISO date the figures were read off the platform. */
  checked: string;
};

export type ReviewScores = Partial<Record<ReviewPlatformId, ReviewScore>>;

/** What was read off the pages before there was a staff form. Used only while nothing has been saved
 *  in the staff area; the first save writes the whole set, which then replaces this. */
export const BASELINE_SCORES: ReviewScores = {
  coolibri: { value: "8,6", scale: "10", count: 80, checked: "2026-10-14" },
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "8,6" or "8.6" as a number, or null when it is not one. */
export function parseRatingValue(value: string): number | null {
  const n = Number(value.trim().replace(",", "."));
  return value.trim() !== "" && Number.isFinite(n) ? n : null;
}

/** The value, read as a share of five stars (0 to 5), or null if it cannot be drawn honestly:
 *  not a number, no scale, or outside 0..scale. */
export function starsOutOfFive(value: string, scale: string): number | null {
  const v = parseRatingValue(value);
  const s = parseRatingValue(scale);
  if (v === null || s === null || s <= 0 || v < 0 || v > s) return null;
  return Math.round(((v / s) * 5) * 10) / 10;
}

/** Whatever came out of the database, reduced to entries that are safe to render. Anything malformed
 *  is dropped rather than repaired: no figure is better than a wrong one. */
export function parseReviewScores(raw: unknown): ReviewScores {
  const out: ReviewScores = {};
  if (!raw || typeof raw !== "object") return out;
  for (const p of REVIEW_PLATFORMS) {
    const e = (raw as Record<string, unknown>)[p.id];
    if (!e || typeof e !== "object") continue;
    const { value, scale, count, checked } = e as Record<string, unknown>;
    if (typeof value !== "string" || typeof scale !== "string" || starsOutOfFive(value, scale) === null) continue;
    out[p.id] = {
      value: value.trim(),
      scale: scale.trim(),
      count: typeof count === "number" && Number.isInteger(count) && count > 0 ? count : null,
      checked: typeof checked === "string" && ISO_DATE.test(checked) ? checked : "",
    };
  }
  return out;
}

export type ResolvedReview = ReviewPlatform & { score: ReviewScore | null; stars: number | null };

/** The platforms in display order, each with its score if one is known. `stored` is the raw
 *  site_settings value, or null/undefined when the staff area has never saved one. */
export function resolveReviews(stored: unknown): ResolvedReview[] {
  const scores = stored === null || stored === undefined ? BASELINE_SCORES : parseReviewScores(stored);
  return REVIEW_PLATFORMS.map((p) => {
    const score = scores[p.id] ?? null;
    return { ...p, score, stars: score ? starsOutOfFive(score.value, score.scale) : null };
  });
}
