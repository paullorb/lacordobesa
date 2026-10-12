/** The site's own absolute URL, and links built from it.
 *  NEXT_PUBLIC_, so the same value is available to server components and the browser. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Where a guest manages their own booking. The token is the credential, so this link only ever
 *  goes to the guest it belongs to. */
export const manageUrl = (token: string) => `${SITE_URL}/reservierung/${token}`;

/** Manage tokens are 18 random bytes as hex (migration 20261012093558). Checking the shape before a
 *  round trip keeps obvious junk out of the database and out of the RPC. */
const MANAGE_TOKEN = /^[0-9a-f]{36}$/;

export const isManageToken = (token: string) => MANAGE_TOKEN.test(token);
