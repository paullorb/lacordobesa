/** Independent places where guests rate La Cordobesa, shown on the home page as proof of quality.
 *
 *  Add a source by appending to REVIEWS. `score` is copied by hand from the source and dated in
 *  `checked`, because the numbers move: leave it out rather than show one that is stale or that
 *  nobody read off the page. Google's rating is not scraped for the same reason; the link opens
 *  the place, where the current stars and reviews are one tap away. */
export type ReviewSource = {
  name: string;
  url: string;
  /** e.g. { value: "8,6", scale: "10", count: 80 } as the source shows it. */
  score?: { value: string; scale: string; count: number };
  /** ISO date the score was read off the source page. */
  checked?: string;
};

export const REVIEWS: ReviewSource[] = [
  {
    name: "Google Maps",
    // The place's CID: stable, unlike a search URL, and opens straight onto the listing.
    url: "https://maps.google.com/?cid=5889401375445101453",
  },
  {
    name: "coolibri",
    url: "https://coolibri.de/restaurant/la-cordobesa-frankfurt-am-main/",
    score: { value: "8,6", scale: "10", count: 80 },
    checked: "2026-10-14",
  },
];
