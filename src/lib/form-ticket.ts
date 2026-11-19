import { createHmac, timingSafeEqual } from "node:crypto";

/** A signed "this form was opened at T" stamp, and the check a Server Action runs on it.
 *
 *  There is no CAPTCHA (the CSP allows scripts from 'self' only), so abuse control has to come from
 *  somewhere else. A form fetches a ticket when it opens (src/app/form-ticket.ts) and sends it back
 *  with the submission. A script that posts straight at the action has no ticket; one that fetches
 *  a ticket and posts at once is too fast to be a person. Neither is proof of a human, and a patient
 *  script gets through; what it buys is that every request now costs a round trip plus a wait, and
 *  that the site can tell "came through the page" from "did not" when it is under pressure
 *  (public-forms.ts). */

/** Faster than this is not a person filling in a form, even with autofill. */
export const MIN_FORM_AGE_MS = 2_000;
/** A page left open overnight still works; beyond this the guest is asked to reload. */
export const MAX_FORM_AGE_MS = 6 * 60 * 60 * 1000;

export type TicketVerdict = "ok" | "missing" | "invalid" | "too_fast" | "expired";

const sign = (key: string, form: string, issuedAt: number) =>
  createHmac("sha256", key).update(`form-ticket:${form}:${issuedAt}`).digest("hex").slice(0, 32);

export function issueTicket(key: string, form: string, now = Date.now()) {
  return `${now}.${sign(key, form, now)}`;
}

export function checkTicket(key: string, form: string, ticket: unknown, now = Date.now()): TicketVerdict {
  if (typeof ticket !== "string" || ticket === "") return "missing";
  const match = /^(\d{10,15})\.([0-9a-f]{32})$/.exec(ticket);
  if (!match) return "invalid";
  const issuedAt = Number(match[1]);
  const expected = Buffer.from(sign(key, form, issuedAt));
  const given = Buffer.from(match[2]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "invalid";
  const age = now - issuedAt;
  if (age < MIN_FORM_AGE_MS) return "too_fast";
  if (age > MAX_FORM_AGE_MS) return "expired";
  return "ok";
}
