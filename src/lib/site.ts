import { DEFAULT_LOCALE, localeHref, type Locale } from "@/lib/i18n";

/** The site's own absolute URL, and links built from it.
 *
 *  NEXT_PUBLIC_, so the same value is available to server components and the browser. It ends up in
 *  the sitemap, robots.txt, the JSON-LD and every guest management link, so getting it wrong is not
 *  cosmetic: it publishes the wrong host.
 *
 *  The Vercel fallback matters because `.env.local` is gitignored, so a checkout that never set
 *  NEXT_PUBLIC_SITE_URL used to advertise `localhost:3000` from production. Vercel injects
 *  NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL on every deployment, and it is the *production* host
 *  rather than the per-deployment one, so preview builds still emit canonical URLs that point at
 *  the real site instead of at themselves. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

/** Where a guest manages their own booking, in the language they booked in. The token is the
 *  credential, so this link only ever goes to the guest it belongs to. */
export const manageUrl = (token: string, locale: Locale = DEFAULT_LOCALE) =>
  `${SITE_URL}${localeHref(locale, `/reservierung/${token}`)}`;

/** Manage tokens are 18 random bytes as hex (migration 20261012093558). Checking the shape before a
 *  round trip keeps obvious junk out of the database and out of the RPC. */
const MANAGE_TOKEN = /^[0-9a-f]{36}$/;

export const isManageToken = (token: string) => MANAGE_TOKEN.test(token);

/** Where a guest follows their own pre-order, and where they withdraw consent for the specials
 *  list. Both were built by hand from SITE_URL at their call sites, which is how manageUrl() above
 *  ended up being the only one of the three that could be changed in one place. */
export const preorderUrl = (token: string, locale: Locale = DEFAULT_LOCALE) =>
  `${SITE_URL}${localeHref(locale, `/vorbestellung/${token}`)}`;
export const unsubscribeUrl = (token: string) => `${SITE_URL}/abmelden/${token}`;
