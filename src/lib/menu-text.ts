import type { Tables } from "@/lib/database.types";
import type { Locale } from "@/lib/i18n";

type Described = Pick<Tables<"menu_items">, "description" | "description_es" | "description_en">;

/** The description in the reader's language, falling back to German (migration 20261012102608).
 *  A German sentence is more use to a Spanish or English reader than a blank line.
 *
 *  `menu_items.description_es` and `description_en` are both editable by staff under /staff/karte.
 *  Dish *names* are not translated at all: they are the Spanish and Argentine names on the menu,
 *  which is what the kitchen and the guests say. */
export function menuDescription(item: Described, locale: Locale) {
  if (locale === "es") return item.description_es ?? item.description;
  if (locale === "en") return item.description_en ?? item.description;
  return item.description;
}

/** True when a dish shows German text under a Spanish or English heading. The caller marks that text
 *  lang="de", so a screen reader does not announce it in the page's language. */
export function isUntranslated(item: Described, locale: Locale) {
  if (locale === "de" || !item.description) return false;
  return (locale === "es" ? item.description_es : item.description_en) == null;
}
