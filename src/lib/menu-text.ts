import type { Tables } from "@/lib/database.types";
import type { Locale } from "@/lib/i18n";

type Described = Pick<Tables<"menu_items">, "description" | "description_es">;

/** The description in the reader's language, falling back to German (migration 20261012102608).
 *  A German sentence is more use to a Spanish reader than a blank line.
 *
 *  menu_items.description_en is still in the schema and still editable by staff; the site simply
 *  no longer offers English, so nothing reads it. Dropping the column would throw away whatever
 *  has been written into it for the sake of tidiness. */
export function menuDescription(item: Described, locale: Locale) {
  return locale === "es" ? (item.description_es ?? item.description) : item.description;
}

/** True when a dish shows German text under a Spanish heading. The caller marks that text
 *  lang="de", so a screen reader does not announce it in the page's language. */
export function isUntranslated(item: Described, locale: Locale) {
  if (locale === "de" || !item.description) return false;
  return item.description_es == null;
}
