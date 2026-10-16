/**
 * The `metadata` export every public page builds from.
 *
 * Two rules are easy to get wrong and invisible when you do. The home page opts out of the root
 * layout's "%s · La Cordobesa" template, because every home title already opens with the name and
 * /es would otherwise read "La Cordobesa · … · La Cordobesa". And a token page is a credential in a
 * URL: it must be noindex and must send no referrer, or the token walks out in the Referer header
 * of the first outbound click.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { pageMetadata, tokenPageMetadata } from "@/lib/page-metadata";
import { alternates, localeHref, LOCALES, OG_LOCALE } from "@/lib/i18n";
import { OG_IMAGE } from "@/lib/site";

const menuPage = (d: { menuPage: { title: string; description: string } }) => d.menuPage;

describe("pageMetadata", () => {
  test("takes the title and description out of the locale's dictionary", () => {
    for (const locale of LOCALES) {
      const meta = pageMetadata(locale, "/karte", menuPage);
      assert.ok(String(meta.title).length > 0, `${locale}: no title`);
      assert.ok(String(meta.description).length > 0, `${locale}: no description`);
    }
  });

  test("writes a different title per language, so the fallback would show up", () => {
    const titles = LOCALES.map((locale) => String(pageMetadata(locale, "/karte", menuPage).title));
    assert.equal(new Set(titles).size, LOCALES.length, "two locales share a title");
  });

  test("the home page opts out of the title template", () => {
    const meta = pageMetadata("de", "/", (d) => d.home);
    assert.deepEqual(meta.title, { absolute: (meta.title as { absolute: string }).absolute });
    assert.ok((meta.title as { absolute: string }).absolute.includes("La Cordobesa"), "the home title should name the shop");
  });

  test("every other page keeps the template, so it is a plain string", () => {
    assert.equal(typeof pageMetadata("de", "/karte", menuPage).title, "string");
  });

  test("each locale's page is canonical for itself", () => {
    for (const locale of LOCALES) {
      const meta = pageMetadata(locale, "/karte", menuPage);
      assert.equal(meta.alternates?.canonical, localeHref(locale, "/karte"));
    }
  });

  test("declares the other languages of the same page, which is what hreflang is for", () => {
    const meta = pageMetadata("de", "/karte", menuPage);
    assert.deepEqual(meta.alternates?.languages, alternates("/karte"));
    const languages = Object.keys(meta.alternates?.languages ?? {});
    for (const locale of LOCALES) {
      assert.ok(
        languages.some((l) => l === locale || l.startsWith(`${locale}-`) || l === "x-default"),
        `${locale} is not among the alternates: ${languages.join(", ")}`,
      );
    }
  });

  test("gives the social card an image and the right og:locale", () => {
    for (const locale of LOCALES) {
      const meta = pageMetadata(locale, "/karte", menuPage);
      assert.equal(meta.openGraph?.locale, OG_LOCALE[locale]);
      assert.deepEqual(meta.openGraph?.images, [OG_IMAGE]);
      // `type` is only on some members of Next's OpenGraph union, so it is read off the value
      // rather than the type.
      assert.equal((meta.openGraph as { type?: string } | undefined)?.type, "website");
    }
  });
});

describe("tokenPageMetadata", () => {
  test("is noindex and nofollow, because the URL is the credential", () => {
    const meta = tokenPageMetadata("de", (d) => d.manage.title);
    assert.deepEqual(meta.robots, { index: false, follow: false });
  });

  test("sends no referrer, so the token does not leak on the first outbound click", () => {
    assert.equal(tokenPageMetadata("de", (d) => d.manage.title).referrer, "no-referrer");
  });

  test("has no alternates, since there is nothing for a crawler to compare", () => {
    assert.equal(tokenPageMetadata("de", (d) => d.manage.title).alternates, undefined);
  });

  test("still gets its title from the guest's own language", () => {
    const titles = LOCALES.map((locale) => String(tokenPageMetadata(locale, (d) => d.manage.title).title));
    for (const title of titles) assert.ok(title.length > 0);
    assert.equal(new Set(titles).size, LOCALES.length, "two locales share a token-page title");
  });
});
