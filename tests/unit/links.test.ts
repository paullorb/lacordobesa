/** Links that leave the site: guest management URLs, WhatsApp, the token shapes behind them.
 *  Every one of these is handed to a guest, so a wrong host or a mangled number is not cosmetic. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isManageToken, manageUrl, OG_IMAGE, preorderUrl, SITE_URL, unsubscribeUrl } from "@/lib/site";
import { CONTACT, waNumber, whatsappHref, whatsappTo } from "@/lib/contact";
import { staffDisplayName, staffEmail, STAFF_EMAIL_DOMAIN } from "@/lib/staff";

const TOKEN = "a".repeat(36);

describe("SITE_URL", () => {
  test("is an absolute URL with no trailing slash", () => {
    assert.doesNotThrow(() => new URL(SITE_URL));
    assert.doesNotMatch(SITE_URL, /\/$/);
  });
});

describe("guest links", () => {
  test("German links keep the unprefixed paths", () => {
    assert.equal(manageUrl(TOKEN), `${SITE_URL}/reservierung/${TOKEN}`);
    assert.equal(preorderUrl(TOKEN), `${SITE_URL}/vorbestellung/${TOKEN}`);
  });

  test("a Spanish guest gets the Spanish page", () => {
    assert.equal(manageUrl(TOKEN, "es"), `${SITE_URL}/es/reservierung/${TOKEN}`);
    assert.equal(preorderUrl(TOKEN, "es"), `${SITE_URL}/es/vorbestellung/${TOKEN}`);
    assert.equal(manageUrl(TOKEN, "en"), `${SITE_URL}/en/reservierung/${TOKEN}`);
    assert.equal(preorderUrl(TOKEN, "en"), `${SITE_URL}/en/vorbestellung/${TOKEN}`);
  });

  test("unsubscribe is language-neutral", () => {
    assert.equal(unsubscribeUrl(TOKEN), `${SITE_URL}/abmelden/${TOKEN}`);
  });

  test("all of them parse as URLs", () => {
    for (const url of [manageUrl(TOKEN), manageUrl(TOKEN, "es"), manageUrl(TOKEN, "en"), preorderUrl(TOKEN), unsubscribeUrl(TOKEN)]) {
      assert.doesNotThrow(() => new URL(url), url);
    }
  });
});

describe("isManageToken", () => {
  test("accepts 18 random bytes as hex", () => {
    assert.ok(isManageToken("0123456789abcdef0123456789abcdef0123"));
    assert.ok(isManageToken(TOKEN));
  });

  test("rejects anything else, before it reaches the RPC", () => {
    for (const bad of ["", "a".repeat(35), "a".repeat(37), "A".repeat(36), `${"a".repeat(35)}!`, "../../etc/passwd"]) {
      assert.equal(isManageToken(bad), false, `${bad} should not be a token`);
    }
  });
});

describe("waNumber", () => {
  test("strips the plus from an international number", () => {
    assert.equal(waNumber("+49 152 28087941"), "4915228087941");
  });

  test("treats 00 as the international prefix", () => {
    assert.equal(waNumber("0049 152 28087941"), "4915228087941");
  });

  test("expands a single leading zero to the German country code", () => {
    assert.equal(waNumber("0170 1234567"), "491701234567");
  });

  test("leaves a bare number alone", () => {
    assert.equal(waNumber("4915228087941"), "4915228087941");
  });

  test("drops the punctuation people type off a phone screen", () => {
    assert.equal(waNumber("+49 (0)170 / 123-4567"), "4901701234567");
    assert.equal(waNumber("0170-123 456 7"), "491701234567");
  });
});

describe("whatsapp links", () => {
  test("whatsappHref points at the shop", () => {
    assert.equal(whatsappHref(), `https://wa.me/${CONTACT.phoneE164.slice(1)}`);
  });

  test("whatsappTo points at the guest", () => {
    assert.equal(whatsappTo("0170 1234567"), "https://wa.me/491701234567");
  });

  test("the prefilled message is encoded, so a newline or an & cannot break the URL", () => {
    const url = new URL(whatsappTo("0170 1234567", "Hallo & tschüss\nbis bald"));
    assert.equal(url.searchParams.get("text"), "Hallo & tschüss\nbis bald");
  });
});

describe("CONTACT", () => {
  test("the display number and the E.164 number are the same number", () => {
    assert.equal(CONTACT.phoneDisplay.replace(/\s/g, ""), CONTACT.phoneE164);
  });

  test("E.164 is a plus and digits", () => {
    assert.match(CONTACT.phoneE164, /^\+\d{8,15}$/);
  });

  test("the address carries a German postcode", () => {
    assert.match(CONTACT.city, /^\d{5}\s/);
  });

  test("the outward links are absolute", () => {
    for (const url of [CONTACT.instagram, CONTACT.mapsUrl]) assert.doesNotThrow(() => new URL(url), url);
  });
});

describe("OG_IMAGE", () => {
  test("is a 2:1 picture, the shape link previews crop to", () => {
    assert.equal(OG_IMAGE.width / OG_IMAGE.height, 2);
  });
});

describe("staff names", () => {
  test("a short name becomes the synthetic address", () => {
    assert.equal(staffEmail("maria"), `maria@${STAFF_EMAIL_DOMAIN}`);
  });

  test("case and stray spaces do not make a second account", () => {
    assert.equal(staffEmail("  Maria "), `maria@${STAFF_EMAIL_DOMAIN}`);
    assert.equal(staffEmail("MARIA"), staffEmail("maria"));
  });

  test("a real address is left as it is", () => {
    assert.equal(staffEmail("paul@example.com"), "paul@example.com");
  });

  test("the display name is the round trip back", () => {
    assert.equal(staffDisplayName(staffEmail("maria")), "maria");
    assert.equal(staffDisplayName("paul@example.com"), "paul@example.com");
    assert.equal(staffDisplayName(undefined), "");
  });
});
