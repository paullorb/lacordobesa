import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { validStaffSignupToken } from "@/lib/staff-signup";

describe("shared staff signup token", () => {
  test("accepts only the configured long token", () => {
    const before = process.env.STAFF_SIGNUP_TOKEN;
    try {
      delete process.env.STAFF_SIGNUP_TOKEN;
      assert.equal(validStaffSignupToken("x".repeat(64)), false);
      process.env.STAFF_SIGNUP_TOKEN = "short";
      assert.equal(validStaffSignupToken("short"), false);
      process.env.STAFF_SIGNUP_TOKEN = "a".repeat(64);
      assert.equal(validStaffSignupToken("a".repeat(64)), true);
      assert.equal(validStaffSignupToken("a".repeat(63) + "b"), false);
      assert.equal(validStaffSignupToken(""), false);
    } finally {
      if (before === undefined) delete process.env.STAFF_SIGNUP_TOKEN;
      else process.env.STAFF_SIGNUP_TOKEN = before;
    }
  });
});
