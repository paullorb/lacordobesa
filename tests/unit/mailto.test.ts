import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mailtoHref } from "@/lib/mailto";

describe("mailtoHref", () => {
  test("leaves an ordinary address readable", () => {
    assert.equal(mailtoHref("anna@example.de"), "mailto:anna@example.de");
  });

  test("keeps header injection characters inside the recipient", () => {
    const href = mailtoHref("a@b.de?bcc=evil@x.com&body=hi");
    assert.equal(href, "mailto:a@b.de%3Fbcc%3Devil@x.com%26body%3Dhi");
    assert.equal(href.includes("?"), false);
    assert.equal(href.includes("&"), false);
  });

  test("encodes percent signs and spaces", () => {
    assert.equal(mailtoHref("a%0Ab@x.de"), "mailto:a%250Ab@x.de");
    assert.equal(mailtoHref("a b@x.de"), "mailto:a%20b@x.de");
  });

  test("appends encoded parameters after one question mark", () => {
    assert.equal(mailtoHref("a@b.de", { subject: "Hi & bye", body: "x y" }), "mailto:a@b.de?subject=Hi%20%26%20bye&body=x%20y");
  });
});
