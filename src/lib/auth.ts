import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Resolves the signed-in staff user or redirects to the login page.
 *  Staff = signed in AND listed in public.staff (see migration 0004). Every admin page and
 *  Server Action calls this; proxy.ts is only an optimistic check. */
export async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: isStaff } = await supabase.rpc("is_staff");
  // proxy.ts signs a non-staff session out on the next request, so this cannot loop.
  if (!isStaff) redirect("/admin/login?fehler=kein-zugang");
  return { supabase, user };
}
