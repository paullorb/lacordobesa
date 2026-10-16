/**
 * Sending transactional mail, and the escaping that guards the HTML body.
 *
 * `escapeHtml` is the only thing standing between a guest-supplied name and the mail body, which is
 * built by string interpolation (lib/mail-templates.ts). A guest called `<script>` is not the worry;
 * a name with an apostrophe silently breaking an attribute is, and so is a staff member seeing
 * "sent" when nothing was.
 *
 * `sendMail` is exercised against a stubbed `fetch`, so no mail leaves the machine and no API key is
 * needed. What is pinned is the shape of the request Resend gets and that every failure is reported
 * rather than swallowed.
 */
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, mailConfigured, sendMail } from "@/lib/mail";

const realFetch = globalThis.fetch;
const realKey = process.env.RESEND_API_KEY;
const realFrom = process.env.MAIL_FROM;

afterEach(() => {
  globalThis.fetch = realFetch;
  if (realKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = realKey;
  if (realFrom === undefined) delete process.env.MAIL_FROM;
  else process.env.MAIL_FROM = realFrom;
});

const configure = () => {
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.MAIL_FROM = "hola@lacordobesa.de";
};

const mail = {
  to: "guest@example.com",
  subject: "Dein Tisch",
  html: "<p>Hola</p>",
  text: "Hola",
};

describe("escapeHtml", () => {
  test("escapes the five characters that can break out of markup or an attribute", () => {
    assert.equal(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
  });

  test("escapes the ampersand first, so an entity is not double-escaped into nonsense", () => {
    // If < were replaced before &, "&lt;" would come back out as "&amp;lt;" and the guest would
    // read the entity instead of the character.
    assert.equal(escapeHtml("<"), "&lt;");
    assert.equal(escapeHtml("&lt;"), "&amp;lt;");
  });

  test("neutralises a script tag in a guest's name", () => {
    const escaped = escapeHtml('<script>alert("hola")</script>');
    assert.ok(!escaped.includes("<script"), "a tag survived into the mail body");
    assert.ok(!escaped.includes('"'), "a quote survived, which can break out of an attribute");
  });

  test("leaves ordinary text, accents and emoji alone", () => {
    for (const value of ["María Fernández", "Grüße aus Córdoba", "empanadas 🥟", ""]) {
      assert.equal(escapeHtml(value), value);
    }
  });

  test("escapes every occurrence, not just the first", () => {
    assert.equal(escapeHtml("a<b<c"), "a&lt;b&lt;c");
  });
});

describe("mailConfigured", () => {
  test("is false unless both the key and the sender are set", () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.MAIL_FROM;
    assert.equal(mailConfigured(), false);

    process.env.RESEND_API_KEY = "re_test_key";
    assert.equal(mailConfigured(), false, "a key with no sender address is not configured");

    delete process.env.RESEND_API_KEY;
    process.env.MAIL_FROM = "hola@lacordobesa.de";
    assert.equal(mailConfigured(), false, "a sender address with no key is not configured");

    configure();
    assert.equal(mailConfigured(), true);
  });

  test("an empty string is not a credential", () => {
    process.env.RESEND_API_KEY = "";
    process.env.MAIL_FROM = "";
    assert.equal(mailConfigured(), false);
  });
});

describe("sendMail", () => {
  test("says not_configured instead of throwing on a checkout with no credentials", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.MAIL_FROM;
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("", { status: 200 });
    }) as typeof fetch;

    assert.deepEqual(await sendMail(mail), { ok: false, reason: "not_configured" });
    assert.equal(called, false, "it called the API without credentials");
  });

  test("posts the mail to Resend with the key as a bearer token", async () => {
    configure();
    let seen: { url: string; init: RequestInit } | null = null;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    assert.deepEqual(await sendMail({ ...mail, replyTo: "hola@lacordobesa.de" }), { ok: true });
    assert.equal(seen!.url, "https://api.resend.com/emails");
    assert.equal(seen!.init.method, "POST");
    const headers = seen!.init.headers as Record<string, string>;
    assert.equal(headers.authorization, "Bearer re_test_key");
    assert.equal(headers["content-type"], "application/json");

    const body = JSON.parse(String(seen!.init.body));
    assert.deepEqual(body.to, ["guest@example.com"], "to has to be an array for Resend");
    assert.equal(body.from, "hola@lacordobesa.de");
    assert.equal(body.subject, "Dein Tisch");
    // snake_case: the REST API's name, not the camelCase one the Mail type uses.
    assert.equal(body.reply_to, "hola@lacordobesa.de");
    assert.ok(body.text, "a mail with no text part scores worse with spam filters");
  });

  test("leaves reply_to out when there is none, rather than sending undefined", async () => {
    configure();
    let body: Record<string, unknown> = {};
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    await sendMail(mail);
    assert.ok(!("reply_to" in body), "reply_to was sent as undefined");
  });

  test("reports the provider's own reason, because the status alone does not say why", async () => {
    configure();
    globalThis.fetch = (async () =>
      new Response('{"message":"The lacordobesa.de domain is not verified"}', { status: 403 })) as typeof fetch;

    const result = await sendMail(mail);
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, "failed");
    assert.match(String(result.ok === false && result.detail), /403/);
    assert.match(String(result.ok === false && result.detail), /not verified/);
  });

  test("trims a long provider response rather than storing all of it", async () => {
    configure();
    globalThis.fetch = (async () => new Response("x".repeat(1000), { status: 500 })) as typeof fetch;

    const result = await sendMail(mail);
    assert.equal(result.ok, false);
    assert.ok(result.ok === false && (result.detail ?? "").length <= 300, "the detail was not capped");
  });

  test("turns a network failure into a result, so a staff click never throws", async () => {
    configure();
    globalThis.fetch = (async () => {
      throw new Error("getaddrinfo ENOTFOUND api.resend.com");
    }) as typeof fetch;

    assert.deepEqual(await sendMail(mail), {
      ok: false,
      reason: "failed",
      detail: "getaddrinfo ENOTFOUND api.resend.com",
    });
  });

  test("survives a thrown non-Error", async () => {
    configure();
    globalThis.fetch = (async () => {
      throw "nope";
    }) as typeof fetch;

    assert.deepEqual(await sendMail(mail), { ok: false, reason: "failed", detail: "unknown error" });
  });
});
