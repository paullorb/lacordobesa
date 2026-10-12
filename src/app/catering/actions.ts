"use server";

import { isBudgetBand, isOccasion } from "@/lib/events";
import { publicFormClient } from "@/lib/public-forms";
import { FIELD_LIMITS } from "@/lib/reservation-limits";

export type InquiryState = { ok: true } | { ok: false; error: string } | null;

const ERRORS: Record<string, string> = {
  invalid_contact: "Bitte gib deinen Namen, eine gültige Telefonnummer und, falls angegeben, eine gültige E-Mail-Adresse an.",
  field_too_long: "Eine Eingabe ist zu lang. Bitte kürze sie ein wenig.",
  too_many_requests: "Dazu liegt uns schon eine Anfrage vor. Wir melden uns, oder ruf uns gern direkt an.",
  invalid_occasion: "Bitte wähle einen Anlass aus.",
  invalid_budget: "Bitte wähle einen Rahmen aus.",
  invalid_guests: "Bitte gib eine Personenzahl zwischen 1 und 500 an.",
  in_the_past: "Dieses Datum liegt in der Vergangenheit.",
};

/** The message field is longer than a reservation note, since this is where the plan gets described. */
const MESSAGE_LIMIT = 1500;

export async function requestEventInquiry(_prev: InquiryState, formData: FormData): Promise<InquiryState> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const occasion = String(formData.get("occasion") ?? "");
  const budget = String(formData.get("budget_band") ?? "");
  const date = String(formData.get("event_date") ?? "");
  const guestsRaw = String(formData.get("guests") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (
    name.length > FIELD_LIMITS.name ||
    phone.length > FIELD_LIMITS.phone ||
    email.length > FIELD_LIMITS.email ||
    message.length > MESSAGE_LIMIT
  ) {
    return { ok: false, error: ERRORS.field_too_long };
  }
  if (!isOccasion(occasion)) return { ok: false, error: ERRORS.invalid_occasion };
  if (!isBudgetBand(budget)) return { ok: false, error: ERRORS.invalid_budget };
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Bitte gib ein gültiges Datum an." };

  // Both are optional: "wir sind flexibel" and "weiß ich noch nicht" are normal answers here.
  const guests = guestsRaw ? Number(guestsRaw) : null;
  if (guests !== null && (!Number.isInteger(guests) || guests < 1 || guests > 500)) {
    return { ok: false, error: ERRORS.invalid_guests };
  }

  const { supabase, allowed } = await publicFormClient("inquiry");
  if (!allowed) return { ok: false, error: ERRORS.too_many_requests };
  const { error } = await supabase.rpc("request_event_inquiry", {
    p_name: name,
    p_phone: phone,
    p_email: email,
    p_occasion: occasion,
    p_budget_band: budget,
    p_event_date: date || undefined,
    p_guests: guests ?? undefined,
    p_message: message || undefined,
  });
  if (error) {
    return { ok: false, error: ERRORS[error.message] ?? "Das hat leider nicht geklappt. Bitte versuch es noch einmal oder ruf uns an." };
  }
  return { ok: true };
}
