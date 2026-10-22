/**
 * "Add to Home Screen" and the tab icon, as far as a test can see them.
 *
 * What this cannot check is Safari itself: whether the share sheet offers the button, and what the
 * tile looks like, needs a real iPhone. What it pins is everything Safari reads to decide: each
 * page links the right manifest, the manifest is reachable without a session (a browser fetches it
 * without cookies), and every icon the page and the manifest name actually loads as an image.
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { BASE, closeBrowser, serverIsUp, visit } from "./harness.mjs";

const up = await serverIsUp();
const skip = up ? false : `no site at ${BASE}, run npm run dev`;
after(closeBrowser);

const head = (page) =>
  page.evaluate(() => ({
    manifest: document.querySelector("link[rel=manifest]")?.getAttribute("href"),
    appleTouch: document.querySelector("link[rel=apple-touch-icon]")?.getAttribute("href"),
    appTitle: document.querySelector("meta[name=apple-mobile-web-app-title]")?.getAttribute("content"),
    icons: [...document.querySelectorAll("link[rel=icon]")].map((l) => l.getAttribute("href")),
  }));

async function assertImage(path) {
  const response = await fetch(BASE + path);
  assert.equal(response.status, 200, `${path} answered ${response.status}`);
  assert.match(response.headers.get("content-type") ?? "", /^image\//, path);
}

describe("installing the site", () => {
  for (const [name, path, manifest, title] of [
    ["the home page", "/", "/manifest.webmanifest", "La Cordobesa"],
    ["a Spanish page", "/es/karte", "/manifest.webmanifest", "La Cordobesa"],
    ["an English page", "/en/karte", "/manifest.webmanifest", "La Cordobesa"],
    ["the staff login", "/staff/login", "/staff.webmanifest", "Cordobesa Equipo"],
  ]) {
    test(`${name} links its manifest, a home-screen icon and a tab icon`, { skip }, async () => {
      await visit(path, {
        body: async ({ page }) => {
          const h = await head(page);
          assert.equal(h.manifest, manifest);
          assert.equal(h.appTitle, title);
          assert.ok(h.icons.includes("/favicon.ico"), `no /favicon.ico in ${h.icons}`);
          await assertImage(h.appleTouch);
          for (const icon of h.icons) await assertImage(icon);
        },
      });
    });
  }

  test("both manifests load without a session and every icon in them loads", { skip }, async () => {
    for (const manifestPath of ["/manifest.webmanifest", "/staff.webmanifest"]) {
      const response = await fetch(BASE + manifestPath, { redirect: "manual" });
      assert.equal(response.status, 200, `${manifestPath} answered ${response.status}`);
      const manifest = await response.json();
      assert.ok(manifest.start_url.startsWith(manifest.scope));
      for (const icon of manifest.icons) await assertImage(icon.src);
    }
  });

  test("the staff app and the public site do not share an identity", { skip }, async () => {
    const [pub, staff] = await Promise.all(
      ["/manifest.webmanifest", "/staff.webmanifest"].map((p) => fetch(BASE + p).then((r) => r.json())),
    );
    assert.notEqual(pub.id, staff.id);
    assert.equal(staff.scope, "/staff");
    assert.equal(pub.scope, "/");
  });
});
