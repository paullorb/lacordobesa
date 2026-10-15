/** The ingest's two guards. Both exist because of what a hostile sender can do to a public endpoint:
 *  mint unlimited counter rows through the referrer, and make the server hold on to addresses. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { allow, OTHER_REFERRER, referrerHost, trackedAddresses } from "@/lib/analytics-server";

describe("referrerHost", () => {
  const own = "lacordobesa.example";

  test("no referrer, this site and non-web schemes are all the direct visit", () => {
    assert.equal(referrerHost(undefined, own), "");
    assert.equal(referrerHost("", own), "");
    assert.equal(referrerHost("https://lacordobesa.example/karte", own), "");
    assert.equal(referrerHost("https://www.lacordobesa.example/", own), "");
    assert.equal(referrerHost("android-app://com.google.android.gm", own), "");
    assert.equal(referrerHost("not a url", own), "");
  });

  test("known referrers collapse to one host each", () => {
    assert.equal(referrerHost("https://www.google.de/search?q=x", own), "google.com");
    assert.equal(referrerHost("https://www.google.co.uk/", own), "google.com");
    assert.equal(referrerHost("https://l.instagram.com/?u=abc", own), "instagram.com");
    assert.equal(referrerHost("https://m.facebook.com/", own), "facebook.com");
    assert.equal(referrerHost("https://www.tripadvisor.de/Restaurant", own), "tripadvisor.com");
    assert.equal(referrerHost("https://t.co/abc", own), "x.com");
  });

  test("anything else is one bucket, however many hosts a sender invents", () => {
    const hosts = new Set<string>();
    for (let i = 0; i < 500; i++) hosts.add(referrerHost(`https://spam-${i}.example.net/`, own));
    assert.deepEqual([...hosts], [OTHER_REFERRER]);
  });

  test("a lookalike does not borrow a known name", () => {
    assert.equal(referrerHost("https://notgoogle.com/", own), OTHER_REFERRER);
    assert.equal(referrerHost("https://google.com.evil.example/", own), OTHER_REFERRER);
    assert.equal(referrerHost("https://instagram.com.evil.example/", own), OTHER_REFERRER);
  });
});

describe("allow", () => {
  const T0 = 2_000_000_000_000;

  test("lets 60 through per minute and then refuses, and a new minute starts clean", () => {
    for (let i = 0; i < 60; i++) assert.equal(allow("10.0.0.1", T0), true, `hit ${i + 1}`);
    assert.equal(allow("10.0.0.1", T0 + 1000), false);
    assert.equal(allow("10.0.0.1", T0 + 60_000), true);
  });

  test("a batch counts as the events it carries, and does not fit in parts", () => {
    const base = T0 + 5_000_000;
    assert.equal(allow("10.0.2.1", base, 50), true);
    assert.equal(allow("10.0.2.1", base + 1000, 11), false, "61 would be over the limit");
    assert.equal(allow("10.0.2.1", base + 2000, 1), false, "a refused address stays refused for its minute");
    assert.equal(allow("10.0.2.2", base, 61), false, "a first batch over the limit is refused outright");
    assert.equal(allow("10.0.2.3", base, 60), true);
  });

  test("an address is forgotten once its minute is over, with no traffic from anyone else needed to trigger it", () => {
    const base = T0 + 10_000_000;
    allow("10.0.1.1", base);
    allow("10.0.1.2", base + 1000);
    assert.ok(trackedAddresses() >= 2);
    // A single unrelated request after the window is what runs the sweep here (the real server also
    // has a timer); far fewer than 5000 addresses are held, so the old size threshold never fired.
    allow("10.0.1.3", base + 61_000 + 1000);
    // .1 and .2 expired; only .3 (and none of the earlier tests' keys, which are older still) remain.
    assert.equal(trackedAddresses(), 1);
  });

  test("a flood of distinct addresses is capped", () => {
    const base = T0 + 20_000_000;
    for (let i = 0; i < 6000; i++) allow(`flood-${i}`, base + i);
    assert.ok(trackedAddresses() <= 5000, `held ${trackedAddresses()}`);
    // The newest are the ones kept.
    assert.equal(allow("flood-5999", base + 6000), true);
  });
});
