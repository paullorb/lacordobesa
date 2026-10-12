"use server";

import { isISODate, isTime } from "@/lib/dates";
import { formErrors } from "@/lib/form-errors";
import { FIELD_LIMITS } from "@/lib/reservation-limits";
import type { PreorderLine } from "@/lib/preorders";
import { publicFormClient } from "@/lib/public-forms";
import { isManageToken } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";

export type PreorderRequestState = { ok: true; token: string } | { ok: false; error: string } | null;

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
  const errorFor = formErrors(formData, (d) => d.preorderForm.errors);
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
    return { ok: false, error: errorFor("field_too_long") };
  }
  if (!isISODate(date) || !isTime(time)) return { ok: false, error: errorFor("invalid_datetime") };
  const lines = readLines(formData);
  if (lines.length === 0) return { ok: false, error: errorFor("empty_order") };

  const { supabase, allowed } = await publicFormClient("preorder");
  if (!allowed) return { ok: false, error: errorFor("too_many_requests") };
  const { data, error } = await supabase.rpc("request_preorder", {
    p_name: name,
    p_phone: phone,
    p_email: email,
    p_pickup_date: date,
    p_pickup_time: time,
    p_lines: lines,
    p_notes: notes || undefined,
  });
  if (error) return { ok: false, error: errorFor(error.message) };
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
  const errorFor = formErrors(formData, (d) => d.managePreorder.errors);
  const token = String(formData.get("token") ?? "");
  if (!isManageToken(token)) return { ok: false, error: errorFor("not_found") };
  const supabase = createPublicClient();
  const { error } = await supabase.rpc("cancel_preorder_by_token", { p_token: token });
  if (error) return { ok: false, error: errorFor(error.message) };
  return { ok: true };
}
