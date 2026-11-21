/**
 * Brings new photos from the owners' shared iCloud album into the site's gallery.
 *
 *   ICLOUD_ALBUM_URL=https://www.icloud.com/sharedalbum/#... \
 *   SITE_URL=https://lacordobesa.vercel.app GALLERY_SYNC_TOKEN=... node scripts/sync-album.mjs
 *
 * Run twice a day by .github/workflows/sync-album.yml. Safe to run as often as you like: the site
 * keeps a ledger of every album photo it has taken, and a photo on that ledger is never fetched
 * again, including one staff have since deleted from the gallery.
 *
 * What it can reach: that one album, read-only, through its public link (scripts/lib/icloud-album.mjs),
 * and the site's import endpoint (src/app/api/gallery-sync/route.ts). No Apple ID, no Supabase key.
 *
 * To look before anything is uploaded, set OUT_DIR: the branded files are written there instead
 * and the site is only asked what it already has (and not even that without SITE_URL).
 *
 *   ICLOUD_ALBUM_URL=... OUT_DIR=/tmp/album node scripts/sync-album.mjs
 *
 * Captions become the gallery caption. A hashtag files the photo: #comida/#essen/#food,
 * #local/#lokal/#venue, #evento/#event/#feier. Without one it is filed as food.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { photoUrls, readAlbum } from "./lib/icloud-album.mjs";
import { brandPhoto } from "./lib/brand-photo.mjs";

const { ICLOUD_ALBUM_URL, GALLERY_SYNC_TOKEN, OUT_DIR } = process.env;
const SITE_URL = (process.env.SITE_URL ?? "").replace(/\/+$/, "");
/** A first run on a full album is spread over several runs rather than one long one. */
const MAX_PER_RUN = Number(process.env.MAX_PER_RUN) || 30;
const PUBLIC_URL = process.env.PUBLIC_SITE_URL || SITE_URL || "https://lacordobesa.vercel.app";

if (!ICLOUD_ALBUM_URL) {
  // Not an error: the workflow ships before the owners have made the album public.
  console.log("::notice::Album sync is not configured (ICLOUD_ALBUM_URL is unset); nothing to do.");
  process.exit(0);
}
const dryRun = Boolean(OUT_DIR);
if (!dryRun && !(SITE_URL && GALLERY_SYNC_TOKEN)) {
  console.error("Set SITE_URL and GALLERY_SYNC_TOKEN, or OUT_DIR for a dry run.");
  process.exit(1);
}

const endpoint = `${SITE_URL}/api/gallery-sync`;
const auth = { authorization: `Bearer ${GALLERY_SYNC_TOKEN}` };

async function knownIds() {
  if (!(SITE_URL && GALLERY_SYNC_TOKEN)) return new Set();
  const response = await fetch(endpoint, { headers: auth });
  if (response.status === 404) throw new Error("The site refused the sync token (404): GALLERY_SYNC_TOKEN differs between here and Vercel, or the route is not deployed yet.");
  if (!response.ok) throw new Error(`GET ${endpoint} answered ${response.status}: ${await response.text()}`);
  return new Set((await response.json()).known);
}

const album = await readAlbum(ICLOUD_ALBUM_URL);
const known = await knownIds();
const fresh = album.photos.filter((p) => !known.has(p.id));
const batch = fresh.slice(0, MAX_PER_RUN);
console.log(`Album "${album.name}": ${album.photos.length} photos, ${known.size} already imported, ${fresh.length} new${fresh.length > batch.length ? ` (taking ${batch.length} this run)` : ""}.`);

const urls = await photoUrls(album, batch);
if (dryRun) await mkdir(OUT_DIR, { recursive: true });

let added = 0;
const failures = [];
// Oldest first, one at a time: the gallery shows newest first by insert time, so the album's
// latest photo ends up on top, and a failure half way leaves a clean prefix behind.
for (const photo of batch) {
  try {
    const url = urls.get(photo.id);
    if (!url) throw new Error("iCloud gave no download link");
    const original = await fetch(url);
    if (!original.ok) throw new Error(`download answered ${original.status}`);
    const jpeg = await brandPhoto(Buffer.from(await original.arrayBuffer()), {
      siteUrl: PUBLIC_URL,
      caption: photo.caption.replace(/(^|\s)#\S+/g, "$1").replace(/\s+/g, " ").trim(),
      year: Number(photo.created.slice(0, 4)) || new Date().getFullYear(),
    });

    if (dryRun) {
      await writeFile(path.join(OUT_DIR, `${photo.id}.jpg`), jpeg);
      console.log(`wrote ${photo.id}.jpg (${Math.round(jpeg.length / 1024)} kB) "${photo.caption}"`);
      continue;
    }
    const form = new FormData();
    form.set("source_id", photo.id);
    form.set("caption", photo.caption);
    form.set("file", new Blob([jpeg], { type: "image/jpeg" }), `${photo.id}.jpg`);
    const response = await fetch(endpoint, { method: "POST", headers: auth, body: form });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`site answered ${response.status}: ${result.error ?? ""}`);
    if (result.status === "added") added++;
    console.log(`${result.status}: ${photo.id} [${result.category ?? "-"}] "${photo.caption}"`);
  } catch (error) {
    failures.push(photo.id);
    console.error(`::warning::${photo.id} failed: ${error.message}`);
  }
}

console.log(dryRun ? `Dry run: ${batch.length - failures.length} files in ${OUT_DIR}.` : `Added ${added} photo(s).`);
// A photo that fails is retried next run, but a run where one failed is still a red run: somebody should look.
if (failures.length) process.exit(1);
