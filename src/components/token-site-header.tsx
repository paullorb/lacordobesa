import { SiteHeader } from "@/components/site-header";
import { whatsappHref } from "@/lib/contact";
import type { Locale } from "@/lib/i18n";

/** The header for a page whose URL is a token. The language switch has to keep the token, or a
 *  guest who switches language lands on the home page and loses the only link to their booking. */
export async function TokenSiteHeader({
  locale,
  basePath,
  params,
}: {
  locale: Locale;
  basePath: string;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SiteHeader whatsappHref={whatsappHref()} locale={locale} path={`${basePath}/${encodeURIComponent(token)}`} />;
}
