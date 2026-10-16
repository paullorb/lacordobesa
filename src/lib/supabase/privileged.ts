import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabaseUrl } from "@/lib/supabase/env";

/** Client on the project's secret key, for the public form Server Actions and the admin-only team
 *  accounts under Einstellungen (creating an auth user needs it).
 *
 *  The form RPCs (request_reservation and its siblings) used to be callable by anyone holding the
 *  publishable key, which ships in every browser. A script could skip this site entirely and flood
 *  them. Migration 20261014072715 revoked that grant, so those five RPCs now answer only to the
 *  secret key, and every request has to come through a Server Action that knows the visitor's
 *  address.
 *
 *  Required, not optional. It used to return null when SUPABASE_SECRET_KEY was unset and the forms
 *  fell back to the publishable key; since the revoke that fallback cannot work, so a missing key
 *  throws here instead of turning into an "Invalid API key" from PostgREST three frames later.
 *  Never import this into a client component, and never use it to read data for a page: it bypasses
 *  row-level security. */
export function createPrivilegedClient() {
  return createSupabaseClient<Database>(supabaseUrl(), secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** The secret key itself, for the one other thing that needs it: peppering the visitor hash in
 *  src/lib/public-forms.ts. Same throw, so a missing key is one message wherever it surfaces. */
export function secretKey() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not set. The public form RPCs stopped accepting the publishable key " +
        "in migration 20261014072715, so the forms cannot submit without it. Set it for this " +
        "environment (see README, Environments).",
    );
  }
  return key;
}
