import "server-only";
import { CONTACT } from "@/lib/contact";
import { fmtDateDE } from "@/lib/dates";
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
};

/** The e-mail a guest gets when staff confirm their table.
 *
 *  Single column, inline styles, no images and no web fonts, which is what survives Outlook, Gmail
 *  and Apple Mail alike. The management link is the point of the mail as much as the confirmation is:
 *  a guest who can cancel in one tap gives the seat back instead of not turning up. */
export function reservationConfirmedMail({ name, date, time, partySize, manageToken }: Confirmed): Omit<Mail, "to"> {
  const when = `${fmtDateDE(date, { weekday: "long" })} um ${time} Uhr`;
  const people = `${partySize} ${partySize === 1 ? "Person" : "Personen"}`;
  const link = manageToken ? manageUrl(manageToken) : null;

  const text = [
    `Hola ${name}!`,
    "",
    "Dein Tisch bei La Cordobesa ist bestätigt:",
    "",
    `  ${when}`,
    `  ${people}`,
    `  ${CONTACT.street}, ${CONTACT.city}`,
    "",
    ...(link ? ["Du kannst nicht kommen oder brauchst eine andere Zeit? Hier kannst du selbst absagen oder verschieben:", link, ""] : []),
    `Fragen? Ruf uns an unter ${CONTACT.phoneDisplay} oder antworte einfach auf diese E-Mail.`,
    "",
    "¡Hasta pronto!",
    "Das Team von La Cordobesa",
  ].join("\n");

  const html = `<!doctype html>
<html lang="de">
<body style="margin:0;padding:24px;background:${CREAM};font-family:Arial,Helvetica,sans-serif;color:${INK}">
  <div style="max-width:520px;margin:0 auto;background:${PAPER};padding:32px">
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${MUTED}">La Cordobesa · Frankfurt am Main</p>
    <h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:26px;font-weight:500;line-height:1.25">
      ¡Hola ${escapeHtml(name)}! Dein Tisch ist bestätigt.
    </h1>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;font-size:15px;line-height:1.9">
      <tr><td style="color:${MUTED};width:90px">Wann</td><td><strong>${escapeHtml(when)}</strong></td></tr>
      <tr><td style="color:${MUTED}">Für</td><td><strong>${escapeHtml(people)}</strong></td></tr>
      <tr><td style="color:${MUTED}">Wo</td><td>${escapeHtml(CONTACT.street)}, ${escapeHtml(CONTACT.city)}</td></tr>
    </table>
    ${
      link
        ? `<p style="margin:0 0 10px;font-size:15px;line-height:1.7">Du kannst nicht kommen oder brauchst eine andere Zeit?</p>
    <p style="margin:0 0 24px">
      <a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 22px;background:${INK};color:${PAPER};text-decoration:none;font-size:14px;font-weight:bold">Reservierung ändern oder absagen</a>
    </p>`
        : ""
    }
    <p style="margin:0 0 6px;font-size:14px;line-height:1.7;color:${MUTED}">
      Fragen? Ruf uns an unter <a href="tel:${escapeHtml(CONTACT.phoneE164)}" style="color:${INK}">${escapeHtml(CONTACT.phoneDisplay)}</a>
      oder antworte einfach auf diese E-Mail.
    </p>
    <p style="margin:24px 0 0;font-family:Georgia,serif;font-style:italic;font-size:16px">¡Hasta pronto!<br>Das Team von La Cordobesa</p>
  </div>
</body>
</html>`;

  return {
    subject: `Dein Tisch bei La Cordobesa: ${fmtDateDE(date, { weekday: undefined })} um ${time} Uhr`,
    html,
    text,
    // Replies land in the inbox the team already reads, rather than at an unattended sender address.
    replyTo: CONTACT.email,
  };
}
