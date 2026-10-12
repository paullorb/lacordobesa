"use server";

import { isISODate } from "@/lib/dates";
import { isBudgetBand, isOccasion } from "@/lib/events";
import { formErrors } from "@/lib/form-errors";
import { FIELD_LIMITS } from "@/lib/reservation-limits";
import { createPublicClient } from "@/lib/supabase/public";

export type InquiryState = { ok: true } | { ok: false; error: string } | null;

/** The message field is longer than a reservation note, since this is where the plan gets described. */
const MESSAGE_LIMIT = 1500;

export async function requestEventInquiry(_prev: InquiryState, formData: FormData): Promise<InquiryState> {
  const errorFor = formErrors(formData, (d) => d.inquiryForm.errors);
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
    return { ok: false, error: errorFor("field_too_long") };
  }
  if (!isOccasion(occasion)) return { ok: false, error: errorFor("invalid_occasion") };
  if (!isBudgetBand(budget)) return { ok: false, error: errorFor("invalid_budget") };
  if (date && !isISODate(date)) return { ok: false, error: errorFor("invalid_date") };

  // Both are optional: "wir sind flexibel" and "weiß ich noch nicht" are normal answers here.
  const guests = guestsRaw ? Number(guestsRaw) : null;
  if (guests !== null && (!Number.isInteger(guests) || guests < 1 || guests > 500)) {
    return { ok: false, error: errorFor("invalid_guests") };
  }

  const supabase = createPublicClient();
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
  if (error) return { ok: false, error: errorFor(error.message) };
  return { ok: true };
}
