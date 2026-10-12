"use server";

import { isManageToken } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";

/** What the guest is allowed to see about their own booking. Mirrors reservation_by_token(). */
export type GuestReservation = {
  name: string;
  date: string;
  time: string;
  partySize: number;
  status: "pending" | "confirmed" | "cancelled" | "no_show" | "completed";
  notes: string | null;
  changesLeft: number;
};

/** Looks a booking up by its manage token, or null if the token is unknown. */
export async function getReservationByToken(token: string): Promise<GuestReservation | null> {
  if (!isManageToken(token)) return null;
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("reservation_by_token", { p_token: token });
  const row = data?.[0];
  if (error || !row) return null;
  return {
    name: row.name,
    date: row.res_date,
    time: row.start_time.slice(0, 5),
    partySize: row.party_size,
    status: row.status,
    notes: row.notes,
    changesLeft: row.changes_left,
  };
}

export type ManageState = { ok: true; action: "cancelled" | "moved" } | { ok: false; error: string } | null;

const ERRORS: Record<string, string> = {
  not_found: "Dieser Link gehört zu keiner Reservierung mehr. Bitte ruf uns kurz an.",
  not_cancellable: "Diese Reservierung lässt sich nicht mehr ändern. Bitte ruf uns kurz an.",
  in_the_past: "Dieser Termin liegt bereits in der Vergangenheit.",
  too_many_changes: "Diese Reservierung wurde schon mehrmals verschoben. Bitte ruf uns kurz an, dann finden wir einen Termin.",
  reservations_disabled: "Online-Änderungen sind gerade nicht möglich. Ruf uns gern an.",
  party_too_large: "Für so große Gruppen ruf uns bitte kurz an, wir finden eine Lösung.",
  too_far_ahead: "So weit im Voraus können wir noch nicht reservieren.",
  too_soon: "Für diese Uhrzeit ist es leider zu kurzfristig. Ruf uns gern direkt an.",
  slot_unavailable: "Diese Uhrzeit ist nicht buchbar. Bitte wähle eine andere.",
  slot_full: "Zu dieser Zeit sind wir leider schon voll. Bitte wähle eine andere Uhrzeit.",
};

const message = (code: string) => ERRORS[code] ?? "Das hat leider nicht geklappt. Bitte versuch es noch einmal oder ruf uns an.";

export async function cancelReservation(_prev: ManageState, formData: FormData): Promise<ManageState> {
  const token = String(formData.get("token") ?? "");
  if (!isManageToken(token)) return { ok: false, error: ERRORS.not_found };
  const supabase = createPublicClient();
  const { error } = await supabase.rpc("cancel_reservation_by_token", { p_token: token });
  if (error) return { ok: false, error: message(error.message) };
  return { ok: true, action: "cancelled" };
}

export async function moveReservation(_prev: ManageState, formData: FormData): Promise<ManageState> {
  const token = String(formData.get("token") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const partySize = Number(formData.get("party_size"));
  if (!isManageToken(token)) return { ok: false, error: ERRORS.not_found };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return { ok: false, error: "Bitte wähle Datum und Uhrzeit." };
  }
  if (!Number.isInteger(partySize) || partySize < 1) {
    return { ok: false, error: "Bitte gib die Anzahl der Personen an." };
  }
  const supabase = createPublicClient();
  const { error } = await supabase.rpc("move_reservation_by_token", {
    p_token: token,
    p_date: date,
    p_time: time,
    p_party_size: partySize,
  });
  if (error) return { ok: false, error: message(error.message) };
  return { ok: true, action: "moved" };
}
