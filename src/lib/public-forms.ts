import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { checkTicket } from "@/lib/form-ticket";
import { createPrivilegedClient, secretKey } from "@/lib/supabase/privileged";

/** Per-visitor limits for the public forms (migrations 20261012215042 and 20261014072715).
 *
 *  The RPCs already limit per phone number and site-wide. Neither stops a script that rotates phone
 *  numbers: it fills the evenings with fake pending bookings, then trips the site-wide cap, and from
 *  then on every real guest is turned away. A limit per visitor stops one source long before it can
 *  reach the site-wide cap, and the checks below (honeypot, signed form ticket, circuit breaker)
 *  keep a handful of sources from reaching it together.
 *
 *  Generous on purpose. Mobile carriers put many customers behind one address, and a guest who
 *  fumbles the form a few times must not be locked out. The per-phone limits inside the RPCs stay
 *  the tight ones. */
const LIMITS = {
  reservation: { perHour: 5, perDay: 10 },
  waitlist: { perHour: 5, perDay: 10 },
  preorder: { perHour: 5, perDay: 10 },
  inquiry: { perHour: 3, perDay: 6 },
  specials: { perHour: 3, perDay: 6 },
} as const;

export type PublicForm = keyof typeof LIMITS;

export const isPublicForm = (value: string): value is PublicForm => Object.hasOwn(LIMITS, value);

/** Why a submission was turned away, as the form-error code the guest sees. */
export type Refusal = "too_many_requests" | "form_check";

export type PrivilegedClient = ReturnType<typeof createPrivilegedClient>;

/** The visitor's address, or null where it cannot be trusted.
 *
 *  Vercel overwrites x-forwarded-for with the address it saw, so a client cannot choose its own
 *  there. Behind any other host the header is whatever the client sent, and a script could rotate
 *  it to get a fresh quota on every request, so it is only read on Vercel (and in `next dev`, where
 *  there is nobody to spoof). Elsewhere the per-visitor limit is skipped and the RPC's own limits
 *  remain. */
async function visitorAddress() {
  if (process.env.VERCEL !== "1" && process.env.NODE_ENV !== "development") return null;
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

/** The client a public form calls its RPC with, and whether this visitor may submit right now.
 *
 *  Always the secret-key client: since 20261014072715 the five form RPCs are not granted to anon, so
 *  there is no publishable fallback left to take. Pass the submitted FormData: it carries the
 *  honeypot and the signed ticket (src/components/form-guard.tsx).
 *
 *  In order:
 *   1. a filled honeypot or a forged/too-fast ticket is refused (`form_check`);
 *   2. while the site is under pressure (form_under_pressure(), migration 20261116110300) only a
 *      submission with a valid ticket passes, so the site-wide cap degrades to "must have come
 *      through the page" before it ever turns everybody away;
 *   3. the per-visitor quota.
 *  A failing database check lets the request through rather than turning every guest away over a
 *  hiccup; the RPC's own limits still apply. */
export async function publicFormClient(
  form: PublicForm,
  formData: FormData,
): Promise<{ supabase: PrivilegedClient; refusal: Refusal | null }> {
  const supabase = createPrivilegedClient();

  if (String(formData.get("website") ?? "").trim() !== "") return { supabase, refusal: "form_check" };
  const verdict = checkTicket(secretKey(), form, formData.get("ticket"));
  if (verdict === "invalid" || verdict === "too_fast") return { supabase, refusal: "form_check" };

  if (verdict !== "ok") {
    const { data, error } = await supabase.rpc("form_under_pressure", { p_form: form });
    // Not deployed yet or unreachable: no pressure signal, so no extra requirement.
    if (!error && data === true) return { supabase, refusal: "form_check" };
  }

  const address = await visitorAddress();
  if (!address) return { supabase, refusal: null };

  // Only a keyed hash is stored, never the address itself. The key keeps it from being reversed by
  // hashing every IPv4 address, which takes minutes.
  const visitor = createHash("sha256").update(`${secretKey()}:${address}`).digest("hex").slice(0, 32);
  const { perHour, perDay } = LIMITS[form];
  const { data, error } = await supabase.rpc("take_request_quota", {
    p_bucket: `${form}:${visitor}`,
    p_max_1h: perHour,
    p_max_24h: perDay,
  });
  if (error) {
    console.error(`request quota check failed for ${form}: ${error.message}`);
    return { supabase, refusal: null };
  }
  return { supabase, refusal: data === false ? "too_many_requests" : null };
}
