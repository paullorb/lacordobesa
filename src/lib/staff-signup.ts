import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { SITE_URL } from "@/lib/site";

/** Staff sign-up invites (migration 20261116100200).
 *
 *  This replaced one permanent STAFF_SIGNUP_TOKEN in the URL, which anyone holding the link could
 *  use for any number of accounts, forever. An invite is made by an admin, shown once, stored only as
 *  its SHA-256, valid for a week, usable once and revocable. The role is whatever the admin chose
 *  when issuing it.
 *
 *  Comparison happens in the database, as an equality lookup on the hash of a 256-bit random secret.
 *  That is what the old constant-time comparison was protecting against: nothing about the secret
 *  can be learned from how long a lookup of its hash takes, because the hash cannot be steered. */

export const INVITE_TTL_DAYS = 7;
/** A ceiling on unused invites, so a forgotten page cannot pile them up. */
export const MAX_PENDING_INVITES = 20;

type Admin = SupabaseClient<Database>;
type InviteRole = "admin" | "staff";

/** 32 random bytes as base64url: 43 characters, no padding. */
export function newInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;
export const isInviteToken = (token: unknown): token is string => typeof token === "string" && TOKEN_SHAPE.test(token);

export const hashInviteToken = (token: string): string => createHash("sha256").update(token).digest("hex");

export const inviteExpiry = (now: Date = new Date()): string =>
  new Date(now.getTime() + INVITE_TTL_DAYS * 86_400_000).toISOString();

/** The current instant, for the pages that list live invites (a page body may not read the clock itself). */
export const nowISO = (): string => new Date().toISOString();

export const inviteUrl = (token: string): string => `${SITE_URL}/staff/signup?key=${token}`;

/** Whether this token is a live invite, without using it. For the sign-up page; the action still
 *  claims it, because a page check says nothing about the next request. A failing query (the
 *  migration not applied yet, a dropped connection) reads as "no invite": fail closed. */
export async function inviteIsLive(admin: Admin, token: string): Promise<boolean> {
  if (!isInviteToken(token)) return false;
  const { data, error } = await admin
    .from("staff_invites")
    .select("id")
    .eq("token_hash", hashInviteToken(token))
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) {
    console.error("inviteIsLive", error);
    return false;
  }
  return !!data;
}

/** Uses the invite: one UPDATE, so of two concurrent sign-ups only one gets the row back. */
export async function claimInvite(admin: Admin, token: string): Promise<{ id: string; role: InviteRole } | null> {
  if (!isInviteToken(token)) return null;
  const { data, error } = await admin
    .from("staff_invites")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", hashInviteToken(token))
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id, role")
    .maybeSingle();
  if (error) {
    console.error("claimInvite", error);
    return null;
  }
  return data ? { id: data.id, role: data.role === "admin" ? "admin" : "staff" } : null;
}

/** Gives a claimed invite back, for when the account could not be made after all (name taken, auth
 *  outage) so the person can try again with the same link. */
export async function releaseInvite(admin: Admin, id: string): Promise<void> {
  const { error } = await admin.from("staff_invites").update({ used_at: null, used_by: null }).eq("id", id);
  if (error) console.error("releaseInvite", error);
}
