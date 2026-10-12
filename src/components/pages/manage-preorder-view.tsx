import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPreorderByToken } from "@/app/vorbestellen/actions";
import { ManagePreorder } from "@/components/manage-preorder";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CONTACT, whatsappHref } from "@/lib/contact";
import { getDictionary } from "@/lib/dictionaries";
import { localeHref, type Locale } from "@/lib/i18n";

export const MANAGE_PREORDER_PATH = "/vorbestellung";

export function ManagePreorderView({
  locale,
  params,
}: {
  locale: Locale;
  params: PageProps<"/vorbestellung/[token]">["params"];
}) {
  const t = getDictionary(locale).managePreorder;
  return (
    <div className="site" lang={locale}>
      <Suspense fallback={null}>
        <SiteHeader whatsappHref={whatsappHref()} locale={locale} path="/" />
      </Suspense>
      <main id="main">
        <section className="section">
          <div className="manage-shell">
            <div className="section-heading">
              <p className="eyebrow">{t.eyebrow}</p>
              <h1>{t.title}</h1>
            </div>
            <Suspense fallback={<p className="manage-hint">{t.loading}</p>}>
              <Order locale={locale} params={params} />
            </Suspense>
            <p className="manage-hint">
              {getDictionary(locale).manage.questionsBefore}
              <a href={`tel:${CONTACT.phoneE164}`}>{CONTACT.phoneDisplay}</a>
              {getDictionary(locale).manage.questionsMiddle}
              <a href={whatsappHref()} target="_blank" rel="noreferrer">
                {getDictionary(locale).manage.questionsWhatsapp}
              </a>
              {getDictionary(locale).manage.questionsAfter}
              <Link href={localeHref(locale, "/")}>{getDictionary(locale).manage.homeLink}</Link>
              {getDictionary(locale).manage.questionsEnd}
            </p>
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}

async function Order({ locale, params }: { locale: Locale; params: PageProps<"/vorbestellung/[token]">["params"] }) {
  const { token } = await params;
  const order = await getPreorderByToken(token);
  if (!order) notFound();
  return <ManagePreorder locale={locale} token={token} order={order} />;
}
