"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { createClient } from "@/lib/supabase/server";
import { fmtTime, TAG } from "@/lib/data";
import { STAFF_EMAIL_DOMAIN, staffEmail } from "@/lib/staff";
import { addDays, hasStarted, isISODate, isTime, todayISO } from "@/lib/dates";
import type { Enums, Tables } from "@/lib/database.types";
import { GALLERY_MAX_BYTES, GALLERY_MIME_TYPES, isGalleryCategory } from "@/lib/gallery";
import { mailConfigured, sendMail } from "@/lib/mail";
import { reservationConfirmedMail } from "@/lib/mail-templates";
import { isPreparation } from "@/lib/preorder-preparation";
import { MAX_PREORDER_QUANTITY } from "@/lib/preorders";
import { effectiveReservationSettings, mergePreorderSettings, mergeReservationSettings, reservationFormError } from "@/lib/settings-merge";
import { FIELD_LIMITS } from "@/lib/reservation-limits";
import { hashInviteToken, inviteExpiry, inviteUrl, MAX_PENDING_INVITES, newInviteToken } from "@/lib/staff-signup";
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
/** A whole number from a field, `fallback` when the field is missing, blank or not a number. Truncated,
 *  because every numeric field here is a count or a number of minutes and the SQL side casts the
 *  stored text with `::int`, which raises on "7.5" and would take availability down for every guest. */
const num = (fd: FormData, key: string, fallback = 0) => {
  const raw = fd.get(key);
  if (raw === null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};
const bool = (fd: FormData, key: string) => fd.get(key) === "on" || fd.get(key) === "true";

/** A failed write, as the typed result every staff control shows. The database's own message goes to
 *  the log: it is English, it names constraints, and it is not something to read to a staff member
 *  mid-service. */
function failed(what: string, error: { message: string }): { ok: false; error: string } {
  console.error(what, error);
  return { ok: false, error: "No se pudo guardar. Intentá de nuevo." };
}

/** The `staff_notes_len` check on every table that has one (migrations 20261012054547 and siblings). */
const STAFF_NOTES_MAX = 2000;

/** The note to store, or the sentence to show. Checked here so an over-long note never reaches
 *  Postgres, whose answer would be a constraint violation and a note that silently did not save. */
function staffNotes(formData: FormData): { value: string | null } | { error: string } {
  const value = str(formData, "staff_notes");
  if (value.length > STAFF_NOTES_MAX) return { error: `La nota es demasiado larga (máximo ${STAFF_NOTES_MAX} caracteres).` };
  return { value: value || null };
}

// ---------------------------------------------------------------- auth
export async function signIn(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: staffEmail(str(formData, "username")),
    password: String(formData.get("password") ?? ""),
  });
  if (error) return { ok: false, error: "El nombre de usuario o la contraseña no coinciden." };
  const { data: isStaff } = await supabase.rpc("is_staff");
  if (!isStaff) {
    await supabase.auth.signOut();
    return { ok: false, error: "Esta cuenta no tiene acceso al equipo." };
  }
  const next = str(formData, "next");
  redirect(next.startsWith("/staff") ? next : "/staff");
}

export async function signOut(formData?: FormData) {
  const supabase = await createClient();
  // The iPhone app sends its push token along (sign-out-button.tsx); remove it while the session
  // still exists, since unregister_push_token() only deletes the caller's own rows.
  const pushToken = formData ? str(formData, "push_token") : "";
  if (pushToken) {
    const { error } = await supabase.rpc("unregister_push_token", { p_token: pushToken });
    if (error) console.error("signOut push token", error);
  }
  await supabase.auth.signOut();
  redirect("/staff/login");
}

// ---------------------------------------------------------------- reservations
const STATUSES: Enums<"reservation_status">[] = ["pending", "confirmed", "cancelled", "no_show", "completed"];

export async function setReservationStatus(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const id = str(formData, "id");
  const status = str(formData, "status") as Enums<"reservation_status">;
  if (!STATUSES.includes(status)) return { ok: false, error: "La solicitud no es válida." };

  const moved = await moveReservationStatus(supabase, id, status);
  if (moved.failed) return { ok: false, error: "No se pudo guardar. Intentá de nuevo." };
  const updated = moved.row;
  if (status === "confirmed" && updated) await sendConfirmation(supabase, updated);
  // Always, including every way the move can decline. Each of those means the control came from a
  // view that is out of date, and the staff member is looking at exactly the card that has to be
  // re-rendered; returning without it left the losing browser showing the stale card and its
  // now-invalid buttons, so the click appeared to do nothing at all.
  refresh();
  return { ok: true };
}

/**
 * The transition, or null when the booking has moved on since the card was drawn.
 *
 * The card's time boundary is a render-time value, so a page left open across a booking's start can
 * still submit the control it was drawn with. Checked again here, because the wrong outcome is
 * recorded for a real guest: a stale "Stornieren" cancelled a booking that had already begun, and a
 * stale "Erledigt" would close one that has not.
 *
 * `started` is the card's own rule, not just the clock: only a *confirmed* booking swaps its actions
 * at the start time. A booking still pending after its start keeps "Stornieren" and is offered no
 * outcome, so refusing that cancellation would leave staff having to confirm an expired booking,
 * and mail the guest an obsolete confirmation, before they could record how it went. This refuses
 * exactly what the card refuses to show.
 *
 * The update then carries the status the check validated, so the two are one decision. Unconstrained,
 * two staff acting at once could cancel a booking the other had just confirmed: the read saw
 * `pending`, allowed it, and the write landed on a `confirmed` row that had already started, which is
 * the outcome the check exists to forbid. Returning the row also saves a second read and gives
 * sendConfirmation() the values it needs.
 */
async function moveReservationStatus(
  supabase: StaffClient,
  id: string,
  status: Enums<"reservation_status">,
): Promise<{ row: Tables<"reservations"> | null; failed: boolean }> {
  const { data: when, error: readError } = await supabase
    .from("reservations")
    .select("date, start_time, status")
    .eq("id", id)
    .maybeSingle();
  if (readError) {
    console.error("moveReservationStatus read", readError);
    return { row: null, failed: true };
  }
  if (!when) return { row: null, failed: false };

  const started = when.status === "confirmed" && hasStarted(when.date, when.start_time);
  if (status === "cancelled" && started) return { row: null, failed: false };
  if ((status === "completed" || status === "no_show") && !started) return { row: null, failed: false };

  const { data: updated, error } = await supabase
    .from("reservations")
    .update({ status })
    .eq("id", id)
    .eq("status", when.status)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("moveReservationStatus update", error);
    return { row: null, failed: true };
  }
  return { row: updated, failed: false };
}

type StaffClient = Awaited<ReturnType<typeof requireStaff>>["supabase"];

/** Mails the guest that their table is confirmed, and records that it went out.
 *
 *  Never throws and never reports back: confirming a reservation is the important half, so a mail
 *  outage, a missing API key or an unverified sender domain must not undo the staff member's click.
 *  The staff card shows "noch nicht verschickt" with a retry button whenever this did not succeed. */
async function sendConfirmation(supabase: StaffClient, r: Tables<"reservations">) {
  if (r.confirmation_sent_at) return;
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
  if (!result.ok) {
    const { error } = await supabase.from("reservations").update({ confirmation_sent_at: null }).eq("id", r.id);
    if (error) console.error("sendConfirmation release", error);
  }
}

/** Retry for the staff card, for when the first attempt failed or the guest asks for the mail again. */
export async function resendConfirmation(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { data: r } = await supabase.from("reservations").select("*").eq("id", str(formData, "id")).maybeSingle();
  if (!r) return { ok: false, error: "Esta reserva ya no existe." };
  if (!r.email) return { ok: false, error: "Esta reserva no tiene un correo electrónico registrado." };
  if (!mailConfigured()) return { ok: false, error: "El envío de correos no está configurado (faltan RESEND_API_KEY y MAIL_FROM)." };

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
    return { ok: false, error: `No se pudo enviar el correo. ${result.detail ?? ""}`.trim() };
  }
  const { error } = await supabase.from("reservations").update({ confirmation_sent_at: new Date().toISOString() }).eq("id", r.id);
  if (error) {
    console.error("resendConfirmation record", error);
    return { ok: false, error: "El correo se envió, pero no se pudo anotar. Revisá la reserva antes de reenviarlo." };
  }
  refresh();
  return { ok: true };
}

export async function saveStaffNotes(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const notes = staffNotes(formData);
  if ("error" in notes) return { ok: false, error: notes.error };
  const { error } = await supabase.from("reservations").update({ staff_notes: notes.value }).eq("id", str(formData, "id"));
  if (error) return failed("saveStaffNotes", error);
  refresh();
  return { ok: true };
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
    return { ok: false, error: "Nombre, fecha, hora y cantidad de personas son obligatorios." };
  }
  // The same caps the table and the public RPC enforce. Without them an over-long note comes back
  // as a raw Postgres constraint error, which is not something to hand a staff member mid-call.
  if (
    name.length > FIELD_LIMITS.name ||
    phone.length > FIELD_LIMITS.phone ||
    email.length > FIELD_LIMITS.email ||
    notes.length > FIELD_LIMITS.notes
  ) {
    return { ok: false, error: "Un campo es demasiado largo. Acortalo un poco." };
  }
  if (!isISODate(date) || !isTime(time)) {
    return { ok: false, error: "La fecha o la hora no son válidas." };
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
    return { ok: false, error: "No se pudo guardar la reserva. Intentá de nuevo." };
  }
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- waitlist
const WAITLIST_STATUSES: Enums<"waitlist_status">[] = ["waiting", "notified", "converted", "expired", "cancelled"];

export async function setWaitlistStatus(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const status = str(formData, "status") as Enums<"waitlist_status">;
  if (!WAITLIST_STATUSES.includes(status)) return { ok: false, error: "La solicitud no es válida." };
  const { error } = await supabase.from("waitlist_entries").update({ status }).eq("id", str(formData, "id"));
  if (error) return failed("setWaitlistStatus", error);
  refresh();
  return { ok: true };
}

export async function saveWaitlistNotes(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const notes = staffNotes(formData);
  if ("error" in notes) return { ok: false, error: notes.error };
  const { error } = await supabase.from("waitlist_entries").update({ staff_notes: notes.value }).eq("id", str(formData, "id"));
  if (error) return failed("saveWaitlistNotes", error);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- pre-orders
const PREORDER_STATUSES: Enums<"preorder_status">[] = ["pending", "confirmed", "ready", "collected", "cancelled"];

export async function setPreorderStatus(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const status = str(formData, "status") as Enums<"preorder_status">;
  if (!PREORDER_STATUSES.includes(status)) return { ok: false, error: "La solicitud no es válida." };
  const { error } = await supabase.from("preorders").update({ status }).eq("id", str(formData, "id"));
  if (error) return failed("setPreorderStatus", error);
  refresh();
  return { ok: true };
}

export async function savePreorderNotes(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const notes = staffNotes(formData);
  if ("error" in notes) return { ok: false, error: notes.error };
  const { error } = await supabase.from("preorders").update({ staff_notes: notes.value }).eq("id", str(formData, "id"));
  if (error) return failed("savePreorderNotes", error);
  refresh();
  return { ok: true };
}

/** A pre-order taken on the phone or at the counter.
 *
 *  Like createReservationManually(): straight into the table, so the public quotas and the lead
 *  time do not apply to someone answering the phone. The lines still come from the menu, so the
 *  name, unit and price are snapshotted exactly as request_preorder() does it, inside
 *  create_preorder_manually(). Pack sizes are not
 *  enforced here: a regular who wants eight empanadas can have eight. */
export async function createPreorderManually(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const name = str(formData, "name");
  const phone = str(formData, "phone");
  const notes = str(formData, "notes");
  const date = str(formData, "pickup_date");
  const time = str(formData, "pickup_time");
  // Optional here: a regular on the phone may not have said, and the card simply shows no badge then.
  const preparationField = str(formData, "preparation");
  const chosenPreparation = isPreparation(preparationField) ? preparationField : null;

  const quantities = new Map<string, number>();
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("qty-")) continue;
    const n = Number(value);
    if (Number.isInteger(n) && n > 0) quantities.set(key.slice(4), n);
  }

  if (!name || !date || !time) return { ok: false, error: "Nombre, fecha y hora de retiro son obligatorios." };
  if (quantities.size === 0) return { ok: false, error: "Agregá al menos un plato con su cantidad." };
  if (name.length > FIELD_LIMITS.name || phone.length > FIELD_LIMITS.phone || notes.length > FIELD_LIMITS.notes) {
    return { ok: false, error: "Un campo es demasiado largo. Acortalo un poco." };
  }
  if (!isISODate(date) || !isTime(time)) return { ok: false, error: "La fecha o la hora no son válidas." };
  if ([...quantities.values()].some((n) => n > MAX_PREORDER_QUANTITY)) {
    return { ok: false, error: `Máximo ${MAX_PREORDER_QUANTITY} por plato.` };
  }

  // One database function, one transaction: the order and all its lines commit together or not at all.
  const { error } = await supabase.rpc("create_preorder_manually", {
    p_name: name,
    p_phone: phone,
    p_pickup_date: date,
    p_pickup_time: time,
    p_notes: notes,
    p_preparation: chosenPreparation ?? "",
    p_lines: [...quantities].map(([item_id, quantity]) => ({ item_id, quantity })),
  });
  if (error) {
    console.error("createPreorderManually", error);
    return {
      ok: false,
      error: error.message.includes("item_unavailable")
        ? "Uno de los platos ya no está disponible."
        : "No se pudo guardar el pedido. Intentá de nuevo.",
    };
  }
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- event inquiries
const INQUIRY_STATUSES: Enums<"inquiry_status">[] = ["new", "in_progress", "quoted", "won", "lost"];

export async function setInquiryStatus(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const status = str(formData, "status") as Enums<"inquiry_status">;
  if (!INQUIRY_STATUSES.includes(status)) return { ok: false, error: "La solicitud no es válida." };
  const { error } = await supabase.from("event_inquiries").update({ status }).eq("id", str(formData, "id"));
  if (error) return failed("setInquiryStatus", error);
  refresh();
  return { ok: true };
}

export async function saveInquiryNotes(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const notes = staffNotes(formData);
  if ("error" in notes) return { ok: false, error: notes.error };
  const { error } = await supabase.from("event_inquiries").update({ staff_notes: notes.value }).eq("id", str(formData, "id"));
  if (error) return failed("saveInquiryNotes", error);
  refresh();
  return { ok: true };
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
    // Not here: availability is the "Ausverkauft melden" button's job (toggleMenuItemAvailable), so a
    // save cannot undo it. A new dish takes the column default, which is available.
    // Not here either: the Spanish and English descriptions have no field on this form any more.
    // Leaving description_es / description_en out of the row means an update does not touch them,
    // so whatever translation is stored stays stored.
    // preorder_unit is not edited here: new dishes take the column default ("Stück"), existing ones keep theirs.
    is_preorderable: bool(formData, "is_preorderable"),
  };
  if (!row.name) return { ok: false, error: "El nombre es obligatorio." };
  const categoryId = str(formData, "category_id");
  if (!id && !categoryId) return { ok: false, error: "El nombre y la categoría son obligatorios." };
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
  if (typeof categoryId !== "string" || !isIdList(ids)) return { ok: false, error: "El orden no es válido." };
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
  if (!isIdList(ids)) return { ok: false, error: "El orden no es válido." };
  // Atomic, for the same reason as arrangeMenuItems above.
  const { error } = await supabase.rpc("arrange_menu_categories", { p_ids: ids });
  updateTag(TAG.content);
  refresh();
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Puts a dish on the home page, or takes it off. */
export async function setMenuItemFeatured(id: string, featured: boolean): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  if (typeof id !== "string" || typeof featured !== "boolean") return { ok: false, error: "La solicitud no es válida." };
  const { error } = await supabase.from("menu_items").update({ is_featured: featured }).eq("id", id);
  updateTag(TAG.content);
  refresh();
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteMenuItem(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("menu_items").delete().eq("id", str(formData, "id"));
  if (error) return failed("deleteMenuItem", error);
  updateTag(TAG.content);
  refresh();
  return { ok: true };
}

export async function toggleMenuItemAvailable(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { error } = await supabase
    .from("menu_items")
    .update({ is_available: bool(formData, "is_available") })
    .eq("id", str(formData, "id"));
  if (error) return failed("toggleMenuItemAvailable", error);
  updateTag(TAG.content);
  refresh();
  return { ok: true };
}

export async function saveCategory(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const id = str(formData, "id");
  const label = str(formData, "label");
  if (!label) return { ok: false, error: "El nombre es obligatorio." };
  const row = {
    label,
    label_secondary: str(formData, "label_secondary") || null,
    note: str(formData, "note") || null,
    // Set by dragging; only a new category sends it, to land at the end.
    ...(formData.has("sort_order") ? { sort_order: num(formData, "sort_order") } : {}),
    // show_prices is not edited here any more, so a save leaves the column as it is.
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
  if (error) return { ok: false, error: error.code === "23505" ? "Ya existe una categoría con ese nombre." : error.message };
  updateTag(TAG.content);
  refresh();
  return { ok: true };
}

/** Only empty categories can be deleted (FK is `on delete restrict`). */
export async function deleteCategory(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("menu_categories").delete().eq("id", str(formData, "id"));
  // 23503: still holds dishes (the foreign key is `on delete restrict`).
  if (error) {
    if (error.code === "23503") return { ok: false, error: "La categoría todavía tiene platos. Movelos o eliminalos primero." };
    return failed("deleteCategory", error);
  }
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
  if (!row.title || !row.starts_on) return { ok: false, error: "El título y la fecha de inicio son obligatorios." };
  // Both dates are checked here, so a mistyped one is a sentence and not Postgres's check-constraint
  // message (an end before the start violates the table's own check).
  if (!isISODate(row.starts_on) || (row.ends_on !== null && !isISODate(row.ends_on))) {
    return { ok: false, error: "La fecha no es válida." };
  }
  if (row.ends_on !== null && row.ends_on < row.starts_on) {
    return { ok: false, error: "La fecha final es anterior a la fecha de inicio." };
  }
  const { error } = id ? await supabase.from("specials").update(row).eq("id", id) : await supabase.from("specials").insert(row);
  if (error) return failed("saveSpecial", error);
  updateTag(TAG.content);
  refresh();
  return { ok: true };
}

export async function deleteSpecial(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("specials").delete().eq("id", str(formData, "id"));
  if (error) return failed("deleteSpecial", error);
  updateTag(TAG.content);
  refresh();
  return { ok: true };
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
  if (error) throw new Error(`No se pudo confirmar la inscripción: ${error.message}`);
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
      return { ok: false, error: "Ingresá horarios válidos para cada día abierto (la apertura debe ser antes del cierre)." };
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
  if (!isISODate(from) || !isISODate(to)) return { ok: false, error: "Ingresá una fecha válida." };
  if (to < from) return { ok: false, error: "La fecha final es anterior a la inicial." };
  const rows: { date: string; reason: string | null }[] = [];
  for (let d = from; d <= to && rows.length < 120; d = addDays(d, 1)) rows.push({ date: d, reason });
  if (rows.length >= 120) return { ok: false, error: "Ingresá un máximo de 120 días seguidos." };
  // Upsert so re-entering an overlapping range just updates the reason.
  const { error } = await supabase.from("closures").upsert(rows, { onConflict: "date" });
  if (error) return { ok: false, error: error.message };
  updateTag(TAG.hours);
  refresh();
  return { ok: true };
}

/** Removes every closure in a contiguous range (used by the "Entfernen" button on a range). */
export async function deleteClosureRange(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const from = str(formData, "from");
  const to = str(formData, "to") || from;
  // Validated for the same reason addClosure is, and because this one deletes: an unchecked bound
  // reaches the query as-is, and an empty string would widen the range rather than narrow it.
  if (!isISODate(from) || !isISODate(to) || to < from) return { ok: false, error: "La fecha no es válida." };
  const { error } = await supabase.from("closures").delete().gte("date", from).lte("date", to);
  if (error) return failed("deleteClosureRange", error);
  updateTag(TAG.hours);
  refresh();
  return { ok: true };
}

export async function deleteClosure(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("closures").delete().eq("id", str(formData, "id"));
  if (error) return failed("deleteClosure", error);
  updateTag(TAG.hours);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- settings
/** The settings form carries four decisions: the announcement, the reservation switch with its seats
 *  and party size, and the pre-order switch. Everything else stored under `reservations` and
 *  `preorders` (slot and sitting length, lead times, limits) is merged in from site_settings and
 *  kept as it is, so a save never resets a value the form cannot show. */
export async function saveSettings(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { data: rows, error: readError } = await supabase
    .from("site_settings")
    .select("key, value")
    .in("key", ["reservations", "preorders"]);
  if (readError) return { ok: false, error: readError.message };
  const stored = (key: string) => rows?.find((r) => r.key === key)?.value;

  const current = effectiveReservationSettings(stored("reservations"));
  const submitted = {
    enabled: bool(formData, "enabled"),
    capacity_seats: num(formData, "capacity_seats", current.capacity_seats),
    max_party_size: num(formData, "max_party_size", current.max_party_size),
  };
  const invalid = reservationFormError(submitted);
  if (invalid) return { ok: false, error: invalid };

  const { error } = await supabase.from("site_settings").upsert([
    { key: "reservations", value: mergeReservationSettings(stored("reservations"), submitted) },
    { key: "announcement", value: { text: str(formData, "announcement") } },
    {
      key: "preorders",
      value: mergePreorderSettings(stored("preorders"), { enabled: bool(formData, "preorders_enabled") }),
    },
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
  // The page is admin-only, so the action is too: a Server Action is a public POST endpoint.
  const { supabase } = await requireAdmin();
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
      return { ok: false, error: `${p.name}: Ingresá una calificación entre 0 y ${scale}, por ejemplo 4,6.` };
    }
    const countText = str(formData, `${p.id}_count`);
    const count = countText ? Number(countText) : null;
    if (count !== null && (!Number.isInteger(count) || count < 1 || count > 1_000_000)) {
      return { ok: false, error: `${p.name}: La cantidad de reseñas debe ser un número entero (o quedar vacía).` };
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
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Elegí una imagen." };
  // The declared type picks the extension and the stored content type, so it is checked against the
  // bytes rather than trusted: a browser (or anything else) can label a file however it likes.
  if (!GALLERY_MIME_TYPES.includes(file.type) || (await sniffImageType(file)) !== file.type) {
    return { ok: false, error: "Solo se permiten JPG, PNG o WebP." };
  }
  if (file.size > GALLERY_MAX_BYTES) return { ok: false, error: "La imagen supera los 5 MB." };
  if (!isGalleryCategory(category)) return { ok: false, error: "Elegí una categoría." };

  const path = `${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
  const { error: uploadError } = await supabase.storage.from("gallery").upload(path, file, { contentType: file.type });
  if (uploadError) return { ok: false, error: "No se pudo subir la imagen." };

  const { error } = await supabase.from("gallery_items").insert({
    image_url: supabase.storage.from("gallery").getPublicUrl(path).data.publicUrl,
    storage_path: path,
    caption: str(formData, "caption").slice(0, 160) || null,
    category,
    // Derived, not asked: the cheering cursor belongs to food photos and to nothing else.
    cursor_cheer: category === "food",
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
  if (!isGalleryCategory(category)) return { ok: false, error: "Elegí una categoría." };
  const { error } = await supabase
    .from("gallery_items")
    .update({
      caption: str(formData, "caption").slice(0, 160) || null,
      category,
      // Follows the category, so changing it later keeps the cursor coherent.
      cursor_cheer: category === "food",
      is_featured: bool(formData, "is_featured"),
    })
    .eq("id", str(formData, "id"));
  if (error) return { ok: false, error: error.message };
  updateTag(TAG.gallery);
  refresh();
  return { ok: true };
}

export async function deleteGalleryItem(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const id = str(formData, "id");
  const { data, error: readError } = await supabase.from("gallery_items").select("storage_path").eq("id", id).maybeSingle();
  if (readError) return failed("deleteGalleryItem read", readError);
  // Remove the object first: dropping the row before it would lose the path needed to retry the cleanup.
  if (data?.storage_path) {
    const { error: storageError } = await supabase.storage.from("gallery").remove([data.storage_path]);
    if (storageError) return failed("deleteGalleryItem storage", storageError);
  }
  const { error } = await supabase.from("gallery_items").delete().eq("id", id);
  if (error) return failed("deleteGalleryItem", error);
  updateTag(TAG.gallery);
  refresh();
  return { ok: true };
}

/** Picks the big photo in the "Besuch uns" section, or clears it when called without an id.
 *  One choice, so it lives in site_settings rather than as a flag two rows could both carry. */
export async function setHeroImage(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const id = str(formData, "id");
  const { error } = await supabase.from("site_settings").upsert({ key: "hero", value: id ? { gallery_item_id: id } : {} });
  if (error) return failed("setHeroImage", error);
  updateTag(TAG.gallery);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- team accounts
// Admin only. Accounts made here are always 'staff': the restaurant's logins, which see everything
// except the visitor analytics and this list. The secret key is needed because creating an auth
// user is not something a signed-in session may do, and the staff table only shows you your own row.

const USERNAME = /^[a-z0-9][a-z0-9._-]{1,31}$/;
const MIN_PASSWORD = 10;

export async function createStaffAccount(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const username = str(formData, "username").toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!USERNAME.test(username)) {
    return { ok: false, error: "Nombre: de 2 a 32 caracteres; solo minúsculas, números, punto y guion." };
  }
  if (password.length < MIN_PASSWORD) return { ok: false, error: `Contraseña: mínimo ${MIN_PASSWORD} caracteres.` };

  const admin = createPrivilegedClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: `${username}@${STAFF_EMAIL_DOMAIN}`,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    const taken = error?.message.toLowerCase().includes("already");
    return { ok: false, error: taken ? "Ese nombre de usuario ya existe." : "No se pudo crear la cuenta." };
  }
  const { error: staffError } = await admin.from("staff").insert({ user_id: data.user.id, role: "staff" });
  if (staffError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: "No se pudo crear la cuenta." };
  }
  refresh();
  return { ok: true };
}

export async function resetStaffPassword(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { user } = await requireAdmin();
  const id = str(formData, "user_id");
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD) return { ok: false, error: `Contraseña: mínimo ${MIN_PASSWORD} caracteres.` };
  const admin = createPrivilegedClient();
  // Only team accounts, never some other auth user that happens to share the project.
  const { data: member } = await admin.from("staff").select("role").eq("user_id", id).maybeSingle();
  if (!member) return { ok: false, error: "Esta cuenta no existe." };
  // Staff accounts and one's own, never another admin's: the same line deleteStaffAccount draws.
  if (member.role !== "staff" && id !== user.id) return { ok: false, error: "No se puede cambiar la contraseña de otro administrador acá." };
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return { ok: false, error: "No se pudo cambiar la contraseña." };
  // GoTrue keeps a user's other sessions after a password change, a stolen one included, and its
  // admin API cannot end them by id. This does (migration 20261116100300).
  const { error: revokeError } = await admin.rpc("revoke_user_sessions", { p_user_id: id });
  if (revokeError) {
    console.error("resetStaffPassword revoke_user_sessions", revokeError);
    return { ok: false, error: "La contraseña cambió, pero no se pudieron cerrar las sesiones abiertas de esa cuenta." };
  }
  return { ok: true };
}

// ---------------------------------------------------------------- staff invites
export type InviteResult = { ok: true; url: string } | { ok: false; error: string } | null;

/** Makes a sign-up link for a new team member. The URL is in this response and nowhere else: only
 *  its hash is stored, so closing the page loses it and the answer is to make another. */
export async function createStaffInvite(_prev: InviteResult, formData: FormData): Promise<InviteResult> {
  const { user } = await requireAdmin();
  const note = str(formData, "note");
  if (note.length > 80) return { ok: false, error: "La nota es demasiado larga (máximo 80 caracteres)." };

  const admin = createPrivilegedClient();
  const { count, error: countError } = await admin
    .from("staff_invites")
    .select("id", { count: "exact", head: true })
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString());
  if (countError) return failed("createStaffInvite count", countError);
  if ((count ?? 0) >= MAX_PENDING_INVITES) {
    return { ok: false, error: `Ya hay ${MAX_PENDING_INVITES} invitaciones abiertas. Revocá alguna antes de crear otra.` };
  }

  const token = newInviteToken();
  // The role is fixed here, by the admin, and is always the team role: an admin account is not
  // something a link should be able to create.
  const { error } = await admin.from("staff_invites").insert({
    token_hash: hashInviteToken(token),
    role: "staff",
    note: note || null,
    created_by: user.id,
    expires_at: inviteExpiry(),
  });
  if (error) return failed("createStaffInvite", error);
  refresh();
  return { ok: true, url: inviteUrl(token) };
}

export async function revokeStaffInvite(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const admin = createPrivilegedClient();
  const { error } = await admin
    .from("staff_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", str(formData, "id"))
    .is("used_at", null);
  if (error) return failed("revokeStaffInvite", error);
  refresh();
  return { ok: true };
}

/** The image type the first bytes say the file is, or null. */
async function sniffImageType(file: File): Promise<string | null> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function deleteStaffAccount(formData: FormData): Promise<ActionResult> {
  const { user } = await requireAdmin();
  const id = str(formData, "user_id");
  if (!id || id === user.id) return { ok: false, error: "Esta cuenta no se puede eliminar acá." };
  const admin = createPrivilegedClient();
  // Admin accounts are not removable from here, so nobody locks the agency out by accident.
  const { data: member, error: readError } = await admin.from("staff").select("role").eq("user_id", id).maybeSingle();
  if (readError) return failed("deleteStaffAccount read", readError);
  if (!member || member.role !== "staff") return { ok: false, error: "Esta cuenta no se puede eliminar acá." };
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return failed("deleteStaffAccount", error);
  refresh();
  return { ok: true };
}
