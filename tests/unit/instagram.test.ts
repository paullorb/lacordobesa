/**
 * The Instagram feed on the landing page.
 *
 * The whole contract is "fails to nothing". The token is long-lived but expires (60 days,
 * refreshable) and Meta retires a Graph API version about two years after release, so every one of
 * those will happen eventually, on a day nobody is watching. When it does, this must return [] and
 * let the landing page fall back to the shop's own photos, never throw into the page.
 *
 * Driven against a stubbed `fetch`, so no token is needed and nothing leaves the machine.
 */
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getInstagramPosts, instagramConfigured } from "@/lib/instagram";

const realFetch = globalThis.fetch;
const saved = { token: process.env.INSTAGRAM_ACCESS_TOKEN, user: process.env.INSTAGRAM_USER_ID };

const configure = () => {
  process.env.INSTAGRAM_ACCESS_TOKEN = "ig_test_token";
  process.env.INSTAGRAM_USER_ID = "17841400000000000";
};

afterEach(() => {
  globalThis.fetch = realFetch;
  for (const [key, value] of [
    ["INSTAGRAM_ACCESS_TOKEN", saved.token],
    ["INSTAGRAM_USER_ID", saved.user],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const reply = (body: unknown, status = 200) =>
  ((async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch);

const post = (over: Record<string, unknown> = {}) => ({
  id: "1",
  media_type: "IMAGE",
  media_url: "https://cdn.example/1.jpg",
  permalink: "https://instagram.com/p/1",
  ...over,
});

describe("instagramConfigured", () => {
  test("needs both the token and the user id", () => {
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
    delete process.env.INSTAGRAM_USER_ID;
    assert.equal(instagramConfigured(), false);

    process.env.INSTAGRAM_ACCESS_TOKEN = "ig_test_token";
    assert.equal(instagramConfigured(), false, "a token with no user id is not configured");

    configure();
    assert.equal(instagramConfigured(), true);
  });
});

describe("getInstagramPosts", () => {
  test("returns nothing, and calls nothing, without credentials", async () => {
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
    delete process.env.INSTAGRAM_USER_ID;
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("{}");
    }) as typeof fetch;

    assert.deepEqual(await getInstagramPosts(), []);
    assert.equal(called, false, "it called the API with no token");
  });

  test("maps a post down to what the strip needs", async () => {
    configure();
    globalThis.fetch = reply({ data: [post({ caption: "  Empanadas recién hechas  " })] });

    assert.deepEqual(await getInstagramPosts(), [
      { id: "1", caption: "Empanadas recién hechas", url: "https://instagram.com/p/1", image: "https://cdn.example/1.jpg" },
    ]);
  });

  test("trims the caption, and tells a missing one from a blank one", async () => {
    configure();
    // A caption of only whitespace trims to "", not to null: `caption?.trim() ?? null` only reaches
    // the null when the field is absent. Both render as no caption, so this records which is which
    // rather than asking for a change.
    globalThis.fetch = reply({ data: [post({ caption: "   " })] });
    assert.equal((await getInstagramPosts())[0].caption, "");

    globalThis.fetch = reply({ data: [post()] });
    assert.equal((await getInstagramPosts())[0].caption, null, "a missing caption should be null");
  });

  test("shows a video by its thumbnail, since its media_url cannot be a still", async () => {
    configure();
    globalThis.fetch = reply({
      data: [post({ media_type: "VIDEO", media_url: "https://cdn.example/1.mp4", thumbnail_url: "https://cdn.example/1.jpg" })],
    });
    assert.equal((await getInstagramPosts())[0].image, "https://cdn.example/1.jpg");
  });

  test("drops a post with no usable image rather than rendering a broken one", async () => {
    configure();
    globalThis.fetch = reply({
      data: [post({ id: "a", media_type: "VIDEO", thumbnail_url: undefined }), post({ id: "b" })],
    });
    assert.deepEqual((await getInstagramPosts()).map((p) => p.id), ["b"]);
  });

  test("asks for the limit it was given and never returns more", async () => {
    configure();
    let url = "";
    globalThis.fetch = (async (u: URL) => {
      url = String(u);
      return new Response(JSON.stringify({ data: Array.from({ length: 10 }, (_, i) => post({ id: String(i) })) }));
    }) as unknown as typeof fetch;

    const posts = await getInstagramPosts(3);
    assert.match(url, /limit=3/);
    assert.equal(posts.length, 3, "the API's own limit is not trusted");
  });

  test("sends the token and the fields it needs", async () => {
    configure();
    let url = "";
    globalThis.fetch = (async (u: URL) => {
      url = String(u);
      return new Response(JSON.stringify({ data: [] }));
    }) as unknown as typeof fetch;

    await getInstagramPosts();
    assert.match(url, /^https:\/\/graph\.instagram\.com\/v\d+\.\d+\/17841400000000000\/media/);
    assert.match(url, /access_token=ig_test_token/);
    assert.match(url, /permalink/);
  });

  test("an expired token takes the section away, not the page", async () => {
    configure();
    globalThis.fetch = reply({ error: { message: "Error validating access token" } }, 401);
    assert.deepEqual(await getInstagramPosts(), []);
  });

  test("a retired Graph API version does the same", async () => {
    configure();
    globalThis.fetch = reply({ error: { message: "Unsupported get request" } }, 400);
    assert.deepEqual(await getInstagramPosts(), []);
  });

  test("a network failure or a timeout does the same", async () => {
    configure();
    globalThis.fetch = (async () => {
      throw new Error("The operation was aborted due to timeout");
    }) as typeof fetch;
    assert.deepEqual(await getInstagramPosts(), []);
  });

  test("a body that is not the shape we expect does the same", async () => {
    configure();
    for (const body of [{}, { data: null }, "not json at all"]) {
      globalThis.fetch = (async () =>
        new Response(typeof body === "string" ? body : JSON.stringify(body), { status: 200 })) as typeof fetch;
      assert.deepEqual(await getInstagramPosts(), [], `body ${JSON.stringify(body)} should give []`);
    }
  });
});
