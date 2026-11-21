import { createHash, timingSafeEqual } from "node:crypto";
import type { GalleryCategory } from "@/lib/gallery";

/** The pure half of the shared-album import (the route is src/app/api/gallery-sync/route.ts, the
 *  script that feeds it is scripts/sync-album.mjs). Kept free of Next and Supabase so it is unit-tested. */

/** The `source` every album photo is filed under in `gallery_imports`. */
export const ALBUM_SOURCE = "icloud";

/** What the owners did not say goes here. Most of what a pastelería photographs is food, and staff
 *  can move a photo to another category under /staff/gallery. */
export const DEFAULT_ALBUM_CATEGORY: GalleryCategory = "food";

/** Hashtags the owners may put in a photo's caption to file it, in the three languages they write in. */
const CATEGORY_TAGS: Record<string, GalleryCategory> = {
  food: "food", essen: "food", comida: "food",
  venue: "venue", lokal: "venue", local: "venue",
  events: "events", event: "events", evento: "events", eventos: "events", feier: "events", fiesta: "events",
};

export const CAPTION_MAX = 160;

/** "Medialunas recién horneadas #comida" -> the caption without the tag, and the category it named.
 *  Only a known tag is removed; any other hashtag is the owners' own text and stays. */
export function parseAlbumCaption(raw: string | null | undefined): { caption: string | null; category: GalleryCategory } {
  let category: GalleryCategory | null = null;
  const text = (raw ?? "").replace(/(^|\s)#([\p{L}]+)/gu, (match, lead: string, tag: string) => {
    const hit = CATEGORY_TAGS[tag.toLowerCase()];
    if (!hit) return match;
    category ??= hit;
    return lead;
  });
  const caption = text.replace(/\s+/g, " ").trim().slice(0, CAPTION_MAX) || null;
  return { caption, category: category ?? DEFAULT_ALBUM_CATEGORY };
}

/** iCloud photo GUIDs are UUIDs; anything else that fits is accepted so a second source can reuse this. */
export const isSourceId = (v: string) => /^[A-Za-z0-9._:-]{1,128}$/.test(v);

/** Whether `header` is `Bearer <GALLERY_SYNC_TOKEN>`. Compared as digests so the comparison takes the
 *  same time whatever was sent, and false whenever the token is unset: an unconfigured site has no
 *  import endpoint rather than an open one. */
export function syncAuthorized(header: string | null, token = process.env.GALLERY_SYNC_TOKEN): boolean {
  if (!token || token.length < 32 || !header?.startsWith("Bearer ")) return false;
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(header.slice(7)), digest(token));
}

export const isJpeg = (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
