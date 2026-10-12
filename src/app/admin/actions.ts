"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_RESERVATION_SETTINGS, TAG, type ReservationSettings } from "@/lib/data";
import { staffEmail } from "@/lib/staff";
import type { Enums } from "@/lib/database.types";

export type ActionResult = { ok: true } | { ok: false; error: string } | null;

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const num = (fd: FormData, key: string, fallback = 0) => {
  const n = Number(fd.get(key));
  return Number.isFinite(n) ? n : fallback;
};
const bool = (fd: FormData, key: string) => fd.get(key) === "on" || fd.get(key) === "true";

// ---------------------------------------------------------------- auth
export async function signIn(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: staffEmail(str(formData, "username")),
    password: String(formData.get("password") ?? ""),
  });
  if (error) return { ok: false, error: "Name oder Passwort stimmen nicht." };
  const next = str(formData, "next");
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

// ---------------------------------------------------------------- reservations
const STATUSES: Enums<"reservation_status">[] = ["pending", "confirmed", "cancelled", "no_show", "completed"];

export async function setReservationStatus(formData: FormData) {
  const { supabase } = await requireStaff();
  const id = str(formData, "id");
  const status = str(formData, "status") as Enums<"reservation_status">;
  if (!STATUSES.includes(status)) return;
  await supabase.from("reservations").update({ status }).eq("id", id);
  refresh();
}

export async function saveStaffNotes(formData: FormData) {
  const { supabase } = await requireStaff();
  await supabase
    .from("reservations")
    .update({ staff_notes: str(formData, "staff_notes") || null })
    .eq("id", str(formData, "id"));
  refresh();
}

/** Walk-in / phone reservation entered by staff. Bypasses the public capacity check on purpose. */
export async function createReservationManually(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const name = str(formData, "name");
  const phone = str(formData, "phone");
  const date = str(formData, "date");
  const time = str(formData, "time");
  const party_size = num(formData, "party_size");
  if (!name || !date || !time || party_size < 1) return { ok: false, error: "Name, Datum, Uhrzeit und Personen sind Pflicht." };
  const { error } = await supabase.from("reservations").insert({
    name,
    phone: phone || "—",
    email: str(formData, "email") || null,
    party_size,
    date,
    start_time: time,
    notes: str(formData, "notes") || null,
    status: "confirmed",
    source: "staff",
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- menu
export async function saveMenuItem(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const id = str(formData, "id");
  const row = {
    category_id: str(formData, "category_id"),
    name: str(formData, "name"),
    subtitle: str(formData, "subtitle") || null,
    description: str(formData, "description") || null,
    price_label: str(formData, "price_label") || null,
    is_available: bool(formData, "is_available"),
    is_featured: bool(formData, "is_featured"),
    sort_order: num(formData, "sort_order"),
  };
  if (!row.name || !row.category_id) return { ok: false, error: "Name und Kategorie sind Pflicht." };
  const { error } = id
    ? await supabase.from("menu_items").update(row).eq("id", id)
    : await supabase.from("menu_items").insert(row);
  if (error) return { ok: false, error: error.message };
  updateTag(TAG.content);
  refresh();
  return { ok: true };
}

export async function deleteMenuItem(formData: FormData) {
  const { supabase } = await requireStaff();
  await supabase.from("menu_items").delete().eq("id", str(formData, "id"));
  updateTag(TAG.content);
  refresh();
}

export async function toggleMenuItemAvailable(formData: FormData) {
  const { supabase } = await requireStaff();
  await supabase
    .from("menu_items")
    .update({ is_available: bool(formData, "is_available") })
    .eq("id", str(formData, "id"));
  updateTag(TAG.content);
  refresh();
}

export async function saveCategory(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const label = str(formData, "label");
  if (!label) return { ok: false, error: "Name ist Pflicht." };
  const slug =
    str(formData, "slug") ||
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  const { error } = await supabase.from("menu_categories").insert({ label, slug, sort_order: num(formData, "sort_order") });
  if (error) return { ok: false, error: error.message };
  updateTag(TAG.content);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- specials
export async function saveSpecial(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const id = str(formData, "id");
  const row = {
    title: str(formData, "title"),
    description: str(formData, "description") || null,
    starts_on: str(formData, "starts_on"),
    ends_on: str(formData, "ends_on") || null,
    is_active: bool(formData, "is_active"),
  };
  if (!row.title || !row.starts_on) return { ok: false, error: "Titel und Startdatum sind Pflicht." };
  const { error } = id ? await supabase.from("specials").update(row).eq("id", id) : await supabase.from("specials").insert(row);
  if (error) return { ok: false, error: error.message };
  updateTag(TAG.content);
  refresh();
  return { ok: true };
}

export async function deleteSpecial(formData: FormData) {
  const { supabase } = await requireStaff();
  await supabase.from("specials").delete().eq("id", str(formData, "id"));
  updateTag(TAG.content);
  refresh();
}

// ---------------------------------------------------------------- hours & closures
export async function saveOpeningHours(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const rows = [0, 1, 2, 3, 4, 5, 6].map((wd) => {
    const closed = bool(formData, `closed_${wd}`);
    return {
      weekday: wd,
      is_closed: closed,
      opens: closed ? null : str(formData, `opens_${wd}`) || null,
      closes: closed ? null : str(formData, `closes_${wd}`) || null,
    };
  });
  for (const r of rows) {
    if (!r.is_closed && (!r.opens || !r.closes || r.opens >= r.closes)) {
      return { ok: false, error: "Bitte für jeden geöffneten Tag gültige Zeiten eintragen (Öffnen vor Schließen)." };
    }
  }
  const { error } = await supabase.from("opening_hours").upsert(rows);
  if (error) return { ok: false, error: error.message };
  updateTag(TAG.hours);
  refresh();
  return { ok: true };
}

export async function addClosure(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const date = str(formData, "date");
  if (!date) return { ok: false, error: "Datum fehlt." };
  const { error } = await supabase.from("closures").insert({ date, reason: str(formData, "reason") || null });
  if (error) return { ok: false, error: error.code === "23505" ? "Dieser Tag ist schon eingetragen." : error.message };
  updateTag(TAG.hours);
  refresh();
  return { ok: true };
}

export async function deleteClosure(formData: FormData) {
  const { supabase } = await requireStaff();
  await supabase.from("closures").delete().eq("id", str(formData, "id"));
  updateTag(TAG.hours);
  refresh();
}

// ---------------------------------------------------------------- settings
export async function saveSettings(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const reservations: ReservationSettings = {
    enabled: bool(formData, "enabled"),
    slot_minutes: num(formData, "slot_minutes", DEFAULT_RESERVATION_SETTINGS.slot_minutes),
    duration_minutes: num(formData, "duration_minutes", DEFAULT_RESERVATION_SETTINGS.duration_minutes),
    capacity_seats: num(formData, "capacity_seats", DEFAULT_RESERVATION_SETTINGS.capacity_seats),
    max_party_size: num(formData, "max_party_size", DEFAULT_RESERVATION_SETTINGS.max_party_size),
    min_lead_hours: num(formData, "min_lead_hours", DEFAULT_RESERVATION_SETTINGS.min_lead_hours),
    max_days_ahead: num(formData, "max_days_ahead", DEFAULT_RESERVATION_SETTINGS.max_days_ahead),
    last_seating_minutes_before_close: num(
      formData,
      "last_seating_minutes_before_close",
      DEFAULT_RESERVATION_SETTINGS.last_seating_minutes_before_close,
    ),
  };
  if (
    reservations.slot_minutes < 5 ||
    reservations.duration_minutes < 15 ||
    reservations.capacity_seats < 1 ||
    reservations.max_party_size < 1 ||
    reservations.min_lead_hours < 0 ||
    reservations.max_days_ahead < 1 ||
    reservations.last_seating_minutes_before_close < 0
  ) {
    return { ok: false, error: "Bitte sinnvolle Werte eintragen (Dauer mindestens 15 Minuten, Raster mindestens 5)." };
  }
  const { error } = await supabase.from("site_settings").upsert([
    { key: "reservations", value: reservations },
    { key: "announcement", value: { text: str(formData, "announcement") } },
  ]);
  if (error) return { ok: false, error: error.message };
  updateTag(TAG.content);
  updateTag(TAG.hours);
  refresh();
  return { ok: true };
}
