import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { hashInviteToken, INVITE_TTL_DAYS, inviteExpiry, inviteUrl, isInviteToken, newInviteToken } from "@/lib/staff-signup";

describe("staff sign-up invites", () => {
  test("tokens are 43 URL-safe characters and never repeat", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const token = newInviteToken();
      assert.match(token, /^[A-Za-z0-9_-]{43}$/);
      assert.equal(isInviteToken(token), true);
      seen.add(token);
    }
    assert.equal(seen.size, 50);
  });

  test("only the exact shape is accepted", () => {
    assert.equal(isInviteToken(""), false);
    assert.equal(isInviteToken("short"), false);
    assert.equal(isInviteToken("a".repeat(42)), false);
    assert.equal(isInviteToken("a".repeat(44)), false);
    assert.equal(isInviteToken("a".repeat(42) + "+"), false);
    assert.equal(isInviteToken(undefined), false);
    assert.equal(isInviteToken(["a".repeat(43)]), false);
  });

  test("the stored hash is the lowercase hex SHA-256 of the token", () => {
    const token = "a".repeat(43);
    assert.equal(hashInviteToken(token), createHash("sha256").update(token).digest("hex"));
    assert.match(hashInviteToken(token), /^[0-9a-f]{64}$/);
    assert.notEqual(hashInviteToken(token), hashInviteToken("b".repeat(43)));
  });

  test("an invite expires after the configured number of days", () => {
    const now = new Date("2026-11-16T10:00:00Z");
    assert.equal(inviteExpiry(now), new Date(now.getTime() + INVITE_TTL_DAYS * 86_400_000).toISOString());
    assert.equal(INVITE_TTL_DAYS, 7);
  });

  test("the link carries the token in the key parameter", () => {
    const token = newInviteToken();
    assert.ok(inviteUrl(token).endsWith(`/staff/signup?key=${token}`));
  });
});
