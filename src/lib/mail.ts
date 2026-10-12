import "server-only";

/** Sending transactional mail through Resend's REST API.
 *
 *  Deliberately a plain fetch rather than the SDK: one POST with a bearer token is the whole
 *  integration, and it keeps a dependency (and its transitive tree) out of the bundle.
 *
 *  Both env vars are optional. Without them nothing is sent and callers get `skipped`, so the app
 *  runs unchanged on a checkout that has no mail credentials, and staff see "not configured"
 *  instead of a silent failure. */

const ENDPOINT = "https://api.resend.com/emails";

export type MailResult = { ok: true } | { ok: false; reason: "not_configured" | "failed"; detail?: string };

export const mailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

export type Mail = {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative. Always set one: a mail with no text part scores worse with spam filters. */
  text: string;
  replyTo?: string;
};

export async function sendMail(mail: Mail): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) return { ok: false, reason: "not_configured" };

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
      }),
      // A slow provider must not hold a staff member's click hostage.
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      // Resend puts the reason in the body; the status alone does not say whether the domain is
      // unverified, the key is wrong or the address bounced.
      const detail = await response.text().catch(() => "");
      return { ok: false, reason: "failed", detail: `${response.status} ${detail}`.trim().slice(0, 300) };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: "failed", detail: error instanceof Error ? error.message : "unknown error" };
  }
}

/** Minimal escaping for values interpolated into an HTML mail body. */
export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
