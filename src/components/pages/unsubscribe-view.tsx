import Link from "next/link";
import { Suspense } from "react";
import { UnsubscribeButton } from "@/components/unsubscribe-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CONTACT, whatsappHref } from "@/lib/contact";
import { getDictionary } from "@/lib/dictionaries";
import { localeHref, type Locale } from "@/lib/i18n";

/** Withdrawing consent. One click, no login, no confirmation step and no "are you sure", because
 *  that is what an easy withdrawal of consent means. The page never reveals whether the token was
 *  valid, so it cannot be used to check whether an address is on the list. */
export const UNSUBSCRIBE_PATH = "/abmelden";

export function UnsubscribeView({
  locale,
  params,
}: {
  locale: Locale;
  params: PageProps<"/abmelden/[token]">["params"];
}) {
  const t = getDictionary(locale).unsubscribe;
  return (
    <div className="site">
      <Suspense fallback={null}>
        <SiteHeader whatsappHref={whatsappHref()} locale={locale} path="/" />
      </Suspense>
      <main id="main">
        <section className="section">
          <div className="manage-shell">
            <div className="section-heading">
              <p className="eyebrow">{t.eyebrow}</p>
              <h1>{t.title}</h1>
              <p>{t.intro}</p>
            </div>
            <Suspense fallback={<p className="manage-hint">{t.loading}</p>}>
              <Button locale={locale} params={params} />
            </Suspense>
            <p className="manage-hint">
              {t.againBefore}
              <Link href={localeHref(locale, "/#specials")}>{t.againLink}</Link>
              {t.againAfter}
              <a href={`tel:${CONTACT.phoneE164}`}>{CONTACT.phoneDisplay}</a>.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}

async function Button({ locale, params }: { locale: Locale; params: PageProps<"/abmelden/[token]">["params"] }) {
  const { token } = await params;
  return <UnsubscribeButton locale={locale} token={token} />;
}
