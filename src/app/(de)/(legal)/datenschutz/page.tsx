import type { Metadata } from "next";
import { CONTACT } from "@/lib/contact";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Datenschutzerklärung", robots: { index: false } };

export default function DatenschutzPage() {
  return (
    <article className="section legal-copy">
      <p className="eyebrow">Stand: {LEGAL.privacyUpdated}</p>
      <h1>Datenschutzerklärung</h1>

      <h2>1. Verantwortlicher</h2>
      <p>
        {LEGAL.ownerName}
        <br />
        {LEGAL.businessName}
        <br />
        {CONTACT.street}, {CONTACT.city}
        <br />
        Telefon: <a href={`tel:${CONTACT.phoneE164}`}>{CONTACT.phoneDisplay}</a> · E-Mail:{" "}
        <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
      </p>

      <h2>2. Hosting und Server-Logfiles</h2>
      <p>
        Diese Website wird bei Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA gehostet. Beim Aufruf der
        Seite verarbeitet Vercel technisch notwendige Daten (IP-Adresse, Datum und Uhrzeit, aufgerufene Seite,
        Browser- und Betriebssystemtyp, Referrer) in Server-Logfiles. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO
        (berechtigtes Interesse an einem sicheren und stabilen Betrieb). Vercel ist nach dem EU-US Data Privacy
        Framework zertifiziert; zusätzlich bestehen Standardvertragsklauseln. Weitere Informationen:{" "}
        <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer">
          vercel.com/legal/privacy-policy
        </a>
        .
      </p>
      <p>
        Damit niemand unsere Formulare (Reservierung, Warteliste, Vorbestellung, Feier-Anfrage, Specials)
        automatisiert überfluten kann, speichern wir beim Absenden einen pseudonymisierten Prüfwert deiner IP-Adresse,
        nie die Adresse selbst, und löschen ihn nach 24 Stunden. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO
        (berechtigtes Interesse daran, die Formulare für echte Gäste verfügbar zu halten).
      </p>

      <h2>3. Tischreservierung</h2>
      <p>
        Wenn du über das Reservierungsformular einen Tisch anfragst, verarbeiten wir die von dir eingegebenen Daten:
        Name, Telefonnummer, optional E-Mail-Adresse und Anmerkungen, sowie Datum, Uhrzeit und Personenzahl. Wir
        nutzen diese Daten ausschließlich, um die Reservierung zu bearbeiten, zu bestätigen und, bei Bedarf,
        Rückfragen zu stellen, zum Beispiel per Telefon, WhatsApp oder E-Mail.
      </p>
      <p>
        Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Durchführung vorvertraglicher Maßnahmen bzw.
        Vertragserfüllung). Die Daten werden in einer Datenbank bei Supabase Inc. (970 Toa Payoh North #07-04,
        Singapore 318992) gespeichert; der Datenbankserver befindet sich in Frankfurt am Main (AWS-Region
        eu-central-1). Mit Supabase besteht ein Auftragsverarbeitungsvertrag. Reservierungsdaten werden{" "}
        {LEGAL.reservationRetention} nach dem Reservierungstermin gelöscht, sofern keine gesetzlichen
        Aufbewahrungspflichten entgegenstehen.
      </p>

      <h2>3a. Vorbestellungen, Feier-Anfragen und Warteliste</h2>
      <p>
        Für Vorbestellungen zum Abholen, Anfragen zu Feiern und Catering sowie für die Warteliste gilt das Gleiche wie
        für die Tischreservierung: Wir verarbeiten Name, Telefonnummer, optional E-Mail-Adresse und deine Angaben zur
        Bestellung beziehungsweise zur Feier, um die Anfrage zu bearbeiten und dich zu erreichen. Rechtsgrundlage ist
        Art. 6 Abs. 1 lit. b DSGVO. Speicherort und Auftragsverarbeitung entsprechen Abschnitt 3.
      </p>

      <h2>3b. Specials per WhatsApp und E-Mail</h2>
      <p>
        Wenn du dich für unsere Specials anmeldest, speichern wir deine Handynummer, optional deinen Namen, den
        Zeitpunkt deiner Anmeldung und den Wortlaut der Einwilligung, der dir beim Anmelden angezeigt wurde. Den
        Wortlaut speichern wir, um nachweisen zu können, wozu genau du zugestimmt hast.
      </p>
      <p>
        Damit niemand eine fremde Nummer eintragen kann, bestätigst du die Anmeldung, indem du uns von dieser Nummer
        eine WhatsApp schickst (Double-Opt-in). Erst dann nehmen wir dich in die Liste auf und speichern, wann die
        Bestätigung eingegangen ist. An eine Nummer ohne Bestätigung schicken wir keine Specials.
      </p>
      <p>
        Wenn du E-Mail auswählst, schicken wir dir einen einmaligen Bestätigungslink. Erst wenn du ihn auf der
        Bestätigungsseite anklickst, nehmen wir deine Adresse in den Verteiler auf. Die Bestätigungsnachricht wird über
        unseren Versanddienstleister Resend verschickt. Nicht bestätigte Adressen erhalten keine Specials.
      </p>
      <p>
        Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Du kannst sie jederzeit widerrufen, ohne
        Angabe von Gründen und ohne Nachteile: In jeder Nachricht steht ein Abmeldelink, der dich mit einem Klick
        abmeldet. Nach dem Widerruf verschicken wir dir keine Specials mehr; die Angabe, dass und wann eine
        Einwilligung erteilt und widerrufen wurde, bewahren wir als Nachweis auf. Deine Reservierungen und
        Bestellungen bleiben von einer Abmeldung unberührt.
      </p>

      <h2>4. Kontaktaufnahme</h2>
      <p>
        Wenn du uns per E-Mail, Telefon oder WhatsApp kontaktierst, verarbeiten wir deine Angaben zur Bearbeitung
        der Anfrage (Art. 6 Abs. 1 lit. b bzw. lit. f DSGVO). Für WhatsApp gelten zusätzlich die Datenschutzhinweise
        der WhatsApp Ireland Ltd.; bitte beachte, dass WhatsApp Metadaten der Kommunikation verarbeitet.
      </p>

      <h2>5. Cookies und Tracking</h2>
      <p>
        Die öffentliche Website setzt keine Cookies, legt nichts im Speicher deines Browsers ab und verwendet keine
        Analyse- oder Tracking-Dienste von Dritten. Schriftarten werden lokal von unserem Server ausgeliefert; es
        findet keine Verbindung zu Google Fonts statt. Lediglich der interne, passwortgeschützte Bereich für unser
        Team setzt ein technisch notwendiges Anmelde-Cookie. Wie wir ohne Cookies zählen, was auf der Website
        passiert, steht im nächsten Abschnitt.
      </p>

      <h2>5a. Reichweitenmessung ohne Cookies</h2>
      <p>
        Damit wir sehen, welche Seiten gelesen werden und an welcher Stelle Gäste eine Reservierung abbrechen,
        zählen wir Aufrufe und Aktionen auf unserer eigenen Website. Dazu sendet dein Browser für jede aufgerufene
        Seite eine kurze Meldung an unseren eigenen Server, sobald du sie verlässt oder den Tab wechselst: die Seite
        selbst und, falls geschehen, Reservierung oder ein anderes Formular abgeschickt, erfolgreich oder
        fehlgeschlagen (ohne deine Eingaben), Klick auf Telefon, WhatsApp, E-Mail, Karte oder Instagram, ein Foto in
        der Galerie geöffnet, und eine grobe Bewertung der Ladezeit der Seite. Die Meldung enthält die aufgerufene
        Seite, die Art der Aktion, die Breite deines Browserfensters nur als Gruppe (Handy, Tablet oder Desktop) und
        beim ersten Aufruf den Namen der Website, von der du kommst, ohne deren Adresse und ohne Suchbegriffe. Aus den
        technischen Kopfdaten der Anfrage leiten wir außerdem die Browser-Familie (zum Beispiel Safari oder Chrome)
        und deine bevorzugte Sprache ab.
      </p>
      <p>
        Gespeichert werden ausschließlich Tageszähler, zum Beispiel „am 15. Oktober wurde die Karte 42 Mal auf einem
        Handy aufgerufen“. Wir vergeben keine Kennung, setzen keine Cookies, nutzen keinen lokalen Speicher, erstellen
        keinen Fingerabdruck und speichern weder deine IP-Adresse noch den Browser-Text im Ganzen. Deshalb lässt sich
        nicht erkennen, ob du schon einmal da warst oder was du an einem anderen Tag getan hast. Damit niemand die
        Zähler mit automatisierten Anfragen verfälscht, merkt sich der Server deine IP-Adresse höchstens eine Minute
        lang im Arbeitsspeicher und speichert sie nicht. Es gehen keine Daten an Dritte; die Zähler liegen in unserer
        Datenbank bei Supabase (Abschnitt 3), die Anfrage selbst läuft über Vercel (Abschnitt 2).
      </p>
      <p>
        Bots und Browser, die „Do Not Track“ oder „Global Privacy Control“ senden, zählen wir nicht. Rechtsgrundlage ist
        Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse daran, die Website an dem auszurichten, was Gäste
        tatsächlich nutzen). Wenn du nicht mitgezählt werden möchtest, aktiviere „Do Not Track“ oder „Global Privacy
        Control“ in deinem Browser oder widersprich uns nach Abschnitt 7.
      </p>

      <h2>6. Externe Links</h2>
      <p>
        Die Website verlinkt auf Instagram (Meta Platforms Ireland Ltd.), WhatsApp (WhatsApp Ireland Ltd.) und
        Google Maps (Google Ireland Ltd.) und OpenStreetMap (OpenStreetMap Foundation). Beim Aufruf dieser Links verlässt du unsere Website; erst dann werden
        Daten an den jeweiligen Anbieter übertragen. Inhalte von Instagram und WhatsApp werden nicht in unsere Seite
        eingebettet.
      </p>

      <h2>6a. Karten im Bereich „Besuch uns“</h2>
      <p>
        Zur Anzeige unseres Standorts kannst du zwischen einer Karte von Google Maps (Google Ireland Ltd., Gordon
        House, Barrow Street, Dublin 4, Irland) und OpenStreetMap (OpenStreetMap Foundation, St John’s Innovation
        Centre, Cowley Road, Cambridge, CB4 0WS, Vereinigtes Königreich) wählen. Die eingebettete Karte des
        ausgewählten Anbieters wird erst nach deinem Klick auf die entsprechende Schaltfläche geladen. Mit dem Klick
        willigst du in diese Übertragung ein (Art. 6 Abs. 1 lit. a DSGVO). Dabei werden
        technische Daten wie deine IP-Adresse und Browserinformationen an den Anbieter übertragen; Google kann
        zusätzlich Cookies setzen. Ohne Auswahl wird keiner der beiden Kartendienste kontaktiert. Informationen
        findest du in den Datenschutzhinweisen von <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google</a> und
        <a href="https://wiki.osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noreferrer">OpenStreetMap</a>.
      </p>

      <h2>7. Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung
        der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) sowie Widerspruch gegen Verarbeitungen auf
        Grundlage von Art. 6 Abs. 1 lit. f DSGVO (Art. 21). Schreib uns dafür einfach an{" "}
        <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>. Außerdem hast du das Recht, dich bei einer
        Datenschutzaufsichtsbehörde zu beschweren, zum Beispiel beim Hessischen Beauftragten für Datenschutz und
        Informationsfreiheit, Postfach 3163, 65021 Wiesbaden.
      </p>

      <h2>8. Änderungen</h2>
      <p>
        Wir passen diese Datenschutzerklärung an, wenn sich unsere Website oder die Rechtslage ändert. Es gilt die
        jeweils hier veröffentlichte Fassung.
      </p>
    </article>
  );
}
