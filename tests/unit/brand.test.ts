/** The logo, favicon and home-screen icons. These are files in `public/` that a logo swap
 *  regenerates (`npm run icons`), so the risk is a name in `lib/brand.ts` with nothing behind it,
 *  or a manifest whose start page lies outside its own scope, which a browser drops silently. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { APPS, BRAND_FILES, webManifest } from "@/lib/brand";

const PUBLIC = path.join(process.cwd(), "public");

/** Reads width and height from a PNG's IHDR chunk. */
function pngSize(file: string) {
  const buf = readFileSync(path.join(PUBLIC, file));
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf.readUInt8(25) };
}

describe("brand files", () => {
  test("every file named in lib/brand.ts exists under public/", () => {
    for (const file of BRAND_FILES) assert.ok(existsSync(path.join(PUBLIC, file)), `${file} is missing, run npm run icons`);
  });

  test("the home-screen icons are opaque squares, so iOS has nothing to fill in black", () => {
    for (const app of Object.values(APPS)) {
      const { width, height, colorType } = pngSize(app.appleIcon);
      assert.equal(width, 180);
      assert.equal(height, 180);
      assert.equal(colorType, 2, `${app.appleIcon} has an alpha channel`);
    }
  });

  test("favicon.ico is an icon file with at least a 16 and a 32 px image", () => {
    const ico = readFileSync(path.join(PUBLIC, "favicon.ico"));
    assert.equal(ico.readUInt16LE(0), 0);
    assert.equal(ico.readUInt16LE(2), 1);
    const sizes = Array.from({ length: ico.readUInt16LE(4) }, (_, i) => ico.readUInt8(6 + 16 * i));
    assert.ok(sizes.includes(16) && sizes.includes(32), `sizes: ${sizes}`);
  });
});

describe("web app manifests", () => {
  for (const [key, app] of Object.entries(APPS)) {
    const manifest = webManifest(app);

    test(`${key}: the start page is inside the scope`, () => {
      assert.ok(manifest.start_url.startsWith(manifest.scope));
    });

    test(`${key}: icons exist at the size they claim, with a maskable one`, () => {
      for (const icon of manifest.icons) {
        const { width, height } = pngSize(icon.src);
        assert.equal(`${width}x${height}`, icon.sizes, icon.src);
      }
      assert.ok(manifest.icons.some((i) => i.purpose === "maskable"));
      assert.ok(manifest.icons.some((i) => i.sizes === "192x192"));
      assert.ok(manifest.icons.some((i) => i.sizes === "512x512" && i.purpose === "any"));
    });
  }

  test("the staff app is a different app from the public site", () => {
    assert.notEqual(APPS.staff.id, APPS.public.id);
    assert.notEqual(APPS.staff.name, APPS.public.name);
    assert.notEqual(APPS.staff.appleIcon, APPS.public.appleIcon);
  });

  test("the staff manifest sits outside /staff, which the session proxy guards", () => {
    assert.ok(!APPS.staff.path.startsWith("/staff/"));
  });

  test("no dash in the German copy", () => {
    for (const app of Object.values(APPS)) assert.doesNotMatch(`${app.name}${app.description}`, /[—–]/);
  });
});
