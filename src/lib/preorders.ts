import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { TAG } from "@/lib/data";
import { addDays, dateAfterHours, todayISO } from "@/lib/dates";
import type { Tables } from "@/lib/database.types";
import { createPublicClient } from "@/lib/supabase/public";

export type PreorderSettings = {
  enabled: boolean;
  /** How far ahead an order has to come in, so there is time to actually bake it. */
  min_lead_hours: number;
  max_days_ahead: number;
  /** Distinct dishes per order, and the most of any one dish. */
  max_lines: number;
  max_quantity: number;
};

export const DEFAULT_PREORDER_SETTINGS: PreorderSettings = {
  enabled: true,
  min_lead_hours: 24,
  max_days_ahead: 60,
  max_lines: 12,
  max_quantity: 50,
};

/** The ceiling preorder_lines.quantity enforces in the database (migration 20261012094815). */
export const MAX_PREORDER_QUANTITY = 200;

export async function getPreorderSettings(): Promise<PreorderSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAG.hours);
  const supabase = createPublicClient();
  const { data } = await supabase.from("site_settings").select("value").eq("key", "preorders").maybeSingle();
  return { ...DEFAULT_PREORDER_SETTINGS, ...((data?.value as Partial<PreorderSettings>) ?? {}) };
}

/** The pickup days the form may offer: from the earliest the RPC would accept to the planning horizon.
 *
 *  Cached, because reading the clock during a prerender is not allowed otherwise. "Now" is therefore
 *  baked into the cached entry and refreshed hourly, exactly like today's date in getActiveSpecials().
 *  With a lead time measured in hours that is harmless, and request_preorder() is the authority anyway:
 *  a stale boundary day is rejected there with too_soon. */
export async function getPickupRange(): Promise<{ minDate: string; maxDate: string }> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAG.hours);
  const settings = await getPreorderSettings();
  const minDate = dateAfterHours(settings.min_lead_hours);
  // The horizon counts from today, as request_preorder() does, not from the first pickup day.
  return { minDate, maxDate: addDays(todayISO(), settings.max_days_ahead) };
}

export type PreorderableItem = Pick<Tables<"menu_items">, "id" | "name" | "description" | "description_es" | "price_label" | "preorder_unit"> & {
  category: string;
};

/** The dishes staff marked as pre-orderable, grouped under their category label.
 *  Returns [] when the migration is not applied yet, so /vorbestellen degrades to its closed state. */
export async function getPreorderableItems(): Promise<PreorderableItem[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAG.content);
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, description, description_es, price_label, preorder_unit, menu_categories(label, sort_order)")
    .eq("is_preorderable", true)
    .eq("is_available", true)
    .order("sort_order");
  if (error) return [];
  return (data ?? []).map((i) => {
    const { menu_categories, ...item } = i as typeof i & { menu_categories: { label: string } | null };
    return { ...item, category: menu_categories?.label ?? "Weitere" };
  });
}

/** A pre-order with the lines the staff list joins in. Lives here rather than in the staff page,
 *  so the card component does not have to import a type out of a route file. */
type StaffPreorderLine = Pick<Tables<"preorder_lines">, "id" | "label" | "unit_label" | "price_label" | "quantity">;
export type PreorderWithLines = Tables<"preorders"> & { preorder_lines: StaffPreorderLine[] };

/** One line of a guest's order, as preorder_by_token() returns it. */
export type PreorderLine = { label: string; unit: string; price: string | null; quantity: number };
