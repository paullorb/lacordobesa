import { de, type Dictionary } from "@/lib/dictionaries/de";
import { es } from "@/lib/dictionaries/es";
import type { Locale } from "@/lib/i18n";

const DICTIONARIES: Record<Locale, Dictionary> = { de, es };

/**
 * The copy for a locale.
 *
 * Deliberately **not** `server-only`, and client components call it themselves rather than being
 * handed a dictionary as a prop. The dictionaries interpolate with functions (`successText(date,
 * time, people)`) so that the compiler checks the arguments, and a function cannot cross the
 * server/client boundary as a prop. The cost is that both locales end up in the client bundle;
 * for a few pages of restaurant copy that is a few KB gzipped, which is cheaper than losing the
 * type checking or adding a round trip.
 */
export const getDictionary = (locale: Locale): Dictionary => DICTIONARIES[locale];

export type { Dictionary };
