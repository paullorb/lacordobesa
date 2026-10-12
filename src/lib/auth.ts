import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Resolves the signed-in staff user or redirects to the login page.
 *  Staff = signed in AND listed in public.staff (see migration 0004). Every staff page and
 *  Server Action calls this; proxy.ts is only an optimistic check. */
export async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/staff/login");
  const { data: isStaff, error } = await supabase.rpc("is_staff");
  // The check itself failing is not the same as "not on the allowlist": reporting it that way
  // sends the team hunting for a password or permission problem they do not have.
  if (error) redirect("/staff/login?fehler=pruefung-fehlgeschlagen");
  // proxy.ts signs a non-staff session out on the next request, so this cannot loop.
  if (!isStaff) redirect("/staff/login?fehler=kein-zugang");
  return { supabase, user };
}
