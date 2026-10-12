import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { UnsubscribeButton } from "@/components/unsubscribe-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CONTACT, whatsappHref } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Abmelden",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Withdrawing consent. One click, no login, no confirmation step and no "are you sure", because
 *  that is what an easy withdrawal of consent means. The page never reveals whether the token was
 *  valid, so it cannot be used to check whether an address is on the list. */
export default function UnsubscribePage(props: PageProps<"/abmelden/[token]">) {
  return (
    <div className="site">
      <Suspense fallback={null}>
        <SiteHeader whatsappHref={whatsappHref()} phoneHref={`tel:${CONTACT.phoneE164}`} />
      </Suspense>
      <main>
        <section className="section">
          <div className="manage-shell">
            <div className="section-heading">
              <p className="eyebrow">Hasta luego</p>
              <h1>Keine Specials mehr</h1>
              <p>Ein Klick und wir schreiben dir nicht mehr über Specials. Deine Reservierungen bleiben davon unberührt.</p>
            </div>
            <Suspense fallback={<p className="manage-hint">Lade …</p>}>
              <Button params={props.params} />
            </Suspense>
            <p className="manage-hint">
              Versehen? Du kannst dich auf der <Link href="/#specials">Startseite</Link> jederzeit wieder anmelden. Fragen?{" "}
              <a href={`tel:${CONTACT.phoneE164}`}>{CONTACT.phoneDisplay}</a>.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

async function Button({ params }: Pick<PageProps<"/abmelden/[token]">, "params">) {
  const { token } = await params;
  return <UnsubscribeButton token={token} />;
}
