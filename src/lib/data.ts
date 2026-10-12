import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { todayISO } from "@/lib/dates";
import type { Tables } from "@/lib/database.types";

/** Cache tags, invalidated by the staff actions with updateTag(). */
export const TAG = {
  content: "site-content", // menu, specials, announcement
  hours: "opening-hours",
  gallery: "gallery",
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
  slot_minutes: 15,
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
    // Blanked here, not in the UI, so a hidden price can't leak through any public page. `!== false` keeps
    // prices visible if the show_prices column doesn't exist yet (migration 0008).
    items: (items ?? [])
      .filter((i) => i.category_id === c.id)
      .map((i) => (c.show_prices !== false ? i : { ...i, price_label: null })),
  }));
}

export async function getActiveSpecials(): Promise<Tables<"specials">[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAG.content);
  const supabase = createPublicClient();
  // "today" is baked into the cached entry; cacheLife("hours") revalidates it, and the staff area
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

/** Closure dates inside a window, so a date picker can grey out the days the shop is shut. */
export async function getClosures(from: string, to: string): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAG.hours);
  const supabase = createPublicClient();
  const { data } = await supabase.from("closures").select("date").gte("date", from).lte("date", to).order("date");
  return (data ?? []).map((c) => c.date);
}

export async function getReservationSettings(): Promise<ReservationSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAG.hours);
  const supabase = createPublicClient();
  const { data } = await supabase.from("site_settings").select("value").eq("key", "reservations").maybeSingle();
  return { ...DEFAULT_RESERVATION_SETTINGS, ...((data?.value as Partial<ReservationSettings>) ?? {}) };
}

export async function getGalleryItems(): Promise<Tables<"gallery_items">[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAG.gallery);
  const supabase = createPublicClient();
  const { data } = await supabase.from("gallery_items").select("*").order("created_at", { ascending: false }).limit(200);
  return data ?? [];
}

/** The hero image and the photo strip on the landing page, both drawn from the gallery.
 *
 *  The hero is one choice, so it is stored as a gallery_items id in site_settings under key 'hero'
 *  and resolved here; if that photo is later deleted, or the migration is not applied, the caller
 *  falls back to the bundled JPEG rather than rendering a broken image. */
export async function getHomePhotos(): Promise<{ hero: Tables<"gallery_items"> | null; featured: Tables<"gallery_items">[] }> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAG.gallery);
  const supabase = createPublicClient();
  const [{ data: setting }, { data: featured, error }] = await Promise.all([
    supabase.from("site_settings").select("value").eq("key", "hero").maybeSingle(),
    supabase.from("gallery_items").select("*").eq("is_featured", true).order("created_at", { ascending: false }).limit(8),
  ]);
  // No is_featured column yet (migration 20261012101400): no strip, no hero, bundled image stays.
  if (error) return { hero: null, featured: [] };

  const heroId = (setting?.value as { gallery_item_id?: string } | null)?.gallery_item_id;
  const hero = heroId
    ? ((await supabase.from("gallery_items").select("*").eq("id", heroId).maybeSingle()).data ?? null)
    : null;
  return { hero, featured: featured ?? [] };
}

export const WEEKDAYS_DE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

/** "09:00:00" -> "09:00" */
export function fmtTime(t: string | null) {
  return t ? t.slice(0, 5) : "";
}
