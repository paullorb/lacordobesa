"use server";

import { CONSENT_TEXT, isBroadcastChannel } from "@/lib/broadcast";
import { FIELD_LIMITS } from "@/lib/reservation-limits";
import { isManageToken } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";

export type SubscribeState = { ok: true } | { ok: false; error: string } | null;

const ERRORS: Record<string, string> = {
  invalid_channel: "Bitte wähle, wie wir dich erreichen dürfen.",
  invalid_contact: "Bitte gib eine gültige Telefonnummer beziehungsweise E-Mail-Adresse an.",
  invalid_consent: "Bitte stimme der Benachrichtigung zu.",
  field_too_long: "Eine Eingabe ist zu lang. Bitte kürze sie ein wenig.",
  too_many_requests: "Gerade kommen sehr viele Anmeldungen. Bitte versuch es später noch einmal.",
};

export async function subscribeToSpecials(_prev: SubscribeState, formData: FormData): Promise<SubscribeState> {
  const channel = String(formData.get("channel") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  // The checkbox is the consent. Without it there is nothing to record, so nothing is sent.
  if (formData.get("consent") !== "on") return { ok: false, error: ERRORS.invalid_consent };
  if (!isBroadcastChannel(channel)) return { ok: false, error: ERRORS.invalid_channel };
  if (name.length > FIELD_LIMITS.name || phone.length > FIELD_LIMITS.phone || email.length > FIELD_LIMITS.email) {
    return { ok: false, error: ERRORS.field_too_long };
  }

  const supabase = createPublicClient();
  const { error } = await supabase.rpc("subscribe_broadcast", {
    p_channel: channel,
    // Stored verbatim, so the record says exactly what was agreed to rather than just "true".
    p_consent_text: CONSENT_TEXT[channel],
    p_name: name || undefined,
    p_phone: channel === "whatsapp" ? phone : undefined,
    p_email: channel === "email" ? email : undefined,
  });
  if (error) {
    return { ok: false, error: ERRORS[error.message] ?? "Das hat leider nicht geklappt. Bitte versuch es noch einmal." };
  }
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
