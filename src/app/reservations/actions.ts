"use server";

import { createPublicClient } from "@/lib/supabase/public";

export type Slot = { time: string; seatsLeft: number };

/** Bookable time slots for a day. Public: backed by the SECURITY DEFINER RPC. */
export async function getAvailability(date: string): Promise<Slot[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("reservation_availability", { p_date: date });
  if (error) return [];
  return (data ?? []).map((s) => ({ time: s.slot.slice(0, 5), seatsLeft: s.seats_left }));
}

export type RequestState = { ok: true; id: string } | { ok: false; error: string } | null;

const ERRORS: Record<string, string> = {
  reservations_disabled: "Online-Reservierungen sind gerade nicht möglich. Ruf uns gern an.",
  invalid_contact: "Bitte gib deinen Namen und eine Telefonnummer an.",
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
    return { ok: false, error: ERRORS[error.message] ?? "Das hat leider nicht geklappt. Bitte versuch es noch einmal oder ruf uns an." };
  }
  return { ok: true, id: data };
}
