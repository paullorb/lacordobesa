"use server";

import { isOpenChannel } from "@/lib/broadcast";
import { getDictionary } from "@/lib/dictionaries";
import { formErrors, formLocale } from "@/lib/form-errors";
import { publicFormClient } from "@/lib/public-forms";
import { FIELD_LIMITS } from "@/lib/reservation-limits";
import { isManageToken } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";

export type SubscribeState = { ok: true } | { ok: false; error: string } | null;

export async function subscribeToSpecials(_prev: SubscribeState, formData: FormData): Promise<SubscribeState> {
  const channel = String(formData.get("channel") ?? "");
  // The locale decides which consent sentence is recorded. Resolved here rather than submitted as
  // text, so the stored evidence is the wording the form actually displayed and nothing a crafted
  // POST could choose.
  const locale = formLocale(formData);
  const errorFor = formErrors(formData, (d) => d.optin.errors);
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  // The checkbox is the consent. Without it there is nothing to record, so nothing is sent.
  if (formData.get("consent") !== "on") return { ok: false, error: errorFor("invalid_consent") };
  if (!isOpenChannel(channel)) return { ok: false, error: errorFor("channel_unavailable") };
  if (name.length > FIELD_LIMITS.name || phone.length > FIELD_LIMITS.phone || email.length > FIELD_LIMITS.email) {
    return { ok: false, error: errorFor("field_too_long") };
  }

  const { supabase, allowed } = await publicFormClient("specials");
  if (!allowed) return { ok: false, error: errorFor("too_many_requests") };
  // The row goes in unconfirmed. It is only offered for sending once the guest's own WhatsApp
  // message has arrived and staff confirmed it; the success state tells the guest to send it.
  const { error } = await supabase.rpc("subscribe_broadcast", {
    p_channel: channel,
    // Stored verbatim, so the record says exactly what was agreed to rather than just "true".
    p_consent_text: getDictionary(locale).optin.consent[channel],
    p_name: name || undefined,
    p_phone: channel === "whatsapp" ? phone : undefined,
    p_email: channel === "email" ? email : undefined,
  });
  if (error) return { ok: false, error: errorFor(error.message) };
  return { ok: true };
}

export type UnsubscribeState = { ok: true } | null;

/** Withdrawing consent. Always reports success: the RPC is idempotent and deliberately says nothing
 *  about whether the token was ever valid, so this page cannot be used to probe the list. */
export async function unsubscribeFromSpecials(_prev: UnsubscribeState, formData: FormData): Promise<UnsubscribeState> {
  const token = String(formData.get("token") ?? "");
  if (isManageToken(token)) {
    const supabase = createPublicClient();
    await supabase.rpc("unsubscribe_broadcast", { p_token: token });
  }
  return { ok: true };
}
