import "server-only";
import { CONTACT } from "@/lib/contact";
import { fmtDate } from "@/lib/dates";
import type { Locale } from "@/lib/i18n";
import { escapeHtml, type Mail } from "@/lib/mail";
import { manageUrl } from "@/lib/site";

/** Brand colours, inlined: mail clients drop <style> blocks and know nothing about CSS variables. */
const INK = "#152f3b";
const MUTED = "#596d72";
const CREAM = "#f5f1e9";
const PAPER = "#fffdf8";

type Confirmed = {
  name: string;
  date: string;
  time: string;
  partySize: number;
  manageToken: string | null;
  /** The language the guest booked in (reservations.locale). */
  locale: Locale;
};

/** The mail's words, per locale. Kept here rather than in the page dictionaries: those ship to the
 *  browser, and this copy is only ever used on the server. */
const COPY: Record<
  Locale,
  {
    when: (date: string, time: string) => string;
    people: (n: number) => string;
    subject: (date: string, time: string) => string;
    hello: (name: string) => string;
    heading: (name: string) => string;
    intro: string;
    labels: { when: string; for: string; where: string };
    change: string;
    changeText: string;
    changeButton: string;
    questions: (phone: string) => string;
    questionsHtml: (phoneLink: string) => string;
    signoff: string;
  }
> = {
  de: {
    when: (date, time) => `${fmtDate(date, "de", { weekday: "long" })} um ${time} Uhr`,
    people: (n) => `${n} ${n === 1 ? "Person" : "Personen"}`,
    subject: (date, time) => `Dein Tisch bei La Cordobesa: ${fmtDate(date, "de", { weekday: undefined })} um ${time} Uhr`,
    hello: (name) => `Hola ${name}!`,
    heading: (name) => `¡Hola ${name}! Dein Tisch ist bestätigt.`,
    intro: "Dein Tisch bei La Cordobesa ist bestätigt:",
    labels: { when: "Wann", for: "Für", where: "Wo" },
    change: "Du kannst nicht kommen oder brauchst eine andere Zeit?",
    changeText: "Du kannst nicht kommen oder brauchst eine andere Zeit? Hier kannst du selbst absagen oder verschieben:",
    changeButton: "Reservierung ändern oder absagen",
    questions: (phone) => `Fragen? Ruf uns an unter ${phone} oder antworte einfach auf diese E-Mail.`,
    questionsHtml: (phoneLink) => `Fragen? Ruf uns an unter ${phoneLink}\n      oder antworte einfach auf diese E-Mail.`,
    signoff: "Das Team von La Cordobesa",
  },
  es: {
    when: (date, time) => `${fmtDate(date, "es", { weekday: "long" })} a las ${time}`,
    people: (n) => `${n} ${n === 1 ? "persona" : "personas"}`,
    subject: (date, time) => `Tu mesa en La Cordobesa: ${fmtDate(date, "es", { weekday: undefined })} a las ${time}`,
    hello: (name) => `¡Hola ${name}!`,
    heading: (name) => `¡Hola ${name}! Tu mesa está confirmada.`,
    intro: "Tu mesa en La Cordobesa está confirmada:",
    labels: { when: "Cuándo", for: "Para", where: "Dónde" },
    change: "¿No podés venir o necesitás otro horario?",
    changeText: "¿No podés venir o necesitás otro horario? Acá podés cancelar o cambiar la reserva vos mismo:",
    changeButton: "Cambiar o cancelar la reserva",
    questions: (phone) => `¿Preguntas? Llamanos al ${phone} o respondé directamente a este e-mail.`,
    questionsHtml: (phoneLink) => `¿Preguntas? Llamanos al ${phoneLink}\n      o respondé directamente a este e-mail.`,
    signoff: "El equipo de La Cordobesa",
  },
  en: {
    when: (date, time) => `${fmtDate(date, "en", { weekday: "long", month: "long" })} at ${time}`,
    people: (n) => `${n} ${n === 1 ? "person" : "people"}`,
    subject: (date, time) => `Your table at La Cordobesa: ${fmtDate(date, "en", { weekday: undefined })} at ${time}`,
    hello: (name) => `¡Hola ${name}!`,
    heading: (name) => `¡Hola ${name}! Your table is confirmed.`,
    intro: "Your table at La Cordobesa is confirmed:",
    labels: { when: "When", for: "For", where: "Where" },
    change: "Can't make it, or need a different time?",
    changeText: "Can't make it, or need a different time? You can cancel or change your reservation here:",
    changeButton: "Change or cancel reservation",
    questions: (phone) => `Questions? Call us on ${phone} or just reply to this email.`,
    questionsHtml: (phoneLink) => `Questions? Call us on ${phoneLink}\n      or just reply to this email.`,
    signoff: "The La Cordobesa team",
  },
};

/** The e-mail a guest gets when staff confirm their table, in the language they booked in.
 *
 *  Single column, inline styles, no images and no web fonts, which is what survives Outlook, Gmail
 *  and Apple Mail alike. The management link is the point of the mail as much as the confirmation is:
 *  a guest who can cancel in one tap gives the seat back instead of not turning up. */
export function reservationConfirmedMail({ name, date, time, partySize, manageToken, locale }: Confirmed): Omit<Mail, "to"> {
  const c = COPY[locale];
  const when = c.when(date, time);
  const people = c.people(partySize);
  const link = manageToken ? manageUrl(manageToken, locale) : null;

  const text = [
    c.hello(name),
    "",
    c.intro,
    "",
    `  ${when}`,
    `  ${people}`,
    `  ${CONTACT.street}, ${CONTACT.city}`,
    "",
    ...(link ? [c.changeText, link, ""] : []),
    c.questions(CONTACT.phoneDisplay),
    "",
    "¡Hasta pronto!",
    c.signoff,
  ].join("\n");

  const html = `<!doctype html>
<html lang="${locale}">
<body style="margin:0;padding:24px;background:${CREAM};font-family:Arial,Helvetica,sans-serif;color:${INK}">
  <div style="max-width:520px;margin:0 auto;background:${PAPER};padding:32px">
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${MUTED}">La Cordobesa · Frankfurt am Main</p>
    <h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:26px;font-weight:500;line-height:1.25">
      ${escapeHtml(c.heading(name))}
    </h1>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;font-size:15px;line-height:1.9">
      <tr><td style="color:${MUTED};width:90px">${c.labels.when}</td><td><strong>${escapeHtml(when)}</strong></td></tr>
      <tr><td style="color:${MUTED}">${c.labels.for}</td><td><strong>${escapeHtml(people)}</strong></td></tr>
      <tr><td style="color:${MUTED}">${c.labels.where}</td><td>${escapeHtml(CONTACT.street)}, ${escapeHtml(CONTACT.city)}</td></tr>
    </table>
    ${
      link
        ? `<p style="margin:0 0 10px;font-size:15px;line-height:1.7">${escapeHtml(c.change)}</p>
    <p style="margin:0 0 24px">
      <a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 22px;background:${INK};color:${PAPER};text-decoration:none;font-size:14px;font-weight:bold">${escapeHtml(c.changeButton)}</a>
    </p>`
        : ""
    }
    <p style="margin:0 0 6px;font-size:14px;line-height:1.7;color:${MUTED}">
      ${c.questionsHtml(`<a href="tel:${escapeHtml(CONTACT.phoneE164)}" style="color:${INK}">${escapeHtml(CONTACT.phoneDisplay)}</a>`)}
    </p>
    <p style="margin:24px 0 0;font-family:Georgia,serif;font-style:italic;font-size:16px">¡Hasta pronto!<br>${escapeHtml(c.signoff)}</p>
  </div>
</body>
</html>`;

  return {
    subject: c.subject(date, time),
    html,
    text,
    // Replies land in the inbox the team already reads, rather than at an unattended sender address.
    replyTo: CONTACT.email,
  };
}
