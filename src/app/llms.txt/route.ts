import { getMenu, getOpeningHours, getReservationSettings, getUpcomingClosures } from "@/lib/data";
import { llmsTxt } from "@/lib/llms";
import { getPreorderSettings } from "@/lib/preorders";

// /llms.txt: the shop in plain Markdown for language models (see lib/llms.ts). Every read is a cached
// getter, so this prerenders like the pages and is refreshed by the same staff saves.
export async function GET() {
  const [hours, menu, closures, reservation, preorder] = await Promise.all([
    getOpeningHours(),
    getMenu(),
    getUpcomingClosures(),
    getReservationSettings(),
    getPreorderSettings(),
  ]);
  const body = llmsTxt({
    hours,
    menu,
    closures,
    reservationsEnabled: reservation.enabled,
    preordersEnabled: preorder.enabled,
  });
  return new Response(body, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}
