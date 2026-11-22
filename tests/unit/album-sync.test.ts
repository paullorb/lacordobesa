/**
 * The shared-album import: the album reader, the caption rules and the endpoint's token check.
 *
 * The reader talks to an undocumented Apple endpoint, so what it does with a response is pinned
 * here against a stubbed `fetch`; nothing leaves the machine and no album is needed. The branding
 * test runs sharp for real on one of the staged photos, because "the location is gone and the
 * venue's name is in" is the whole promise of that step.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { parseAlbumCaption, syncAuthorized, isSourceId, isJpeg } from "@/lib/album-sync";
import { albumToken, albumHost, bestDerivative, normalisePhotos, readAlbum, photoUrls } from "../../scripts/lib/icloud-album.mjs";
import { brandPhoto } from "../../scripts/lib/brand-photo.mjs";

const TOKEN = "B0z5qAGN1JIFd3y";

describe("album link", () => {
  test("the token is taken from the share link, or accepted bare", () => {
    assert.equal(albumToken(`https://www.icloud.com/sharedalbum/#${TOKEN}`), TOKEN);
    assert.equal(albumToken(`https://www.icloud.com/sharedalbum/de-de/#${TOKEN}`), TOKEN);
    assert.equal(albumToken(TOKEN), TOKEN);
    assert.throws(() => albumToken("https://www.icloud.com/photos/"));
    assert.throws(() => albumToken(""));
  });

  test("the host shard is read out of the token", () => {
    // "0z" in base 62 is 61; an "A" token carries a one-character shard.
    assert.equal(albumHost(TOKEN), "p61-sharedstreams.icloud.com");
    assert.equal(albumHost("A5abcdefghijkl"), "p05-sharedstreams.icloud.com");
  });
});

const stream = {
  streamName: "La Cordobesa Web",
  photos: [
    { photoGuid: "NEW", caption: " Torta Rogel #comida ", dateCreated: "2026-11-20T10:00:00Z", derivatives: { "342": { checksum: "small", width: "342", height: "256", fileSize: "30000" }, "2049": { checksum: "big", width: "2049", height: "1536", fileSize: "900000" } } },
    { photoGuid: "OLD", dateCreated: "2026-11-01T10:00:00Z", derivatives: { "2049": { checksum: "old", width: "2049", height: "1536", fileSize: "1" } } },
    { photoGuid: "VID", mediaAssetType: "video", dateCreated: "2026-11-02T10:00:00Z", derivatives: { PosterFrame: { checksum: "poster", width: "1280", height: "720", fileSize: "1" }, "720p": { checksum: "v", width: "1280", height: "720", fileSize: "1" } } },
  ],
};

describe("album contents", () => {
  test("stills only, oldest first, each with its largest derivative", () => {
    const photos = normalisePhotos(stream);
    assert.deepEqual(photos.map((p: { id: string }) => p.id), ["OLD", "NEW"]);
    assert.equal(photos[1].best.checksum, "big");
    assert.equal(photos[1].caption, "Torta Rogel #comida");
    assert.equal(bestDerivative({ derivatives: { PosterFrame: { checksum: "x" } } }), undefined);
  });

  test("follows Apple's 330 to the right shard, and only to an Apple host", async () => {
    const calls: string[] = [];
    const fetchStub = async (url: unknown) => {
      calls.push(String(url));
      if (calls.length === 1) return new Response(JSON.stringify({ "X-Apple-MMe-Host": "p123-sharedstreams.icloud.com" }), { status: 330 });
      return Response.json(stream);
    };
    const album = await readAlbum(TOKEN, fetchStub);
    assert.equal(album.host, "p123-sharedstreams.icloud.com");
    assert.match(calls[1], /^https:\/\/p123-sharedstreams\.icloud\.com\/B0z5qAGN1JIFd3y\/sharedstreams\/webstream$/);
    assert.equal(album.photos.length, 2);

    const evil = async () => new Response(JSON.stringify({ "X-Apple-MMe-Host": "evil.example" }), { status: 330 });
    await assert.rejects(readAlbum(TOKEN, evil), /unexpected host/);
  });

  test("a switched-off album and a changed format are errors, not an empty album", async () => {
    await assert.rejects(readAlbum(TOKEN, async () => new Response(null, { status: 404 })), /Public Website/);
    await assert.rejects(readAlbum(TOKEN, async () => Response.json({ something: "else" })), /format/);
  });

  test("download links are matched by checksum and refused off Apple's hosts", async () => {
    const album = { host: "p61-sharedstreams.icloud.com", token: TOKEN };
    const photos = normalisePhotos(stream);
    const items = {
      big: { url_location: "cvws.icloud-content.com", url_path: "/S/abc?o=1" },
      old: { url_location: "attacker.example", url_path: "/x" },
    };
    const urls = await photoUrls(album, photos, async () => Response.json({ items }));
    assert.equal(urls.get("NEW"), "https://cvws.icloud-content.com/S/abc?o=1");
    assert.equal(urls.has("OLD"), false);
  });
});

describe("captions", () => {
  test("a known hashtag files the photo and is removed from the caption", () => {
    assert.deepEqual(parseAlbumCaption("Torta Rogel #comida"), { caption: "Torta Rogel", category: "food" });
    assert.deepEqual(parseAlbumCaption("#Lokal Unser Tresen"), { caption: "Unser Tresen", category: "venue" });
    assert.deepEqual(parseAlbumCaption("Cumple de Sofi #evento #comida"), { caption: "Cumple de Sofi", category: "events" });
  });

  test("no tag means food; an unknown tag is the owners' text and stays", () => {
    assert.deepEqual(parseAlbumCaption("Medialunas #recienhorneadas"), { caption: "Medialunas #recienhorneadas", category: "food" });
    assert.deepEqual(parseAlbumCaption(""), { caption: null, category: "food" });
    assert.deepEqual(parseAlbumCaption(undefined), { caption: null, category: "food" });
    assert.equal(parseAlbumCaption("x".repeat(400)).caption?.length, 160);
  });
});

describe("endpoint guards", () => {
  const token = "t".repeat(40);
  test("only the exact bearer token, and never when the token is unset or short", () => {
    assert.equal(syncAuthorized(`Bearer ${token}`, token), true);
    assert.equal(syncAuthorized(`Bearer ${token}x`, token), false);
    assert.equal(syncAuthorized(token, token), false);
    assert.equal(syncAuthorized(null, token), false);
    assert.equal(syncAuthorized("Bearer ", ""), false);
    assert.equal(syncAuthorized("Bearer undefined", undefined), false);
    assert.equal(syncAuthorized("Bearer short", "short"), false);
  });

  test("source ids and the JPEG sniff", () => {
    assert.equal(isSourceId("0A1B2C3D-0000-4000-8000-ABCDEF012345"), true);
    assert.equal(isSourceId("../etc"), false);
    assert.equal(isSourceId(""), false);
    assert.equal(isJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), true);
    assert.equal(isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), false);
  });
});

describe("branding", () => {
  test("the output carries the venue's name and none of the camera's metadata", async () => {
    // A source with GPS and a device name in it, as a phone would write.
    // Generated rather than read from disk: the repo holds no stock photos to borrow.
    const source = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 230, g: 200, b: 160 } } })
      .withExif({ IFD0: { Make: "Apple", Model: "iPhone 17" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "50/1 8/1 0/1" } })
      .jpeg()
      .toBuffer();
    assert.match(source.toString("latin1"), /iPhone 17/);

    const out: Buffer = await brandPhoto(source, { siteUrl: "https://lacordobesa.vercel.app", caption: "Tarta <casera> & mate", year: 2026 });
    const meta = await sharp(out).metadata();
    assert.equal(meta.format, "jpeg");
    assert.equal(meta.width, 900);
    const raw = out.toString("latin1");
    assert.doesNotMatch(raw, /iPhone 17/);
    assert.doesNotMatch(raw, /GPSLatitude/);
    assert.match(raw, /© 2026 La Cordobesa|© 2026 La Cordobesa|2026 La Cordobesa/);
    const xmp = meta.xmp?.toString("utf8") ?? "";
    assert.match(xmp, /<rdf:li>La Cordobesa<\/rdf:li>/);
    assert.match(xmp, /xmpRights:WebStatement="https:\/\/lacordobesa\.vercel\.app"/);
    // The caption is escaped, so a "<" in it cannot break the packet.
    assert.match(xmp, /Tarta &#60;casera&#62; &#38; mate/);
  });
});
