/**
 * The confirmation mail a guest gets when staff accept their table.
 *
 * This is the one piece of copy that leaves the site and cannot be corrected afterwards, and it is
 * built by interpolating guest input into an HTML string. Two things are therefore pinned here: the
 * guest's own text is escaped on the way into the HTML (and *not* escaped in the plain-text part,
 * where entities would be read out literally), and the management link, which is what makes a guest
 * give a seat back instead of not turning up, is present exactly when there is a token for it.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { reservationConfirmedMail } from "@/lib/mail-templates";
import { CONTACT } from "@/lib/contact";
import { manageUrl } from "@/lib/site";
import { LOCALES } from "@/lib/i18n";

const booking = {
  name: "María",
  date: "2026-10-23",
  time: "19:30",
  partySize: 2,
  manageToken: "tok_abcdef0123456789",
  locale: "de" as const,
};

describe("reservationConfirmedMail", () => {
  test("has a subject, an HTML body and a plain-text part in every language", () => {
    for (const locale of LOCALES) {
      const mail = reservationConfirmedMail({ ...booking, locale });
      assert.ok(mail.subject.trim().length > 0, `${locale}: no subject`);
      assert.ok(mail.html.includes("<!doctype html>"), `${locale}: no HTML document`);
      assert.ok(mail.text.trim().length > 0, `${locale}: no text part`);
    }
  });

  test("names the shop and the time in the subject, so an inbox preview is enough", () => {
    const mail = reservationConfirmedMail(booking);
    assert.match(mail.subject, /La Cordobesa/);
    assert.match(mail.subject, /19:30/);
  });

  test("writes the three languages differently, so a guest is answered in their own", () => {
    const subjects = LOCALES.map((locale) => reservationConfirmedMail({ ...booking, locale }).subject);
    assert.equal(new Set(subjects).size, LOCALES.length, "two locales share a subject line");
    assert.match(reservationConfirmedMail({ ...booking, locale: "de" }).subject, /Dein Tisch/);
    assert.match(reservationConfirmedMail({ ...booking, locale: "es" }).subject, /Tu mesa/);
    assert.match(reservationConfirmedMail({ ...booking, locale: "en" }).subject, /Your table/);
  });

  test("declares the guest's language on the document, for a screen reader in a mail client", () => {
    for (const locale of LOCALES) {
      assert.ok(reservationConfirmedMail({ ...booking, locale }).html.includes(`<html lang="${locale}">`), locale);
    }
  });

  test("counts one person and several people correctly", () => {
    assert.match(reservationConfirmedMail({ ...booking, partySize: 1 }).text, /1 Person\b/);
    assert.match(reservationConfirmedMail({ ...booking, partySize: 4 }).text, /4 Personen/);
    assert.match(reservationConfirmedMail({ ...booking, partySize: 1, locale: "es" }).text, /1 persona\b/);
    assert.match(reservationConfirmedMail({ ...booking, partySize: 3, locale: "es" }).text, /3 personas/);
    assert.match(reservationConfirmedMail({ ...booking, partySize: 1, locale: "en" }).text, /1 person\b/);
    assert.match(reservationConfirmedMail({ ...booking, partySize: 3, locale: "en" }).text, /3 people/);
  });

  test("escapes the guest's name in the HTML body", () => {
    const mail = reservationConfirmedMail({ ...booking, name: '<script>alert("x")</script>' });
    assert.ok(!mail.html.includes("<script"), "a guest's name can inject markup into the mail");
    assert.ok(mail.html.includes("&lt;script&gt;"), "the name should appear escaped");
  });

  test("leaves the name unescaped in the plain-text part, where an entity would be read out", () => {
    const mail = reservationConfirmedMail({ ...booking, name: "Mark & Ana" });
    assert.ok(mail.text.includes("Mark & Ana"), "the text part should carry the characters, not entities");
    assert.ok(!mail.text.includes("&amp;"), "an HTML entity leaked into the plain-text part");
  });

  test("carries the management link in both parts when there is a token", () => {
    const mail = reservationConfirmedMail(booking);
    const link = manageUrl(booking.manageToken, "de");
    assert.ok(mail.html.includes(link), "the HTML body has no management link");
    assert.ok(mail.text.includes(link), "the text part has no management link");
    assert.match(mail.html, /Reservierung ändern oder absagen/);
  });

  test("links to the guest's own language", () => {
    for (const locale of LOCALES) {
      const mail = reservationConfirmedMail({ ...booking, locale });
      assert.ok(mail.text.includes(manageUrl(booking.manageToken, locale)), `${locale}: wrong link locale`);
    }
  });

  test("says nothing about changing the booking when there is no token", () => {
    const mail = reservationConfirmedMail({ ...booking, manageToken: null });
    assert.ok(!mail.html.includes("<a href=\"http"), "a link appeared without a token");
    assert.ok(!mail.text.includes("http"), "a URL appeared in the text part without a token");
    assert.ok(!mail.html.includes("Reservierung ändern"), "the button is there with nothing behind it");
    // The confirmation itself still has to arrive.
    assert.match(mail.text, /19:30/);
  });

  test("gives the guest the address and a phone number to call", () => {
    const mail = reservationConfirmedMail(booking);
    for (const part of [mail.html, mail.text]) {
      assert.ok(part.includes(CONTACT.street), "no street address");
      assert.ok(part.includes(CONTACT.city), "no city");
      assert.ok(part.includes(CONTACT.phoneDisplay), "no phone number");
    }
    assert.ok(mail.html.includes(`tel:${CONTACT.phoneE164}`), "the phone number is not tappable");
  });

  test("sends replies to the inbox the team already reads", () => {
    assert.equal(reservationConfirmedMail(booking).replyTo, CONTACT.email);
  });

  test("uses no images and no web fonts, which is what survives Outlook", () => {
    const mail = reservationConfirmedMail(booking);
    assert.ok(!/<img\b/i.test(mail.html), "an image will be blocked by default and leave a hole");
    assert.ok(!/<style\b/i.test(mail.html), "a <style> block is dropped by several clients");
    assert.ok(!/@font-face|fonts\.googleapis/i.test(mail.html), "a web font will not load");
    assert.ok(!mail.html.includes("var(--"), "a CSS variable means nothing in a mail client");
  });
});
