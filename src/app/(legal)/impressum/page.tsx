import type { Metadata } from "next";
import { CONTACT } from "@/lib/contact";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Impressum", robots: { index: false } };

export default function ImpressumPage() {
  return (
    <article className="section legal-copy">
      <p className="eyebrow">Angaben gemäß § 5 DDG</p>
      <h1>Impressum</h1>

      <h2>Anbieter</h2>
      <p>
        {LEGAL.ownerName}
        <br />
        {LEGAL.businessName}
        <br />
        {CONTACT.street}
        <br />
        {CONTACT.city}
      </p>

      <h2>Kontakt</h2>
      <p>
        Telefon: <a href={`tel:${CONTACT.phoneE164}`}>{CONTACT.phoneDisplay}</a>
        <br />
        E-Mail: <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
      </p>

      {LEGAL.vatId && (
        <>
          <h2>Umsatzsteuer-ID</h2>
          <p>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: {LEGAL.vatId}</p>
        </>
      )}

      <h2>Verantwortlich für den Inhalt</h2>
      <p>
        {LEGAL.ownerName}, {CONTACT.street}, {CONTACT.city}
      </p>

      <h2>Streitbeilegung</h2>
      <p>
        Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </p>

      <h2>Haftung für Inhalte und Links</h2>
      <p>
        Die Inhalte dieser Seite wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und
        Aktualität können wir jedoch keine Gewähr übernehmen. Diese Seite enthält Links zu externen Websites Dritter
        (Instagram, WhatsApp, Google Maps), auf deren Inhalte wir keinen Einfluss haben. Für diese Inhalte ist stets
        der jeweilige Anbieter verantwortlich.
      </p>

      <h2>Bildnachweis</h2>
      <p>Das Stimmungsbild auf der Startseite ist eine illustrative Darstellung und zeigt nicht zwingend das tatsächliche Angebot.</p>
    </article>
  );
}
