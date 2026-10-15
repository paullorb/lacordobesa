"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_RESERVATION_SETTINGS, fmtTime, TAG, type ReservationSettings } from "@/lib/data";
import { staffEmail } from "@/lib/staff";
import { addDays, isISODate, isTime, todayISO } from "@/lib/dates";
import type { Enums, Tables } from "@/lib/database.types";
import { GALLERY_MAX_BYTES, GALLERY_MIME_TYPES, isGalleryCategory } from "@/lib/gallery";
import { mailConfigured, sendMail } from "@/lib/mail";
import { reservationConfirmedMail } from "@/lib/mail-templates";
import { DEFAULT_PREORDER_SETTINGS, MAX_PREORDER_QUANTITY, type PreorderSettings } from "@/lib/preorders";
import { FIELD_LIMITS } from "@/lib/reservation-limits";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";
import {
  parseReviewScores,
  parseRatingValue,
  resolveReviews,
  REVIEW_PLATFORMS,
  REVIEW_SCORES_KEY,
  type ReviewScores,
} from "@/lib/reviews";

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
  const { data: isStaff } = await supabase.rpc("is_staff");
  if (!isStaff) {
    await supabase.auth.signOut();
    return { ok: false, error: "Dieser Zugang ist nicht für das Team freigeschaltet." };
  }
  const next = str(formData, "next");
  redirect(next.startsWith("/staff") ? next : "/staff");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/staff/login");
}

// ---------------------------------------------------------------- reservations
const STATUSES: Enums<"reservation_status">[] = ["pending", "confirmed", "cancelled", "no_show", "completed"];

export async function setReservationStatus(formData: FormData) {
  const { supabase } = await requireStaff();
  const id = str(formData, "id");
  const status = str(formData, "status") as Enums<"reservation_status">;
  if (!STATUSES.includes(status)) return;
  // Returning the row saves a second read, and gives sendConfirmation() the values it needs.
  const { data: updated } = await supabase.from("reservations").update({ status }).eq("id", id).select("*").maybeSingle();
  if (status === "confirmed" && updated) await sendConfirmation(supabase, updated);
  refresh();
}

type StaffClient = Awaited<ReturnType<typeof requireStaff>>["supabase"];

/** Mails the guest that their table is confirmed, and records that it went out.
 *
 *  Never throws and never reports back: confirming a reservation is the important half, so a mail
 *  outage, a missing API key or an unverified sender domain must not undo the staff member's click.
 *  The staff card shows "noch nicht verschickt" with a retry button whenever this did not succeed. */
async function sendConfirmation(supabase: StaffClient, r: Tables<"reservations">) {
  // confirmation_sent_at arrives with migration 20261012094449. Without the column there is nowhere
  // to record the send, and re-confirming would mail the guest again, so sending waits for it.
  if (!("confirmation_sent_at" in r) || r.confirmation_sent_at) return;
  if (!r.email || !mailConfigured()) return;

  // Claimed before sending, not recorded after: two staff confirming the same booking at once (or a
  // double-submitted form) would otherwise both read null and both mail the guest. Only the update
  // that flips null to a timestamp gets a row back, and only that one sends.
  const { data: claimed } = await supabase
    .from("reservations")
    .update({ confirmation_sent_at: new Date().toISOString() })
    .eq("id", r.id)
    .is("confirmation_sent_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return;

  const result = await sendMail({
    to: r.email,
    ...reservationConfirmedMail({
      name: r.name,
      date: r.date,
      time: fmtTime(r.start_time),
      partySize: r.party_size,
      manageToken: r.manage_token ?? null,
      locale: isLocale(r.locale) ? r.locale : DEFAULT_LOCALE,
    }),
  });
  // Released again on failure, so the card offers the retry button.
  if (!result.ok) await supabase.from("reservations").update({ confirmation_sent_at: null }).eq("id", r.id);
}

/** Retry for the staff card, for when the first attempt failed or the guest asks for the mail again. */
export async function resendConfirmation(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { data: r } = await supabase.from("reservations").select("*").eq("id", str(formData, "id")).maybeSingle();
  if (!r) return { ok: false, error: "Diese Reservierung gibt es nicht mehr." };
  if (!r.email) return { ok: false, error: "Für diese Reservierung ist keine E-Mail-Adresse hinterlegt." };
  if (!mailConfigured()) return { ok: false, error: "E-Mail-Versand ist nicht konfiguriert (RESEND_API_KEY und MAIL_FROM fehlen)." };

  const result = await sendMail({
    to: r.email,
    ...reservationConfirmedMail({
      name: r.name,
      date: r.date,
      time: fmtTime(r.start_time),
      partySize: r.party_size,
      manageToken: r.manage_token ?? null,
      locale: isLocale(r.locale) ? r.locale : DEFAULT_LOCALE,
    }),
  });
  if (!result.ok) {
    return { ok: false, error: `Die E-Mail konnte nicht verschickt werden. ${result.detail ?? ""}`.trim() };
  }
  if ("confirmation_sent_at" in r) {
    await supabase.from("reservations").update({ confirmation_sent_at: new Date().toISOString() }).eq("id", r.id);
  }
  refresh();
  return { ok: true };
}

export async function saveStaffNotes(formData: FormData) {
  const { supabase } = await requireStaff();
  await supabase
    .from("reservations")
    .update({ staff_notes: str(formData, "staff_notes") || null })
    .eq("id", str(formData, "id"));
  refresh();
}

/** Walk-in / phone reservation entered by staff.
 *
 *  Bypasses the public capacity check on purpose: a walk-in on a full evening is exactly the
 *  booking the restaurant wants to take. Inserting straight into the table rather than calling
 *  request_reservation() is also what keeps the anon-shaped abuse limits (3 per phone per 24 h, the
 *  site-wide hourly cap) off somebody who is simply answering the phone. */
export async function createReservationManually(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const name = str(formData, "name");
  const phone = str(formData, "phone");
  const email = str(formData, "email");
  const notes = str(formData, "notes");
  const date = str(formData, "date");
  const time = str(formData, "time");
  const party_size = num(formData, "party_size");

  if (!name || !date || !time || party_size < 1) {
    return { ok: false, error: "Name, Datum, Uhrzeit und Personen sind Pflicht." };
  }
  // The same caps the table and the public RPC enforce. Without them an over-long note comes back
  // as a raw Postgres constraint error, which is not something to hand a staff member mid-call.
  if (
    name.length > FIELD_LIMITS.name ||
    phone.length > FIELD_LIMITS.phone ||
    email.length > FIELD_LIMITS.email ||
    notes.length > FIELD_LIMITS.notes
  ) {
    return { ok: false, error: "Eine Eingabe ist zu lang. Bitte kürze sie ein wenig." };
  }
  if (!isISODate(date) || !isTime(time)) {
    return { ok: false, error: "Datum oder Uhrzeit sind ungültig." };
  }

  const { error } = await supabase.from("reservations").insert({
    name,
    phone: phone || "",
    email: email || null,
    party_size,
    date,
    start_time: time,
    notes: notes || null,
    status: "confirmed",
    source: "staff",
  });
  if (error) {
    console.error("createReservationManually", error);
    return { ok: false, error: "Die Reservierung konnte nicht gespeichert werden. Bitte versuch es noch einmal." };
  }
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- waitlist
const WAITLIST_STATUSES: Enums<"waitlist_status">[] = ["waiting", "notified", "converted", "expired", "cancelled"];

export async function setWaitlistStatus(formData: FormData) {
  const { supabase } = await requireStaff();
  const status = str(formData, "status") as Enums<"waitlist_status">;
  if (!WAITLIST_STATUSES.includes(status)) return;
  await supabase.from("waitlist_entries").update({ status }).eq("id", str(formData, "id"));
  refresh();
}

export async function saveWaitlistNotes(formData: FormData) {
  const { supabase } = await requireStaff();
  await supabase
    .from("waitlist_entries")
    .update({ staff_notes: str(formData, "staff_notes") || null })
    .eq("id", str(formData, "id"));
  refresh();
}

// ---------------------------------------------------------------- pre-orders
const PREORDER_STATUSES: Enums<"preorder_status">[] = ["pending", "confirmed", "ready", "collected", "cancelled"];

export async function setPreorderStatus(formData: FormData) {
  const { supabase } = await requireStaff();
  const status = str(formData, "status") as Enums<"preorder_status">;
  if (!PREORDER_STATUSES.includes(status)) return;
  await supabase.from("preorders").update({ status }).eq("id", str(formData, "id"));
  refresh();
}

export async function savePreorderNotes(formData: FormData) {
  const { supabase } = await requireStaff();
  await supabase
    .from("preorders")
    .update({ staff_notes: str(formData, "staff_notes") || null })
    .eq("id", str(formData, "id"));
  refresh();
}

// ---------------------------------------------------------------- event inquiries
const INQUIRY_STATUSES: Enums<"inquiry_status">[] = ["new", "in_progress", "quoted", "won", "lost"];

export async function setInquiryStatus(formData: FormData) {
  const { supabase } = await requireStaff();
  const status = str(formData, "status") as Enums<"inquiry_status">;
  if (!INQUIRY_STATUSES.includes(status)) return;
  await supabase.from("event_inquiries").update({ status }).eq("id", str(formData, "id"));
  refresh();
}

export async function saveInquiryNotes(formData: FormData) {
  const { supabase } = await requireStaff();
  await supabase
    .from("event_inquiries")
    .update({ staff_notes: str(formData, "staff_notes") || null })
    .eq("id", str(formData, "id"));
  refresh();
}

// ---------------------------------------------------------------- menu
export async function saveMenuItem(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const id = str(formData, "id");
  // Category, position and the Startseite flag are set by dragging on the menu page, so an edit
  // leaves them alone. Only a new dish sends them, from hidden fields in its category's form.
  const row = {
    name: str(formData, "name"),
    subtitle: str(formData, "subtitle") || null,
    description: str(formData, "description") || null,
    price_label: str(formData, "price_label") || null,
    is_available: bool(formData, "is_available"),
    // Only sent once migration 20261012102608 added the columns. Empty means "no translation yet",
    // which the public menu falls back from, so it is stored as null rather than "".
    ...(formData.has("translations_field")
      ? {
          description_es: str(formData, "description_es") || null,
          description_en: str(formData, "description_en") || null,
        }
      : {}),
    // Likewise only sent once migration 20261012094815 added the columns. preorder_unit is no
    // longer edited here: new dishes take the column default ("Stück"), existing ones keep theirs.
    ...(formData.has("preorder_field") ? { is_preorderable: bool(formData, "is_preorderable") } : {}),
  };
  if (!row.name) return { ok: false, error: "Name ist Pflicht." };
  const categoryId = str(formData, "category_id");
  if (!id && !categoryId) return { ok: false, error: "Name und Kategorie sind Pflicht." };
  const { error } = id
    ? await supabase.from("menu_items").update(row).eq("id", id)
    : await supabase.from("menu_items").insert({ ...row, category_id: categoryId, sort_order: num(formData, "sort_order") });
  if (error) return { ok: false, error: error.message };
  updateTag(TAG.content);
  refresh();
  return { ok: true };
}

/** UUIDs rather than merely non-empty strings: the reorder RPCs take `uuid[]`, so anything else
 *  comes back from PostgREST as a cast failure in English rather than the sentence below. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isIdList = (ids: unknown): ids is string[] =>
  Array.isArray(ids) && ids.length <= 500 && ids.every((id) => typeof id === "string" && UUID.test(id));

/** Puts `ids` into `categoryId` in that order: what a drag on the menu page ends with. Rows already
 *  in place are left alone by the RPC, so a move near the bottom of a list writes a couple of rows
 *  rather than all of them. */
export async function arrangeMenuItems(categoryId: string, ids: string[]): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  if (typeof categoryId !== "string" || !isIdList(ids)) return { ok: false, error: "Ungültige Reihenfolge." };
  // One statement, in the database (migration 20261015061507). This used to read the current order
  // and then fire an update per moved row through Promise.all: one of them failing, or two people
  // dragging at once, committed part of the new order and left the rest, and returning an error
  // rolled none of it back.
  const { error } = await supabase.rpc("arrange_menu_items", { p_category: categoryId, p_ids: ids });
  updateTag(TAG.content);
  refresh();
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** The order of the categories, top to bottom. */
export async function arrangeCategories(ids: string[]): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  if (!isIdList(ids)) return { ok: false, error: "Ungültige Reihenfolge." };
  // Atomic, for the same reason as arrangeMenuItems above.
  const { error } = await supabase.rpc("arrange_menu_categories", { p_ids: ids });
  updateTag(TAG.content);
  refresh();
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Puts a dish on the home page, or takes it off. */
export async function setMenuItemFeatured(id: string, featured: boolean): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  if (typeof id !== "string" || typeof featured !== "boolean") return { ok: false, error: "Ungültige Anfrage." };
  const { error } = await supabase.from("menu_items").update({ is_featured: featured }).eq("id", id);
  updateTag(TAG.content);
  refresh();
  return error ? { ok: false, error: error.message } : { ok: true };
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
  const id = str(formData, "id");
  const label = str(formData, "label");
  if (!label) return { ok: false, error: "Name ist Pflicht." };
  const row = {
    label,
    label_secondary: str(formData, "label_secondary") || null,
    note: str(formData, "note") || null,
    // Set by dragging; only a new category sends it, to land at the end.
    ...(formData.has("sort_order") ? { sort_order: num(formData, "sort_order") } : {}),
    // Only sent when the form rendered the toggle, i.e. when the show_prices column exists.
    ...(formData.has("show_prices_field") ? { show_prices: bool(formData, "show_prices") } : {}),
  };
  const { error } = id
    ? await supabase.from("menu_categories").update(row).eq("id", id)
    : await supabase.from("menu_categories").insert({
        ...row,
        slug:
          label
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "") || `kategorie-${Date.now()}`,
      });
  if (error) return { ok: false, error: error.code === "23505" ? "Eine Kategorie mit diesem Namen gibt es schon." : error.message };
  updateTag(TAG.content);
  refresh();
  return { ok: true };
}

/** Only empty categories can be deleted (FK is `on delete restrict`). */
export async function deleteCategory(formData: FormData) {
  const { supabase } = await requireStaff();
  await supabase.from("menu_categories").delete().eq("id", str(formData, "id"));
  updateTag(TAG.content);
  refresh();
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

// ---------------------------------------------------------------- specials list
/** The second opt-in step (migration 20261012215041): the guest's WhatsApp message arrived from the
 *  number they signed up with. Only confirmed rows are offered for sending. Throws rather than
 *  returning quietly, so a failed save cannot look like a confirmed guest. */
export async function confirmBroadcastOptin(formData: FormData) {
  const { supabase, user } = await requireStaff();
  const { error } = await supabase
    .from("broadcast_optins")
    .update({ confirmed_at: new Date().toISOString(), confirmed_by: user.id })
    .eq("id", str(formData, "id"))
    .is("confirmed_at", null)
    .is("unsubscribed_at", null);
  if (error) throw new Error(`Die Anmeldung konnte nicht bestätigt werden: ${error.message}`);
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

/** Adds a closure for a single day or a range (one row per day, so availability stays simple). */
export async function addClosure(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const from = str(formData, "from");
  const to = str(formData, "to") || from;
  const reason = str(formData, "reason") || null;
  // isISODate(), not a shape regex: "2026-02-31" matches /^\d{4}-\d{2}-\d{2}$/, so the first row
  // would carry that literal date, Postgres would reject it, and the staff member would get
  // "date/time field value out of range" instead of being told the date is wrong.
  if (!isISODate(from) || !isISODate(to)) return { ok: false, error: "Bitte gib ein gültiges Datum an." };
  if (to < from) return { ok: false, error: "„Bis“ liegt vor „Von“." };
  const rows: { date: string; reason: string | null }[] = [];
  for (let d = from; d <= to && rows.length < 120; d = addDays(d, 1)) rows.push({ date: d, reason });
  if (rows.length >= 120) return { ok: false, error: "Bitte höchstens 120 Tage am Stück eintragen." };
  // Upsert so re-entering an overlapping range just updates the reason.
  const { error } = await supabase.from("closures").upsert(rows, { onConflict: "date" });
  if (error) return { ok: false, error: error.message };
  updateTag(TAG.hours);
  refresh();
  return { ok: true };
}

/** Removes every closure in a contiguous range (used by the "Entfernen" button on a range). */
export async function deleteClosureRange(formData: FormData) {
  const { supabase } = await requireStaff();
  const from = str(formData, "from");
  const to = str(formData, "to") || from;
  // Validated for the same reason addClosure is, and because this one deletes: an unchecked bound
  // reaches the query as-is, and an empty string would widen the range rather than narrow it.
  if (!isISODate(from) || !isISODate(to) || to < from) return;
  await supabase.from("closures").delete().gte("date", from).lte("date", to);
  updateTag(TAG.hours);
  refresh();
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
  // Only written when the form rendered the block, so a checkout without the pre-order migration
  // cannot blank the key.
  const preorders: PreorderSettings | null = formData.has("preorder_settings_field")
    ? {
        enabled: bool(formData, "preorders_enabled"),
        min_lead_hours: num(formData, "preorders_min_lead_hours", DEFAULT_PREORDER_SETTINGS.min_lead_hours),
        max_days_ahead: num(formData, "preorders_max_days_ahead", DEFAULT_PREORDER_SETTINGS.max_days_ahead),
        max_lines: num(formData, "preorders_max_lines", DEFAULT_PREORDER_SETTINGS.max_lines),
        max_quantity: num(formData, "preorders_max_quantity", DEFAULT_PREORDER_SETTINGS.max_quantity),
      }
    : null;
  if (
    preorders &&
    (preorders.min_lead_hours < 0 ||
      preorders.max_days_ahead < 1 ||
      preorders.max_lines < 1 ||
      preorders.max_quantity < 1 ||
      // preorder_lines.quantity is checked against 200 in the database, so a larger setting would
      // let the form accept an order the insert then refuses.
      preorders.max_quantity > MAX_PREORDER_QUANTITY)
  ) {
    return { ok: false, error: "Bitte sinnvolle Werte für Vorbestellungen eintragen." };
  }

  const { error } = await supabase.from("site_settings").upsert([
    { key: "reservations", value: reservations },
    { key: "announcement", value: { text: str(formData, "announcement") } },
    ...(preorders ? [{ key: "preorders", value: preorders }] : []),
  ]);
  if (error) return { ok: false, error: error.message };
  updateTag(TAG.content);
  updateTag(TAG.hours);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- review platforms
/** Saves the rating figures copied off each review platform (home page "Unsere Gäste sagen es besser").
 *
 *  A platform left blank is saved as "no figure", which the page draws as a plain link. The date shown
 *  next to a figure is set here and not typed: it moves to today when the figures change or when
 *  "heute nochmal geprüft" is ticked, and otherwise stays at the day they were last read. */
export async function saveReviewScores(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { data: row } = await supabase.from("site_settings").select("value").eq("key", REVIEW_SCORES_KEY).maybeSingle();
  // What the form was showing: the saved set, or the built-in baseline before the first save.
  const before: ReviewScores = Object.fromEntries(
    resolveReviews(row?.value ?? null).flatMap((r) => (r.score ? [[r.id, r.score]] : [])),
  );
  const today = todayISO();
  const next: ReviewScores = {};
  for (const p of REVIEW_PLATFORMS) {
    const value = str(formData, `${p.id}_value`);
    if (!value) continue;
    const scale = str(formData, `${p.id}_scale`) || p.scale;
    const rating = parseRatingValue(value);
    const scaleNum = parseRatingValue(scale);
    if (rating === null || scaleNum === null || scaleNum <= 0 || rating < 0 || rating > scaleNum) {
      return { ok: false, error: `${p.name}: Bitte eine Bewertung zwischen 0 und ${scale} eintragen, z. B. 4,6.` };
    }
    const countText = str(formData, `${p.id}_count`);
    const count = countText ? Number(countText) : null;
    if (count !== null && (!Number.isInteger(count) || count < 1 || count > 1_000_000)) {
      return { ok: false, error: `${p.name}: Die Anzahl der Bewertungen muss eine ganze Zahl sein (oder leer).` };
    }
    const old = before[p.id];
    const unchanged = old && old.value === value && old.scale === scale && old.count === count;
    next[p.id] = {
      value,
      scale,
      count,
      checked: unchanged && old.checked && !bool(formData, `${p.id}_recheck`) ? old.checked : today,
    };
  }
  // Same validation the page applies on the way out, so nothing unreadable is ever stored.
  const clean = parseReviewScores(next);
  const { error } = await supabase.from("site_settings").upsert({ key: REVIEW_SCORES_KEY, value: clean });
  if (error) return { ok: false, error: error.message };
  updateTag(TAG.content);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- gallery
const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function uploadGalleryImage(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const file = formData.get("file");
  const category = str(formData, "category");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Bitte wähle ein Bild aus." };
  if (!GALLERY_MIME_TYPES.includes(file.type)) return { ok: false, error: "Nur JPG, PNG oder WebP sind erlaubt." };
  if (file.size > GALLERY_MAX_BYTES) return { ok: false, error: "Das Bild ist größer als 5 MB." };
  if (!isGalleryCategory(category)) return { ok: false, error: "Bitte wähle eine Kategorie." };

  const path = `${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
  const { error: uploadError } = await supabase.storage.from("gallery").upload(path, file, { contentType: file.type });
  if (uploadError) return { ok: false, error: "Das Bild konnte nicht hochgeladen werden." };

  const { error } = await supabase.from("gallery_items").insert({
    image_url: supabase.storage.from("gallery").getPublicUrl(path).data.publicUrl,
    storage_path: path,
    caption: str(formData, "caption").slice(0, 160) || null,
    category,
  });
  if (error) {
    await supabase.storage.from("gallery").remove([path]);
    return { ok: false, error: error.message };
  }
  updateTag(TAG.gallery);
  refresh();
  return { ok: true };
}

export async function saveGalleryItem(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const category = str(formData, "category");
  if (!isGalleryCategory(category)) return { ok: false, error: "Bitte wähle eine Kategorie." };
  const { error } = await supabase
    .from("gallery_items")
    .update({
      caption: str(formData, "caption").slice(0, 160) || null,
      category,
      // Only sent once migration 20261012101400 added the column.
      ...(formData.has("featured_field") ? { is_featured: bool(formData, "is_featured") } : {}),
    })
    .eq("id", str(formData, "id"));
  if (error) return { ok: false, error: error.message };
  updateTag(TAG.gallery);
  refresh();
  return { ok: true };
}

export async function deleteGalleryItem(formData: FormData) {
  const { supabase } = await requireStaff();
  const id = str(formData, "id");
  const { data } = await supabase.from("gallery_items").select("storage_path").eq("id", id).maybeSingle();
  // Remove the object first: dropping the row before it would lose the path needed to retry the cleanup.
  if (data?.storage_path) {
    const { error: storageError } = await supabase.storage.from("gallery").remove([data.storage_path]);
    if (storageError) return;
  }
  const { error } = await supabase.from("gallery_items").delete().eq("id", id);
  if (error) return;
  updateTag(TAG.gallery);
  refresh();
}

/** Picks the big photo in the "Besuch uns" section, or clears it when called without an id.
 *  One choice, so it lives in site_settings rather than as a flag two rows could both carry. */
export async function setHeroImage(formData: FormData) {
  const { supabase } = await requireStaff();
  const id = str(formData, "id");
  await supabase.from("site_settings").upsert({ key: "hero", value: id ? { gallery_item_id: id } : {} });
  updateTag(TAG.gallery);
  refresh();
}
