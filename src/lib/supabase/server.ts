import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

/** Supabase client bound to the current request's cookies. Reads the request, so callers
 *  must sit behind a Suspense boundary (or be Server Actions / Route Handlers). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    supabaseUrl(),
    supabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component: cookies are refreshed by proxy.ts instead.
          }
        },
      },
    },
  );
}
