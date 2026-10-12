/** Staff sign in with a short name ("maria"), not an e-mail. Supabase Auth needs an e-mail, so the
 *  name maps to a synthetic address on a domain nobody receives mail on. Create users in the
 *  Supabase dashboard with exactly this address, e.g. maria@staff.lacordobesa.local. */
export const STAFF_EMAIL_DOMAIN = "staff.lacordobesa.local";

export function staffEmail(username: string) {
  const name = username.trim().toLowerCase();
  return name.includes("@") ? name : `${name}@${STAFF_EMAIL_DOMAIN}`;
}

/** "maria@staff.lacordobesa.local" -> "maria"; a real e-mail is shown as-is. */
export function staffDisplayName(email: string | undefined) {
  if (!email) return "";
  return email.endsWith(`@${STAFF_EMAIL_DOMAIN}`) ? email.slice(0, -STAFF_EMAIL_DOMAIN.length - 1) : email;
}
