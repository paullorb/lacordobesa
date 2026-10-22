import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/** The shared URL is a bearer credential. Keep its random token only in server configuration. */
export function validStaffSignupToken(token: string) {
  const expected = process.env.STAFF_SIGNUP_TOKEN;
  if (!expected || expected.length < 32 || !token) return false;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(token), hash(expected));
}
