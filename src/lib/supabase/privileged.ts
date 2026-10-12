import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/** Client on the project's secret key, for the public form Server Actions only.
 *
 *  The form RPCs (request_reservation and its siblings) used to be callable by anyone holding the
 *  publishable key, which ships in every browser. A script could skip this site entirely and flood
 *  them. With the secret key on the server, the database can stop granting those RPCs to anon,
 *  and every request has to come through a Server Action that knows the visitor's address.
 *
 *  Optional: without SUPABASE_SECRET_KEY this returns null and callers fall back to the publishable
 *  client, which is how the site ran before. Never import this into a client component, and never
 *  use it to read data for a page: it bypasses row-level security. */
export function createPrivilegedClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
