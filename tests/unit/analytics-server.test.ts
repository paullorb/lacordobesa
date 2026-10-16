/** The ingest's two guards. Both exist because of what a hostile sender can do to a public endpoint:
 *  mint unlimited counter rows through the referrer, and make the server hold on to addresses. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { allow, browserFamily, browserLanguage, isBot, OTHER_REFERRER, record, referrerHost, trackedAddresses } from "@/lib/analytics-server";

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

/**
 * The three user-agent readers. They decide what the numbers page shows, and they went in without
 * tests: a bot pattern that stops matching turns crawler traffic into visitors, and the in-app
 * browser buckets are the whole reason "people arrive from Instagram" is answerable.
 */
describe("isBot", () => {
  test("treats a missing user agent as a bot", () => {
    // A real browser always sends one; a script usually does not.
    assert.equal(isBot(null), true);
    assert.equal(isBot(""), true);
  });

  test("catches the crawlers and preview fetchers by name", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0)",
      "facebookexternalhit/1.1",
      "Twitterbot/1.0",
      "Slackbot-LinkExpanding 1.0",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120 Safari/537.36",
      "Chrome-Lighthouse",
      "Pingdom.com_bot_version_1.4",
      "curl/8.4.0",
      "python-requests/2.31.0",
      "node-fetch/1.0",
      "Go-http-client/2.0",
      "Java/17.0.1",
    ]) {
      assert.equal(isBot(ua), true, `${ua} should be a bot`);
    }
  });

  test("lets the browsers real guests use through", () => {
    for (const ua of [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
    ]) {
      assert.equal(isBot(ua), false, `${ua} is a real visitor`);
    }
  });

  test("records the previewers it does NOT catch, which is a real hole on this site", () => {
    // Not an endorsement: these are counted as visitors today. WhatsApp matters here, because the
    // shop's main channel is WhatsApp (lib/contact.ts) and every shared link makes WhatsApp fetch
    // the page once for its preview. Those fetches land in the pageview counters as browser
    // "other". Telegram and LinkedIn are the same shape. Adding "whatsapp|telegram|linkedin" to
    // BOT in lib/analytics-server.ts would close it; that is an owner decision about the numbers,
    // so this test only makes the hole visible and will fail the day somebody closes it.
    const uncaught = ["WhatsApp/2.2402.7 N", "TelegramBot (like TwitterBot)", "LinkedInBot/1.0"].filter((ua) => !isBot(ua));
    assert.deepEqual(uncaught, ["WhatsApp/2.2402.7 N"], "the set of previewers slipping through changed");
  });
});

describe("browserFamily", () => {
  test("gives the in-app browsers their own bucket, before the engine they are built on", () => {
    // Order matters: the Instagram and Facebook user agents also contain Chrome or Safari, so a
    // naive engine check first would hide exactly the arrival this shop wants to count.
    assert.equal(browserFamily("Mozilla/5.0 (iPhone) AppleWebKit Safari Instagram 302.0.0.23.113"), "instagram");
    assert.equal(browserFamily("Mozilla/5.0 (iPhone) AppleWebKit Safari [FBAN/FBIOS;FBAV/443.0]"), "facebook");
    assert.equal(browserFamily("Mozilla/5.0 (Linux; Android 14) Chrome/120.0 FB_IAB/FB4A"), "facebook");
  });

  test("tells the Chromium family apart in the order the user agents require", () => {
    // Edge, Opera and Samsung all claim Chrome; Chrome must be the last of them to be checked.
    assert.equal(browserFamily("Mozilla/5.0 Chrome/120.0 Safari/537.36 Edg/120.0"), "edge");
    assert.equal(browserFamily("Mozilla/5.0 (iPhone) EdgiOS/120.0 Mobile Safari"), "edge");
    assert.equal(browserFamily("Mozilla/5.0 Chrome/120.0 Safari/537.36 OPR/106.0"), "opera");
    assert.equal(browserFamily("Mozilla/5.0 (Linux; Android 14) SamsungBrowser/23.0 Chrome/115.0 Mobile Safari"), "samsung");
    assert.equal(browserFamily("Mozilla/5.0 Chrome/120.0 Safari/537.36"), "chrome");
    assert.equal(browserFamily("Mozilla/5.0 (iPhone) CriOS/120.0 Mobile Safari"), "chrome");
  });

  test("tells Firefox and Safari apart from Chrome", () => {
    assert.equal(browserFamily("Mozilla/5.0 (Windows NT 10.0) Gecko/20100101 Firefox/121.0"), "firefox");
    assert.equal(browserFamily("Mozilla/5.0 (iPhone) FxiOS/121.0 Mobile Safari"), "firefox");
    assert.equal(browserFamily("Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15"), "safari");
  });

  test("buckets anything it does not know rather than inventing a name", () => {
    assert.equal(browserFamily(""), "other");
    assert.equal(browserFamily("SomeNewBrowser/1.0"), "other");
  });
});

describe("browserLanguage", () => {
  test("reduces the header to the three languages the site has", () => {
    assert.equal(browserLanguage("de-DE,de;q=0.9,en;q=0.8"), "de");
    assert.equal(browserLanguage("es-AR,es;q=0.9"), "es");
    assert.equal(browserLanguage("en-GB,en;q=0.9"), "en");
  });

  test("takes the first preference, not the most specific one", () => {
    assert.equal(browserLanguage("fr-FR,de;q=0.9"), "other");
  });

  test("buckets a language the site does not have", () => {
    for (const header of ["fr-FR", "it", "pt-BR", "zh-CN"]) {
      assert.equal(browserLanguage(header), "other", header);
    }
  });

  test("is case insensitive and survives whitespace", () => {
    assert.equal(browserLanguage("  DE-de , en "), "de");
    assert.equal(browserLanguage("ES"), "es");
  });

  test("handles a missing or empty header", () => {
    assert.equal(browserLanguage(null), "other");
    assert.equal(browserLanguage(""), "other");
  });
});

describe("record", () => {
  test("drops a malformed beacon before it ever reaches the database", async () => {
    // Every one of these returns before createPrivilegedClient() is called, which is why this needs
    // no credentials. The happy path is covered in tests/integration/analytics.test.mjs.
    const ctx = { userAgent: "Mozilla/5.0 Chrome/120.0", acceptLanguage: "de", ownHost: "lacordobesa.de" };
    for (const beacon of [
      null,
      undefined,
      "not an object",
      42,
      {},
      { e: "not-an-event", p: "/" },
      { e: "pageview" },
      { e: "pageview", p: "no-leading-slash" },
      { e: "pageview", p: `/${"x".repeat(250)}` },
      { e: "pageview", p: "/staff" },
      { e: "pageview", p: "/staff/zahlen" },
    ]) {
      await assert.doesNotReject(record(beacon, ctx), `${JSON.stringify(beacon)} should be dropped quietly`);
    }
  });

  test("never throws, because analytics must not be able to break the site", async () => {
    await assert.doesNotReject(record({ e: "pageview", p: "/" }, { userAgent: "", acceptLanguage: null, ownHost: null }));
  });
});
