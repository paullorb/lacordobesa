"use server";

import { requireStaff } from "@/lib/auth";

// The staff iPhone app's device registration (src/lib/native-push-client.ts). Both go through the
// SECURITY DEFINER functions of migration 20261121135841, which only ever touch the caller's own
// device; the table itself is closed to staff.

/** APNs device tokens are hex. Anything else is not a token and is not sent to the database. */
const APNS_TOKEN = /^[0-9a-f]{64,200}$/i;

export async function savePushToken(token: string): Promise<{ ok: boolean }> {
  if (!APNS_TOKEN.test(token)) return { ok: false };
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc("register_push_token", { p_token: token, p_platform: "ios" });
  if (error) console.error("savePushToken", error);
  return { ok: !error };
}

export async function removePushToken(token: string): Promise<{ ok: boolean }> {
  if (!APNS_TOKEN.test(token)) return { ok: false };
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc("unregister_push_token", { p_token: token });
  if (error) console.error("removePushToken", error);
  return { ok: !error };
}
