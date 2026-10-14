import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

/** Anonymous client with no cookies/session. Safe inside `use cache` functions, because it
 *  never touches the request. Only sees what RLS exposes to `anon`. */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    supabaseUrl(),
    supabasePublishableKey(),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
