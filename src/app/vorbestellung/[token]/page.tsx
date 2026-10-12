import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPreorderByToken } from "@/app/vorbestellen/actions";
import { ManagePreorder } from "@/components/manage-preorder";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CONTACT, whatsappHref } from "@/lib/contact";

export const metadata: Metadata = {
  // Same reasoning as /reservierung/<token>: the token in the URL is the credential for one order.
  title: "Deine Vorbestellung",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function PreorderStatusPage(props: PageProps<"/vorbestellung/[token]">) {
  return (
    <div className="site">
      <Suspense fallback={null}>
        <SiteHeader whatsappHref={whatsappHref()} phoneHref={`tel:${CONTACT.phoneE164}`} />
      </Suspense>
      <main>
        <section className="section">
          <div className="manage-shell">
            <div className="section-heading">
              <p className="eyebrow">Tu encargo</p>
              <h1>Deine Vorbestellung</h1>
            </div>
            <Suspense fallback={<p className="manage-hint">Vorbestellung wird geladen …</p>}>
              <Order params={props.params} />
            </Suspense>
            <p className="manage-hint">
              Fragen? Ruf uns an unter <a href={`tel:${CONTACT.phoneE164}`}>{CONTACT.phoneDisplay}</a> oder schreib uns
              per{" "}
              <a href={whatsappHref()} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
              . Zur <Link href="/">Startseite</Link>.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

async function Order({ params }: Pick<PageProps<"/vorbestellung/[token]">, "params">) {
  const { token } = await params;
  const order = await getPreorderByToken(token);
  if (!order) notFound();
  return <ManagePreorder token={token} order={order} />;
}
