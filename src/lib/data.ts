import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { todayISO } from "@/lib/dates";
import type { Tables } from "@/lib/database.types";

/** Cache tags, invalidated by the admin actions with updateTag(). */
export const TAG = {
  content: "site-content", // menu, specials, announcement
  hours: "opening-hours",
} as const;

export type ReservationSettings = {
  enabled: boolean;
  slot_minutes: number;
  duration_minutes: number;
  capacity_seats: number;
  max_party_size: number;
  min_lead_hours: number;
  max_days_ahead: number;
  last_seating_minutes_before_close: number;
};

export const DEFAULT_RESERVATION_SETTINGS: ReservationSettings = {
  enabled: true,
  slot_minutes: 30,
  duration_minutes: 90,
  capacity_seats: 20,
  max_party_size: 8,
  min_lead_hours: 2,
  max_days_ahead: 30,
  last_seating_minutes_before_close: 60,
};

export type MenuCategoryWithItems = Tables<"menu_categories"> & { items: Tables<"menu_items">[] };

export async function getMenu(): Promise<MenuCategoryWithItems[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAG.content);
  const supabase = createPublicClient();
  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from("menu_categories").select("*").order("sort_order"),
    supabase.from("menu_items").select("*").eq("is_available", true).order("sort_order"),
  ]);
  return (categories ?? []).map((c) => ({
    ...c,
    items: (items ?? []).filter((i) => i.category_id === c.id),
  }));
}

export async function getActiveSpecials(): Promise<Tables<"specials">[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAG.content);
  const supabase = createPublicClient();
  // "today" is baked into the cached entry; cacheLife("hours") revalidates it, and the admin
  // actions invalidate it on every change, so a special lingers at most an hour past ends_on.
  const today = todayISO();
  const { data } = await supabase
    .from("specials")
    .select("*")
    .eq("is_active", true)
    .lte("starts_on", today)
    .or(`ends_on.is.null,ends_on.gte.${today}`)
    .order("starts_on", { ascending: false });
  return data ?? [];
}

export async function getAnnouncement(): Promise<string> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAG.content);
  const supabase = createPublicClient();
  const { data } = await supabase.from("site_settings").select("value").eq("key", "announcement").maybeSingle();
  const value = data?.value as { text?: string } | null;
  return value?.text ?? "";
}

export async function getOpeningHours(): Promise<Tables<"opening_hours">[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAG.hours);
  const supabase = createPublicClient();
  const { data } = await supabase.from("opening_hours").select("*").order("weekday");
  return data ?? [];
}

export async function getReservationSettings(): Promise<ReservationSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAG.hours);
  const supabase = createPublicClient();
  const { data } = await supabase.from("site_settings").select("value").eq("key", "reservations").maybeSingle();
  return { ...DEFAULT_RESERVATION_SETTINGS, ...((data?.value as Partial<ReservationSettings>) ?? {}) };
}

export const WEEKDAYS_DE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

/** "09:00:00" -> "09:00" */
export function fmtTime(t: string | null) {
  return t ? t.slice(0, 5) : "";
}
