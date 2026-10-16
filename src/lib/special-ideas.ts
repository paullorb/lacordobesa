import type { Tables } from "@/lib/database.types";
import type { Locale } from "@/lib/i18n";

export type SpecialIdea = Tables<"special_ideas">;

/** The idea's title in the reader's language, falling back to German (migration 20261016050000).
 *  Same convention as menu_items: German is the base column, Spanish and English are optional. */
export function ideaTitle(idea: Pick<SpecialIdea, "title" | "title_es" | "title_en">, locale: Locale) {
  if (locale === "es") return idea.title_es ?? idea.title;
  if (locale === "en") return idea.title_en ?? idea.title;
  return idea.title;
}

export function ideaDescription(idea: Pick<SpecialIdea, "description" | "description_es" | "description_en">, locale: Locale) {
  if (locale === "es") return idea.description_es ?? idea.description;
  if (locale === "en") return idea.description_en ?? idea.description;
  return idea.description;
}

/** True when a card shows German text on a Spanish or English page; the caller marks it lang="de". */
export function isIdeaUntranslated(idea: SpecialIdea, locale: Locale) {
  if (locale === "de") return false;
  const title = locale === "es" ? idea.title_es : idea.title_en;
  const description = locale === "es" ? idea.description_es : idea.description_en;
  return title == null || (idea.description != null && description == null);
}
