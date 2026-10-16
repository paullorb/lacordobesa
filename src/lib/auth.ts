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
 * The staff row says both things at once: there is one (on the allowlist, migration 0004) and its
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
  return ctx;
}
