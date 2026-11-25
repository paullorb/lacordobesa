/** The home page's questions and answers, built from the dictionary and the live settings.
 *
 *  One builder for three readers: the visible section on the home page, the FAQPage JSON-LD beside
 *  it, and /llms.txt. They must say the same thing, and structured data that disagrees with the
 *  page is exactly what search engines penalise, so nothing renders its own copy.
 *
 *  The facts that change (opening hours, whether online booking and pre-orders are switched on) are
 *  passed in, never written into the dictionary, so an answer cannot go stale while the page moves on. */
import { CONTACT } from "@/lib/contact";
import type { Tables } from "@/lib/database.types";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";

export type FaqEntry = { id: string; question: string; answer: string };

type HoursRow = Pick<Tables<"opening_hours">, "weekday" | "opens" | "closes" | "is_closed">;

/** Monday first, as the page lists the week. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

/** "Montag geschlossen; Dienstag bis Samstag 12:00 bis 20:00; Sonntag 11:30 bis 22:00".
 *
 *  Neighbouring days with the same hours are folded into one range, which is how a person says it
 *  and how an assistant will repeat it. Empty when no day has hours at all. */
export function hoursSummary(hours: HoursRow[], locale: Locale): string {
  const d = getDictionary(locale);
  const textOf = (wd: number) => {
    const h = hours.find((x) => x.weekday === wd);
    return !h || h.is_closed || !h.opens || !h.closes ? null : d.home.hoursRange(h.opens.slice(0, 5), h.closes.slice(0, 5));
  };
  if (WEEK.every((wd) => textOf(wd) === null)) return "";

  const groups: { from: number; to: number; text: string | null }[] = [];
  for (const wd of WEEK) {
    const text = textOf(wd);
    const last = groups.at(-1);
    if (last && last.text === text) last.to = wd;
    else groups.push({ from: wd, to: wd, text });
  }
  return groups
    .map(({ from, to, text }) => {
      const [a, b] = [d.home.weekdays[from], d.home.weekdays[to]];
      // Two neighbours read as a pair ("Samstag und Sonntag"), three or more as a range.
      const span = WEEK.indexOf(to) - WEEK.indexOf(from);
      const days = span === 0 ? a : span === 1 ? d.faq.dayPair(a, b) : d.faq.dayRange(a, b);
      return `${days} ${text ?? d.home.closedLabel}`;
    })
    .join("; ");
}

export function faqEntries(
  locale: Locale,
  { hours, reservationsEnabled, preordersEnabled }: { hours: HoursRow[]; reservationsEnabled: boolean; preordersEnabled: boolean },
): FaqEntry[] {
  const t = getDictionary(locale).faq;
  const summary = hoursSummary(hours, locale);
  return [
    { id: "wo", question: t.whereQ, answer: t.whereA(`${CONTACT.street}, ${CONTACT.city}`) },
    { id: "oeffnungszeiten", question: t.hoursQ, answer: t.hoursA(summary || t.hoursNone) },
    { id: "angebot", question: t.whatQ, answer: t.whatA },
    {
      id: "reservieren",
      question: t.reserveQ,
      answer: reservationsEnabled ? t.reserveOnline(CONTACT.phoneDisplay) : t.reservePhone(CONTACT.phoneDisplay),
    },
    {
      id: "vorbestellen",
      question: t.preorderQ,
      answer: preordersEnabled ? t.preorderOnline : t.preorderPhone(CONTACT.phoneDisplay),
    },
    { id: "catering", question: t.cateringQ, answer: t.cateringA },
    { id: "familie", question: t.whoQ, answer: t.whoA },
  ];
}
