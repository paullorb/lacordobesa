"use server";

import { FIELD_LIMITS } from "@/lib/reservation-limits";
import type { PreorderLine } from "@/lib/preorders";
import { publicFormClient } from "@/lib/public-forms";
import { isManageToken } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";

export type PreorderRequestState = { ok: true; token: string } | { ok: false; error: string } | null;

const ERRORS: Record<string, string> = {
  preorders_disabled: "Vorbestellungen sind gerade nicht möglich. Ruf uns gern an.",
  invalid_contact: "Bitte gib deinen Namen, eine gültige Telefonnummer und, falls angegeben, eine gültige E-Mail-Adresse an.",
  field_too_long: "Eine Eingabe ist zu lang. Bitte kürze sie ein wenig.",
  too_many_requests: "Dazu gibt es schon mehrere Anfragen. Bitte ruf uns kurz an, dann klären wir alles direkt.",
  too_far_ahead: "So weit im Voraus können wir noch nicht planen.",
  too_soon: "Das ist uns zu kurzfristig. Bitte wähle einen späteren Abholtermin oder ruf uns an.",
  closed_that_day: "An diesem Tag haben wir geschlossen. Bitte wähle einen anderen Tag.",
  outside_hours: "Zu dieser Uhrzeit haben wir nicht geöffnet. Bitte wähle eine andere Zeit.",
  empty_order: "Bitte wähle mindestens ein Gericht aus.",
  too_many_lines: "Das sind zu viele verschiedene Gerichte für eine Vorbestellung. Ruf uns bitte kurz an.",
  invalid_quantity: "Bitte prüfe die Mengen.",
  item_unavailable: "Eines der gewählten Gerichte ist gerade nicht vorbestellbar. Bitte lade die Seite neu.",
};

const message = (code: string) => ERRORS[code] ?? "Das hat leider nicht geklappt. Bitte versuch es noch einmal oder ruf uns an.";

/** The quantities arrive as `qty-<uuid>` fields, so an empty box is simply absent from the FormData. */
function readLines(formData: FormData) {
  const lines: { item_id: string; quantity: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("qty-")) continue;
    const quantity = Number(value);
    if (!Number.isInteger(quantity) || quantity < 1) continue;
    lines.push({ item_id: key.slice(4), quantity });
  }
  return lines;
}

export async function requestPreorder(_prev: PreorderRequestState, formData: FormData): Promise<PreorderRequestState> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const date = String(formData.get("pickup_date") ?? "");
  const time = String(formData.get("pickup_time") ?? "");
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
    return { ok: false, error: "Bitte wähle Abholtag und Uhrzeit." };
  }
  const lines = readLines(formData);
  if (lines.length === 0) return { ok: false, error: ERRORS.empty_order };

  const { supabase, allowed } = await publicFormClient("preorder");
  if (!allowed) return { ok: false, error: ERRORS.too_many_requests };
  const { data, error } = await supabase.rpc("request_preorder", {
    p_name: name,
    p_phone: phone,
    p_email: email,
    p_pickup_date: date,
    p_pickup_time: time,
    p_lines: lines,
    p_notes: notes || undefined,
  });
  if (error) return { ok: false, error: message(error.message) };
  return { ok: true, token: data };
}

export type GuestPreorder = {
  name: string;
  pickupDate: string;
  pickupTime: string;
  status: "pending" | "confirmed" | "ready" | "collected" | "cancelled";
  notes: string | null;
  lines: PreorderLine[];
};

export async function getPreorderByToken(token: string): Promise<GuestPreorder | null> {
  if (!isManageToken(token)) return null;
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("preorder_by_token", { p_token: token });
  const row = data?.[0];
  if (error || !row) return null;
  return {
    name: row.name,
    pickupDate: row.pickup_date,
    pickupTime: row.pickup_time.slice(0, 5),
    status: row.status,
    notes: row.notes,
    lines: (row.lines ?? []) as PreorderLine[],
  };
}

export type PreorderCancelState = { ok: true } | { ok: false; error: string } | null;

export async function cancelPreorder(_prev: PreorderCancelState, formData: FormData): Promise<PreorderCancelState> {
  const token = String(formData.get("token") ?? "");
  if (!isManageToken(token)) return { ok: false, error: "Dieser Link gehört zu keiner Vorbestellung mehr." };
  const supabase = createPublicClient();
  const { error } = await supabase.rpc("cancel_preorder_by_token", { p_token: token });
  if (error) {
    const texts: Record<string, string> = {
      not_found: "Dieser Link gehört zu keiner Vorbestellung mehr. Bitte ruf uns kurz an.",
      not_cancellable: "Diese Vorbestellung ist schon in Arbeit. Bitte ruf uns kurz an, dann klären wir das direkt.",
      in_the_past: "Dieser Abholtermin liegt bereits in der Vergangenheit.",
    };
    return { ok: false, error: texts[error.message] ?? "Das hat leider nicht geklappt. Bitte ruf uns kurz an." };
  }
  return { ok: true };
}
