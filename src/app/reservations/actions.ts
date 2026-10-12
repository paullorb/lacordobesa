"use server";

import { addDays } from "@/lib/dates";
import { FIELD_LIMITS } from "@/lib/reservation-limits";
import { createPublicClient } from "@/lib/supabase/public";

export type Slot = { time: string; seatsLeft: number };
export type UnavailableReason = "closed" | "holiday" | "late" | "error";
export type Availability = { slots: Slot[]; reason: UnavailableReason | null };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function fetchSlots(date: string): Promise<Slot[] | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("reservation_availability", { p_date: date });
  if (error) return null;
  return (data ?? []).map((s) => ({ time: s.slot.slice(0, 5), seatsLeft: s.seats_left }));
}

/** Bookable time slots for a day, or why there are none. Public: backed by the SECURITY DEFINER RPC. */
export async function getAvailability(date: string): Promise<Availability> {
  if (!ISO_DATE.test(date)) return { slots: [], reason: "error" };
  const slots = await fetchSlots(date);
  if (!slots) return { slots: [], reason: "error" };
  if (slots.length > 0) return { slots, reason: null };

  const supabase = createPublicClient();
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const [{ data: hours }, { data: closure }] = await Promise.all([
    supabase.from("opening_hours").select("is_closed").eq("weekday", weekday).maybeSingle(),
    supabase.from("closures").select("date").eq("date", date).maybeSingle(),
  ]);
  if (closure) return { slots: [], reason: "holiday" };
  if (!hours || hours.is_closed) return { slots: [], reason: "closed" };
  // Open day, but every slot is already inside the lead time (e.g. asking in the evening for today).
  return { slots: [], reason: "late" };
}

/** First day on or after `from` (within 10 days) that still has a free slot. */
export async function getFirstAvailableDay(from: string): Promise<{ date: string; slots: Slot[] } | null> {
  if (!ISO_DATE.test(from)) return null;
  const days = Array.from({ length: 10 }, (_, i) => addDays(from, i));
  const results = await Promise.all(days.map(fetchSlots));
  for (let i = 0; i < days.length; i++) {
    const slots = results[i];
    if (slots?.some((s) => s.seatsLeft > 0)) return { date: days[i], slots };
  }
  return null;
}

export type RequestState = { ok: true; id: string } | { ok: false; error: string; retryTime?: boolean } | null;

const RETRY_TIME = new Set(["slot_full", "slot_unavailable", "too_soon"]);

const ERRORS: Record<string, string> = {
  reservations_disabled: "Online-Reservierungen sind gerade nicht möglich. Ruf uns gern an.",
  invalid_contact: "Bitte gib deinen Namen, eine gültige Telefonnummer und – falls angegeben – eine gültige E-Mail-Adresse an.",
  field_too_long: "Eine Eingabe ist zu lang. Bitte kürze sie ein wenig.",
  too_many_requests: "Dazu gibt es schon mehrere Anfragen. Bitte ruf uns kurz an, dann klären wir alles direkt.",
  duplicate_booking: "Für diesen Tag liegt schon eine Anfrage mit dieser Telefonnummer vor. Wir melden uns bei dir.",
  party_too_large: "Für so große Gruppen ruf uns bitte kurz an – wir finden eine Lösung.",
  too_far_ahead: "So weit im Voraus können wir noch nicht reservieren.",
  too_soon: "Für diese Uhrzeit ist es leider zu kurzfristig. Ruf uns gern direkt an.",
  slot_unavailable: "Diese Uhrzeit ist nicht buchbar. Bitte wähle eine andere.",
  slot_full: "Zu dieser Zeit sind wir leider schon voll. Bitte wähle eine andere Uhrzeit.",
};

export async function requestReservation(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const partySize = Number(formData.get("party_size"));
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (
    name.length > FIELD_LIMITS.name ||
    phone.length > FIELD_LIMITS.phone ||
    email.length > FIELD_LIMITS.email ||
    notes.length > FIELD_LIMITS.notes
  ) {
    return { ok: false, error: ERRORS.field_too_long };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return { ok: false, error: "Bitte wähle Datum und Uhrzeit." };
  }
  if (!Number.isInteger(partySize) || partySize < 1) {
    return { ok: false, error: "Bitte gib die Anzahl der Personen an." };
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("request_reservation", {
    p_name: name,
    p_phone: phone,
    p_email: email,
    p_party_size: partySize,
    p_date: date,
    p_time: time,
    p_notes: notes || undefined,
  });

  if (error) {
    return {
      ok: false,
      error: ERRORS[error.message] ?? "Das hat leider nicht geklappt. Bitte versuch es noch einmal oder ruf uns an.",
      retryTime: RETRY_TIME.has(error.message),
    };
  }
  return { ok: true, id: data };
}
