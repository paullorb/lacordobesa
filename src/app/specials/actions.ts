"use server";

import { randomBytes } from "node:crypto";
import { isOpenChannel } from "@/lib/broadcast";
import { CONTACT } from "@/lib/contact";
import { getDictionary } from "@/lib/dictionaries";
import { formErrors, formLocale } from "@/lib/form-errors";
import { escapeHtml, mailConfigured, sendMail } from "@/lib/mail";
import { publicFormClient } from "@/lib/public-forms";
import { FIELD_LIMITS } from "@/lib/reservation-limits";
import { isManageToken, SITE_URL } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";

export type SubscribeState = { ok: true; channel: "whatsapp" | "email" } | { ok: false; error: string } | null;

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

  const { supabase, allowed } = await publicFormClient("specials");
  if (!allowed) return { ok: false, error: errorFor("too_many_requests") };
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
    if (data) {
      const confirmUrl = `${SITE_URL}/specials/confirm?token=${token}&lang=${locale}`;
      const copy = {
        de: {
          subject: "Bitte bestätige deine Anmeldung für La Cordobesa Specials",
          intro: `Hola ${name}, bitte bestätige, dass du die Specials von La Cordobesa per E-Mail erhalten möchtest.`,
          button: "E-Mail-Adresse bestätigen",
          ignore: "Wenn du dich nicht angemeldet hast, kannst du diese E-Mail ignorieren.",
        },
        es: {
          subject: "Confirmá tu suscripción a las novedades de La Cordobesa",
          intro: `¡Hola ${name}! Confirmá que querés recibir por e-mail las novedades de La Cordobesa.`,
          button: "Confirmar mi e-mail",
          ignore: "Si no te anotaste, podés ignorar este e-mail.",
        },
        en: {
          subject: "Confirm your La Cordobesa specials subscription",
          intro: `Hola ${name}, please confirm that you want to receive La Cordobesa specials by email.`,
          button: "Confirm email address",
          ignore: "If you did not sign up, you can ignore this email.",
        },
      }[locale];
      const result = await sendMail({
        to: email,
        subject: copy.subject,
        text: `${copy.intro}\n\n${confirmUrl}\n\n${copy.ignore}`,
        html: `<div style="max-width:520px;margin:24px auto;padding:28px;background:#fffdf8;color:#282b2c;font-family:Arial,Helvetica,sans-serif;line-height:1.6"><p>${escapeHtml(copy.intro)}</p><p><a href="${escapeHtml(confirmUrl)}" style="display:inline-block;padding:12px 20px;background:#282b2c;color:#fffdf8;text-decoration:none">${escapeHtml(copy.button)}</a></p><p>${escapeHtml(copy.ignore)}</p><p>La Cordobesa · Frankfurt am Main</p></div>`,
        replyTo: CONTACT.email,
      });
      if (!result.ok) return { ok: false, error: errorFor("generic") };
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
  return { ok: true, channel: "whatsapp" };
}

export type UnsubscribeState = { ok: true } | { ok: false; error: string } | null;

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
