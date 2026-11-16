import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Who is signed in, and what they may do. Once per request.
 *
 * The layout, its user menu, its nav and the page all want this, and each of them used to ask on
 * its own: getUser() is a round trip to the Auth server, is_staff() another to the database. On
 * Reservierungen that was five round trips before the page could start on its own queries, which
 * is most of why clicking another day in the calendar felt slow. cache() makes them share one
 * answer, and getClaims() checks the token's signature locally against the project's published
 * key (both projects sign with ES256) instead of asking the Auth server.
 *
 * What getClaims() does NOT do (read in @supabase/auth-js 2.117, GoTrueClient.getClaims): with an
 * asymmetric key it only checks the signature and `exp`. It never asks the Auth server whether the
 * session still exists, so a session that was revoked, or a stolen one after a password reset,
 * keeps passing here until its access token expires (the project's JWT expiry, one hour by default).
 * Two things bound that: removing a person deletes their `staff` row, which the query below reads
 * under their own token and which therefore stops them at once; and requireAdmin() below asks the
 * Auth server (getUser()) as well, so the admin-only pages and actions, which include resetting a
 * password and issuing invites, never run on a session the server has revoked. The residual risk is
 * a revoked non-admin session that is still on the allowlist: for at most one JWT lifetime it can
 * keep using the ordinary staff pages. resetStaffPassword() removes its refresh tokens
 * (revoke_user_sessions, migration 20261116100300) so it cannot be extended past that.
 *
 * The staff row says both things at once: there is one (on the allowlist, migration 20261012074936) and its
 * role (admin or staff, migration 20261016030801). RLS lets a user read only their own row.
 */
export const staffSession = cache(async () => {
  // A runtime prefetch renders with the cookies but may not read the clock, and verifying the token
  // checks its expiry against Date.now(). connection() stops the prefetch here and resolves at once
  // for a real request or a Server Action.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { supabase, user: null, isStaff: false, isAdmin: false, failed: false };
  const user = { id: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined };
  const { data: row, error } = await supabase.from("staff").select("role").eq("user_id", user.id).maybeSingle();
  return { supabase, user, isStaff: !!row, isAdmin: row?.role === "admin", failed: !!error };
});

/** Resolves the signed-in staff user or redirects to the login page.
 *  Every staff page and Server Action calls this; proxy.ts is only an optimistic check. */
export async function requireStaff() {
  const { supabase, user, isStaff, isAdmin, failed } = await staffSession();
  if (!user) redirect("/staff/login");
  // The check itself failing is not the same as "not on the allowlist": reporting it that way
  // sends the team hunting for a password or permission problem they do not have.
  if (failed) redirect("/staff/login?fehler=pruefung-fehlgeschlagen");
  // proxy.ts signs a non-staff session out on the next request, so this cannot loop.
  if (!isStaff) redirect("/staff/login?fehler=kein-zugang");
  return { supabase, user, isAdmin };
}

/** Like requireStaff(), and also an admin: the agency's own accounts. Staff who are not admins land
 *  on the dashboard rather than on an error, because the page they asked for is not one of theirs. */
export async function requireAdmin() {
  const ctx = await requireStaff();
  if (!ctx.isAdmin) redirect("/staff");
  // The one place a round trip to the Auth server is worth it: getClaims() above would accept a
  // session that has been revoked, and these are the pages and actions that create accounts, reset
  // passwords and write admin-only settings. Once per request, and only for admins.
  if (!(await serverVerifiedUser(ctx.supabase))) redirect("/staff/login");
  return ctx;
}

const serverVerifiedUser = cache(async (supabase: Awaited<ReturnType<typeof createClient>>) => {
  const { data, error } = await supabase.auth.getUser();
  return !error && !!data.user;
});
