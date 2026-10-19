"use server";

import { getReservationSettings } from "@/lib/data";
import { addDays, isISODate, isTime } from "@/lib/dates";
import { formErrors, formLocale } from "@/lib/form-errors";
import { publicFormClient } from "@/lib/public-forms";
import { FIELD_LIMITS } from "@/lib/reservation-limits";
import { isManageToken } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";

// Everything a guest does with a table: finding a slot, asking for it, the waitlist when the day is
// full, and later moving or cancelling the booking through its manage link.

// ---------------------------------------------------------------- availability
export type Slot = { time: string; seatsLeft: number };
export type UnavailableReason = "closed" | "holiday" | "late" | "paused" | "error";
export type Availability = { slots: Slot[]; reason: UnavailableReason | null };

async function fetchSlots(date: string): Promise<Slot[] | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("reservation_availability", { p_date: date });
  if (error) return null;
  return (data ?? []).map((s) => ({ time: s.slot.slice(0, 5), seatsLeft: s.seats_left }));
}

/** Bookable time slots for a day, or why there are none. Public: backed by the SECURITY DEFINER RPC.
 *  `ownToken` is the manage token of a booking being moved: its seats are given back (see withOwnSeats). */
export async function getAvailability(date: string, ownToken?: string): Promise<Availability> {
  if (!isISODate(date)) return { slots: [], reason: "error" };
  const slots = await fetchSlots(date);
  if (!slots) return { slots: [], reason: "error" };
  if (slots.length > 0) return { slots: ownToken ? await withOwnSeats(slots, date, ownToken) : slots, reason: null };

  // Switched off under Einstellungen: the home page hides the form, the manage page does not.
  if (!(await getReservationSettings()).enabled) return { slots: [], reason: "paused" };

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

/** A booking being moved still counts in its own day's availability, so a party of four on a busy
 *  evening saw every nearby slot as full and the move button stayed disabled. move_reservation_by_token()
 *  cancels the old row before it checks (20261014024537), so the RPC would have said yes; this makes
 *  the client agree with it by handing the booking's own seats back on the slots it overlaps. */
async function withOwnSeats(slots: Slot[], date: string, token: string): Promise<Slot[]> {
  const own = await getReservationByToken(token);
  if (!own || own.date !== date || (own.status !== "pending" && own.status !== "confirmed")) return slots;
  const { duration_minutes: duration, capacity_seats: capacity } = await getReservationSettings();
  const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const start = minutes(own.time);
  return slots.map((s) => {
    const at = minutes(s.time);
    const overlaps = at < start + duration && at + duration > start;
    return overlaps ? { ...s, seatsLeft: Math.min(capacity, s.seatsLeft + own.partySize) } : s;
  });
}

const SEARCH_DAYS = 10;

/**
 * First day on or after `from` (within 10 days) that still has a free slot. `until` is the last bookable
 * date (`max_days_ahead`): searching past it would preselect a day the calendar doesn't offer and
 * `request_reservation` rejects as `too_far_ahead`.
 */
export async function getFirstAvailableDay(from: string, until: string): Promise<{ date: string; slots: Slot[] } | null> {
  if (!isISODate(from) || !isISODate(until) || until < from) return null;
  const days = Array.from({ length: SEARCH_DAYS }, (_, i) => addDays(from, i)).filter((d) => d <= until);
  const results = await Promise.all(days.map(fetchSlots));
  for (let i = 0; i < days.length; i++) {
    const slots = results[i];
    if (slots?.some((s) => s.seatsLeft > 0)) return { date: days[i], slots };
  }
  return null;
}

// ---------------------------------------------------------------- booking
export type RequestState = { ok: true; id: string } | { ok: false; error: string; retryTime?: boolean } | null;

const RETRY_TIME = new Set(["slot_full", "slot_unavailable", "too_soon"]);

export async function requestReservation(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const errorFor = formErrors(formData, (d) => d.reservation.errors);
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
    return { ok: false, error: errorFor("field_too_long") };
  }
  if (!isISODate(date) || !isTime(time)) return { ok: false, error: errorFor("invalid_datetime") };
  if (!Number.isInteger(partySize) || partySize < 1) return { ok: false, error: errorFor("invalid_party_size") };

  const { supabase, allowed } = await publicFormClient("reservation");
  if (!allowed) return { ok: false, error: errorFor("too_many_requests") };
  const { data, error } = await supabase.rpc("request_reservation", {
    p_name: name,
    p_phone: phone,
    p_email: email,
    p_party_size: partySize,
    p_date: date,
    p_time: time,
    p_notes: notes || undefined,
    // So the confirmation e-mail and its management link come back in the language they booked in.
    p_locale: formLocale(formData),
  });
  if (error) return { ok: false, error: errorFor(error.message), retryTime: RETRY_TIME.has(error.message) };
  return { ok: true, id: data };
}

// ---------------------------------------------------------------- waitlist
export type WaitlistState = { ok: true } | { ok: false; error: string } | null;

/** Puts a guest on the waitlist for a day that is already full. */
export async function joinWaitlist(_prev: WaitlistState, formData: FormData): Promise<WaitlistState> {
  const errorFor = formErrors(formData, (d) => d.waitlist.errors);
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const partySize = Number(formData.get("party_size"));
  const preference = String(formData.get("time_preference") ?? "").trim();

  if (name.length > FIELD_LIMITS.name || phone.length > FIELD_LIMITS.phone || email.length > FIELD_LIMITS.email) {
    return { ok: false, error: errorFor("field_too_long") };
  }
  if (!isISODate(date)) return { ok: false, error: errorFor("invalid_date") };
  if (!Number.isInteger(partySize) || partySize < 1) return { ok: false, error: errorFor("invalid_party_size") };

  const { supabase, allowed } = await publicFormClient("waitlist");
  if (!allowed) return { ok: false, error: errorFor("too_many_requests") };
  const { error } = await supabase.rpc("join_waitlist", {
    p_name: name,
    p_phone: phone,
    p_email: email,
    p_date: date,
    p_party_size: partySize,
    p_time_preference: preference || undefined,
  });
  if (error) return { ok: false, error: errorFor(error.message) };
  return { ok: true };
}

// ---------------------------------------------------------------- managing a booking
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

export async function cancelReservation(_prev: ManageState, formData: FormData): Promise<ManageState> {
  const errorFor = formErrors(formData, (d) => d.manage.errors);
  const token = String(formData.get("token") ?? "");
  if (!isManageToken(token)) return { ok: false, error: errorFor("not_found") };
  const supabase = createPublicClient();
  const { error } = await supabase.rpc("cancel_reservation_by_token", { p_token: token });
  if (error) return { ok: false, error: errorFor(error.message) };
  return { ok: true, action: "cancelled" };
}

export async function moveReservation(_prev: ManageState, formData: FormData): Promise<ManageState> {
  const errorFor = formErrors(formData, (d) => d.manage.errors);
  const token = String(formData.get("token") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const partySize = Number(formData.get("party_size"));
  if (!isManageToken(token)) return { ok: false, error: errorFor("not_found") };
  if (!isISODate(date) || !isTime(time)) return { ok: false, error: errorFor("invalid_datetime") };
  if (!Number.isInteger(partySize) || partySize < 1) return { ok: false, error: errorFor("invalid_party_size") };

  const supabase = createPublicClient();
  const { error } = await supabase.rpc("move_reservation_by_token", {
    p_token: token,
    p_date: date,
    p_time: time,
    p_party_size: partySize,
  });
  if (error) return { ok: false, error: errorFor(error.message) };
  return { ok: true, action: "moved" };
}
