/**
 * Reads ONE iCloud Shared Album through its public web link, with no Apple account involved.
 *
 * When an album's owner turns on "Public Website", Apple serves it at
 * https://www.icloud.com/sharedalbum/#<token>. The page behind that link loads the album from two
 * unauthenticated JSON endpoints, and those are all this file calls. The token is the entire
 * credential: it opens that album, read-only, and nothing else in anybody's photo library. That is
 * the reason for doing it this way rather than signing in to iCloud.
 *
 * The endpoints are not a documented API. If Apple changes them this throws, the workflow goes red
 * and files an issue, and the gallery simply stops growing until it is fixed; nothing is removed.
 */

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const base62 = (s) => [...s].reduce((n, ch) => n * 62 + BASE62.indexOf(ch), 0);

/** The token from a share link, or the token itself if that is what was given. */
export function albumToken(linkOrToken) {
  const token = String(linkOrToken ?? "").trim().split("#").pop().split("/").pop();
  if (!/^[0-9A-Za-z]{10,40}$/.test(token)) throw new Error("ICLOUD_ALBUM_URL is not a shared album link (expected https://www.icloud.com/sharedalbum/#...)");
  return token;
}

/** Apple shards albums over hosts; the shard number is written into the token itself. */
export function albumHost(token) {
  const partition = token[0] === "A" ? base62(token[1]) : base62(token.slice(1, 3));
  return `p${String(partition).padStart(2, "0")}-sharedstreams.icloud.com`;
}

async function post(host, token, endpoint, body, fetchImpl) {
  const response = await fetchImpl(`https://${host}/${token}/sharedstreams/${endpoint}`, {
    method: "POST",
    headers: { "content-type": "text/plain", origin: "https://www.icloud.com" },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  return response;
}

/** The largest still Apple offers for a photo. Keys are pixel sizes; a video's poster frame is not one. */
export function bestDerivative(photo) {
  return Object.entries(photo.derivatives ?? {})
    .filter(([key, d]) => /^\d+$/.test(key) && d?.checksum)
    .map(([, d]) => ({ checksum: d.checksum, width: Number(d.width) || 0, height: Number(d.height) || 0, bytes: Number(d.fileSize) || 0 }))
    .sort((a, b) => b.width * b.height - a.width * a.height || b.bytes - a.bytes)[0];
}

/** What the sync needs from the album's raw photo list: still photos only, oldest first. */
export function normalisePhotos(stream) {
  return (stream.photos ?? [])
    .filter((p) => p.photoGuid && p.mediaAssetType !== "video")
    .map((p) => ({ id: p.photoGuid, caption: (p.caption ?? "").trim(), created: p.dateCreated ?? p.batchDateCreated ?? "", best: bestDerivative(p) }))
    .filter((p) => p.best)
    .sort((a, b) => a.created.localeCompare(b.created));
}

/** The album's photos: `{ name, photos: [{ id, caption, created, best }] }`. */
export async function readAlbum(linkOrToken, fetchImpl = fetch) {
  const token = albumToken(linkOrToken);
  let host = albumHost(token);
  let response = await post(host, token, "webstream", { streamCtag: null }, fetchImpl);
  // 330 is Apple's "wrong shard": the body names the right host.
  if (response.status === 330) {
    host = (await response.json())["X-Apple-MMe-Host"];
    if (!/^p\d+-sharedstreams\.icloud\.com$/.test(host ?? "")) throw new Error("iCloud redirected the album to an unexpected host");
    response = await post(host, token, "webstream", { streamCtag: null }, fetchImpl);
  }
  if (response.status === 404) throw new Error("iCloud does not know this album: is \"Public Website\" still switched on for it?");
  if (!response.ok) throw new Error(`iCloud webstream answered ${response.status}`);
  const stream = await response.json();
  if (!Array.isArray(stream.photos)) throw new Error("iCloud webstream has no photo list: the format may have changed");
  return { name: stream.streamName ?? "", host, token, photos: normalisePhotos(stream) };
}

/** Short-lived download links for the given photos, keyed by photo id. Asked for per run: they expire. */
export async function photoUrls(album, photos, fetchImpl = fetch) {
  const urls = new Map();
  for (let i = 0; i < photos.length; i += 25) {
    const batch = photos.slice(i, i + 25);
    const response = await post(album.host, album.token, "webasseturls", { photoGuids: batch.map((p) => p.id) }, fetchImpl);
    if (!response.ok) throw new Error(`iCloud webasseturls answered ${response.status}`);
    const { items = {} } = await response.json();
    for (const photo of batch) {
      const item = items[photo.best.checksum];
      // Only ever Apple's own content hosts: the address comes out of a response, so it is checked.
      if (item && /^[a-z0-9.-]+\.(icloud-content\.com|icloud\.com)$/.test(item.url_location ?? "")) {
        urls.set(photo.id, `https://${item.url_location}${item.url_path}`);
      }
    }
  }
  return urls;
}
