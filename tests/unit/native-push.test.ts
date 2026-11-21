/**
 * Push notifications to the staff iPhone app: what APNs is sent, and when a token is given up.
 *
 * Nothing here talks to Apple. What is pinned is the provider token (an ES256 JWT that must verify
 * against the key's public half, in the raw r||s form JOSE uses, not DER), the body the app's tap
 * listener reads `url` from, which answers delete a device, and that the web pages stay inert
 * outside the app.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { apnsConfig, apnsPayload, inquiryPush, isDeadToken, preorderPush, providerToken, reservationPush } from "@/lib/native-push";
import { onPushTap, pushPlugin } from "@/lib/native-push-client";

describe("apnsConfig", () => {
  test("is null until key id, team id and key are all set, so pushes are skipped like unconfigured mail", () => {
    assert.equal(apnsConfig({}), null);
    assert.equal(apnsConfig({ APNS_KEY_ID: "K", APNS_TEAM_ID: "T" }), null);
  });

  test("defaults to production APNs and the app's bundle id, and unescapes a one-line PEM", () => {
    const c = apnsConfig({ APNS_KEY_ID: "K", APNS_TEAM_ID: "T", APNS_PRIVATE_KEY: "a\\nb" });
    assert.deepEqual(c, { keyId: "K", teamId: "T", privateKey: "a\nb", topic: "de.lacordobesa.staff", host: "api.push.apple.com" });
    const dev = apnsConfig({ APNS_KEY_ID: "K", APNS_TEAM_ID: "T", APNS_PRIVATE_KEY: "x", APNS_ENV: "development" });
    assert.equal(dev?.host, "api.sandbox.push.apple.com");
  });
});

describe("providerToken", () => {
  test("is an ES256 JWT that verifies against the key, with kid, iss and iat where Apple reads them", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const jwt = providerToken({ keyId: "ABC123", teamId: "TEAM42", privateKey: pem }, 1_700_000_000);
    const [h, c, s] = jwt.split(".");
    assert.deepEqual(JSON.parse(Buffer.from(h, "base64url").toString()), { alg: "ES256", kid: "ABC123" });
    assert.deepEqual(JSON.parse(Buffer.from(c, "base64url").toString()), { iss: "TEAM42", iat: 1_700_000_000 });
    const signature = Buffer.from(s, "base64url");
    assert.equal(signature.length, 64, "raw r||s, not DER");
    assert.ok(verify("sha256", Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, signature));
  });
});

describe("messages", () => {
  test("carry the staff page to open beside aps, where the tap listener looks", () => {
    const body = apnsPayload(reservationPush({ name: "Ana", partySize: 4, date: "2026-11-28", time: "19:30" }));
    assert.equal(body.url, "/staff/reservierungen?date=2026-11-28");
    assert.equal(body.aps.alert.title, "Nueva reserva");
    assert.match(body.aps.alert.body, /^Ana · 4 personas · .*19:30$/);
    assert.match(reservationPush({ name: "Ana", partySize: 1, date: "2026-11-28", time: "19:30" }).body, / 1 persona /);
  });

  test("pre-orders and inquiries open their own lists", () => {
    assert.equal(preorderPush({ name: "Leo", date: "2026-11-28", time: "12:00" }).url, "/staff/vorbestellungen");
    const inquiry = inquiryPush({ name: "Sofi", occasion: "Geburtstag", date: null });
    assert.equal(inquiry.url, "/staff/anfragen");
    assert.equal(inquiry.body, "Sofi · Geburtstag");
  });
});

describe("isDeadToken", () => {
  test("drops a device only when Apple says the token will never work again", () => {
    assert.ok(isDeadToken(410, "Unregistered"));
    assert.ok(isDeadToken(400, "BadDeviceToken"));
    assert.ok(isDeadToken(400, "DeviceTokenNotForTopic"));
    assert.ok(!isDeadToken(200, undefined));
    assert.ok(!isDeadToken(403, "ExpiredProviderToken"), "our key's fault, not the device's");
    assert.ok(!isDeadToken(429, "TooManyRequests"));
    assert.ok(!isDeadToken(0, "connect ECONNREFUSED"));
  });
});

describe("outside the app", () => {
  test("there is no plugin and a tap listener is a no-op, so the web pages are unchanged", () => {
    assert.equal(pushPlugin(), null);
    const off = onPushTap(() => assert.fail("no taps outside the app"));
    off();
  });
});
