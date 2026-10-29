"use server";

import { createPublicClient } from "@/lib/supabase/public";

export type ConfirmEmailState = { ok: true } | { ok: false } | null;

/** The confirmation link opens a page first. Mail security scanners therefore cannot confirm a
 *  subscription just by fetching its URL; the guest has to submit this form. */
export async function confirmSpecialsEmail(_prev: ConfirmEmailState, formData: FormData): Promise<ConfirmEmailState> {
  const token = String(formData.get("token") ?? "");
  if (!/^[0-9a-f]{64}$/.test(token)) return { ok: false };
  const { data, error } = await createPublicClient().rpc("confirm_broadcast_email", { p_token: token });
  return !error && data ? { ok: true } : { ok: false };
}
