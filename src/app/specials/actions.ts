"use server";

import { randomBytes } from "node:crypto";
import { isOpenChannel } from "@/lib/broadcast";
import { CONTACT } from "@/lib/contact";
import { getDictionary } from "@/lib/dictionaries";
import { formErrors, formLocale } from "@/lib/form-errors";
import { escapeHtml, mailConfigured, sendMail } from "@/lib/mail";
import { publicFormClient, rpcUntyped } from "@/lib/public-forms";
import { FIELD_LIMITS } from "@/lib/reservation-limits";
import { localeHref } from "@/lib/i18n";
import { isManageToken, SITE_URL } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";

/** Remembers the sign-up language for the unsubscribe link (migration 20261116110200). Best effort:
 *  without it the link is the German one every row used to get. */
async function saveLocale(
  supabase: Parameters<typeof rpcUntyped>[0],
  channel: "email" | "whatsapp",
  contact: { email?: string; phone?: string },
  locale: string,
) {
  const { error } = await rpcUntyped(supabase, "set_broadcast_optin_locale", {
    p_channel: channel,
    p_email: contact.email ?? "",
    p_phone: contact.phone ?? "",
    p_locale: locale,
  });
  if (error) console.error(`could not store the specials sign-up language: ${error.message}`);
}

export type SubscribeState ={ ok: true; channel: "whatsapp" | "email" } | { ok: false; error: string } | null;

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
  if (!isOpenChannel(channel, mailConfigured())) return { ok: false, error: errorFor("channel_unavailable") };
  if (name.length < 2) return { ok: false, error: errorFor("invalid_name") };
  if (name.length > FIELD_LIMITS.name || phone.length > FIELD_LIMITS.phone || email.length > FIELD_LIMITS.email) {
    return { ok: false, error: errorFor("field_too_long") };
  }

  const { supabase, refusal } = await publicFormClient("specials", formData);
  if (refusal) return { ok: false, error: errorFor(refusal) };
  const consentText = getDictionary(locale).optin.consent[channel];
  if (channel === "email") {
    const token = randomBytes(32).toString("hex");
    const { data, error } = await supabase.rpc("request_broadcast_email", {
      p_name: name,
      p_email: email,
      p_consent_text: consentText,
      p_confirmation_token: token,
    });
    if (error) return { ok: false, error: errorFor(error.message) };
    await saveLocale(supabase, "email", { email }, locale);
    if (data) {
      const confirmUrl = `${SITE_URL}${localeHref(locale, "/specials/confirm")}?token=${token}`;
      const copy = {
        de: {
          subject: "Bitte bestätige deine Anmeldung für La Cordobesa Specials",
          intro: `Hola, bitte bestätige, dass du die Specials von La Cordobesa per E-Mail erhalten möchtest.`,
          button: "E-Mail-Adresse bestätigen",
          ignore: "Wenn du dich nicht angemeldet hast, kannst du diese E-Mail ignorieren.",
        },
        es: {
          subject: "Confirmá tu suscripción a las novedades de La Cordobesa",
          intro: `¡Hola! Confirmá que querés recibir por e-mail las novedades de La Cordobesa.`,
          button: "Confirmar mi e-mail",
          ignore: "Si no te anotaste, podés ignorar este e-mail.",
        },
        en: {
          subject: "Confirm your La Cordobesa specials subscription",
          intro: `Hola, please confirm that you want to receive La Cordobesa specials by email.`,
          button: "Confirm email address",
          ignore: "If you did not sign up, you can ignore this email.",
        },
      }[locale];
      const result = await sendMail({
        to: email,
        subject: copy.subject,
        text: `${copy.intro}\n\n${confirmUrl}\n\n${copy.ignore}`,
        html: `<div style="max-width:520px;margin:24px auto;padding:28px;background:#f3f8fb;color:#17384b;font-family:Arial,Helvetica,sans-serif;line-height:1.6"><p>${escapeHtml(copy.intro)}</p><p><a href="${escapeHtml(confirmUrl)}" style="display:inline-block;padding:12px 20px;background:#17384b;color:#ffffff;text-decoration:none">${escapeHtml(copy.button)}</a></p><p>${escapeHtml(copy.ignore)}</p><p>La Cordobesa · Frankfurt am Main</p></div>`,
        replyTo: CONTACT.email,
      });
      if (!result.ok) {
        // The RPC already recorded this attempt for its resend cooldown. Give it back, or the guest's
        // retry would hit the cooldown and be told "sent" although nothing ever left.
        const released = await rpcUntyped(supabase, "release_broadcast_email_attempt", { p_email: email });
        if (released.error) console.error(`could not release the specials mail attempt: ${released.error.message}`);
        return { ok: false, error: errorFor("generic") };
      }
    }
    return { ok: true, channel: "email" };
  }

  // The WhatsApp row stays unconfirmed until staff see the guest's own message from that number.
  const { error } = await supabase.rpc("subscribe_broadcast", {
    p_channel: channel,
    // Stored verbatim, so the record says exactly what was agreed to rather than just "true".
    p_consent_text: consentText,
    p_name: name,
    p_phone: phone,
  });
  if (error) return { ok: false, error: errorFor(error.message) };
  await saveLocale(supabase, "whatsapp", { phone }, locale);
  return { ok: true, channel: "whatsapp" };
}

export type ConfirmEmailState = { ok: true } | { ok: false } | null;

/** The confirmation link opens a page first. Mail security scanners therefore cannot confirm a
 *  subscription just by fetching its URL; the guest has to submit this form. */
export async function confirmSpecialsEmail(_prev: ConfirmEmailState, formData: FormData): Promise<ConfirmEmailState> {
  const token = String(formData.get("token") ?? "");
  if (!/^[0-9a-f]{64}$/.test(token)) return { ok: false };
  const { data, error } = await createPublicClient().rpc("confirm_broadcast_email", { p_token: token });
  return !error && data ? { ok: true } : { ok: false };
}

export type UnsubscribeState ={ ok: true } | { ok: false; error: string } | null;

/** Withdrawing consent. Reports success for any token, valid or not: the RPC is idempotent and
 *  deliberately says nothing about whether the token was ever valid, so this page cannot be used to
 *  probe the list. Only a failed call is an error, because then the guest is still on the list. */
export async function unsubscribeFromSpecials(_prev: UnsubscribeState, formData: FormData): Promise<UnsubscribeState> {
  const token = String(formData.get("token") ?? "");
  if (isManageToken(token)) {
    const supabase = createPublicClient();
    const { error } = await supabase.rpc("unsubscribe_broadcast", { p_token: token });
    if (error) return { ok: false, error: getDictionary(formLocale(formData)).formErrors.generic };
  }
  return { ok: true };
}
