import { Suspense } from "react";
import { StaffLoading } from "@/components/staff/card-bits";
import { BarList } from "@/components/staff/bar-list";
import { VITALS } from "@/lib/analytics";
import {
  browserLabel,
  dailyBars,
  deviceLabel,
  langLabel,
  pageLabel,
  sum,
  toBars,
  vitalLines,
  type Row,
} from "@/lib/analytics-view";
import { requireStaff } from "@/lib/auth";
import { addDays, fmtDateDE, todayISO } from "@/lib/dates";

export const metadata = { title: "Besucher" };

const WINDOW_DAYS = 30;

export default function VisitorsPage() {
  return (
    <Suspense fallback={<StaffLoading />}>
      <Visitors />
    </Suspense>
  );
}

async function Visitors() {
  const { supabase } = await requireStaff();
  const to = todayISO();
  const from = addDays(to, -(WINDOW_DAYS - 1));

  async function by(event: string, dimension: string, detail?: string): Promise<{ rows: Row[]; failed: boolean }> {
    const { data, error } = await supabase.rpc("analytics_breakdown", {
      p_from: from,
      p_to: to,
      p_event: event,
      p_by: dimension,
      p_detail: detail,
    });
    return { rows: (data ?? []).map((r) => ({ bucket: r.bucket, total: Number(r.total) })), failed: !!error };
  }

  const [days, pages, referrers, devices, browsers, langs, clicks, submits, successes, errors, steps, vitals, gallery, maps] =
    await Promise.all([
      by("pageview", "day"),
      by("pageview", "path"),
      by("pageview", "referrer"),
      by("pageview", "device"),
      by("pageview", "browser"),
      by("pageview", "lang"),
      by("click", "detail"),
      by("form_submit", "detail"),
      by("form_success", "detail"),
      by("form_error", "detail"),
      by("reservation_step", "detail"),
      by("vital", "detail"),
      by("gallery_open", "day"),
      by("map_load", "day"),
    ]);

  // The function arrives with a migration; until then every call fails the same way.
  if (days.failed) {
    return (
      <div className="grid gap-2">
        <h1 className="font-serif text-3xl">Besucher</h1>
        <p className="text-sm text-muted">
          Die Besucherzahlen erscheinen hier, sobald die Datenbank-Migration 20261015085039 eingespielt ist.
        </p>
      </div>
    );
  }

  const count = (r: { rows: Row[] }, key: string) => r.rows.find((x) => x.bucket === key)?.total ?? 0;
  const views = sum(days.rows);
  const reservationSubmits = count(submits, "reservation");
  const reservationDone = count(successes, "reservation");
  const reservationFailed = count(errors, "reservation");
  const contactClicks = sum(clicks.rows.filter((r) => r.bucket === "phone" || r.bucket === "whatsapp"));

  const funnel = [
    { label: "Tag gewählt", value: count(steps, "2") },
    { label: "Uhrzeit gewählt", value: count(steps, "3") },
    { label: "Personen gewählt", value: count(steps, "4") },
    { label: "Abgeschickt", value: reservationSubmits },
    { label: "Angekommen", value: reservationDone },
  ];

  const formLines = ["reservation", "waitlist", "preorder", "inquiry", "specials"].map((form) => ({
    form,
    label: { reservation: "Reservierung", waitlist: "Warteliste", preorder: "Vorbestellung", inquiry: "Feier-Anfrage", specials: "Specials" }[form] ?? form,
    submitted: count(submits, form),
    ok: count(successes, form),
    failed: count(errors, form),
  }));

  const clickLabel: Record<string, string> = {
    phone: "Anruf",
    whatsapp: "WhatsApp",
    email: "E-Mail",
    maps: "Google Maps",
    instagram: "Instagram",
  };

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">Besucher</h1>
        <p className="text-sm text-muted">
          Die letzten {WINDOW_DAYS} Tage, also ab {fmtDateDE(from)}. Gezählt werden Aufrufe und Klicks, nicht Personen:
          Es gibt bewusst keine Kennung, deshalb lässt sich nicht sagen, ob jemand zweimal da war. Bots und Browser mit
          „Do Not Track“ zählen nicht mit, die Zahlen liegen also eher etwas unter der Wirklichkeit.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Seitenaufrufe" value={views} />
        <Tile label="Reservierungen abgeschickt" value={reservationSubmits} hint={`${reservationDone} angekommen, ${reservationFailed} mit Fehler`} />
        <Tile label="Klicks auf Anruf oder WhatsApp" value={contactClicks} />
        <Tile label="Fotos geöffnet" value={sum(gallery.rows)} hint={`Karte geladen: ${sum(maps.rows)}`} />
      </section>

      <section className="card">
        <BarList caption="Seitenaufrufe pro Tag (letzte 14 Tage)" valueLabel="Aufrufe" bars={dailyBars(days.rows, addDays(to, -13), to)} />
      </section>

      <section className="card grid gap-6 lg:grid-cols-2">
        <BarList caption="Beliebteste Seiten" valueLabel="Aufrufe" bars={toBars(pages.rows, pageLabel)} />
        <BarList
          caption="Woher die Besucher kommen"
          valueLabel="Aufrufe"
          bars={toBars(referrers.rows, (k) => k || "Direkt oder unbekannt")}
        />
      </section>

      <section className="card grid gap-6 lg:grid-cols-3">
        <BarList caption="Geräte" valueLabel="Aufrufe" bars={toBars(devices.rows, deviceLabel)} />
        <BarList caption="Browser" valueLabel="Aufrufe" bars={toBars(browsers.rows, browserLabel)} />
        <BarList caption="Sprache des Browsers" valueLabel="Aufrufe" bars={toBars(langs.rows, langLabel)} />
      </section>

      <section className="card grid gap-6 lg:grid-cols-2">
        <div className="grid content-start gap-2">
          <BarList caption="Reservierung: wie weit kommen die Gäste?" valueLabel="Zähler" bars={funnel} />
          <p className="text-xs text-muted">
            Wer einen Schritt zurückgeht und wieder vor, wird erneut gezählt. Gedacht zum Vergleichen der Stufen, nicht
            als exakte Anzahl Gäste.
          </p>
        </div>
        <BarList
          caption="Kontakt-Klicks"
          valueLabel="Klicks"
          bars={toBars(clicks.rows, (k) => clickLabel[k] ?? k)}
        />
      </section>

      <section className="card grid gap-2">
        <h2 className="text-sm font-semibold">Formulare</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted">
              <th className="py-1 pr-3 font-semibold">Formular</th>
              <th className="py-1 pr-3 text-right font-semibold">Abgeschickt</th>
              <th className="py-1 pr-3 text-right font-semibold">Angekommen</th>
              <th className="py-1 text-right font-semibold">Fehler</th>
            </tr>
          </thead>
          <tbody>
            {formLines.map((f) => (
              <tr key={f.form} className="border-t border-line">
                <th scope="row" className="py-1 pr-3 text-left font-normal">{f.label}</th>
                <td className="py-1 pr-3 text-right tabular-nums">{f.submitted}</td>
                <td className="py-1 pr-3 text-right tabular-nums">{f.ok}</td>
                <td className="py-1 text-right tabular-nums">{f.failed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card grid gap-2">
        <h2 className="text-sm font-semibold">Ladezeit (Web Vitals)</h2>
        <p className="text-xs text-muted">
          Wie viele Aufrufe die Schwelle „gut“ des Browsers erreichen. LCP: wann der Hauptinhalt steht. CLS: wie stark die
          Seite springt. INP: wie schnell sie auf Tippen reagiert.
        </p>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted">
              <th className="py-1 pr-3 font-semibold">Messwert</th>
              <th className="py-1 pr-3 text-right font-semibold">Gut</th>
              <th className="py-1 pr-3 text-right font-semibold">Mittel</th>
              <th className="py-1 pr-3 text-right font-semibold">Schlecht</th>
              <th className="py-1 text-right font-semibold">Anteil gut</th>
            </tr>
          </thead>
          <tbody>
            {vitalLines(vitals.rows, VITALS).map((v) => (
              <tr key={v.name} className="border-t border-line">
                <th scope="row" className="py-1 pr-3 text-left font-normal">{v.name}</th>
                <td className="py-1 pr-3 text-right tabular-nums">{v.good}</td>
                <td className="py-1 pr-3 text-right tabular-nums">{v.improve}</td>
                <td className="py-1 pr-3 text-right tabular-nums">{v.poor}</td>
                <td className="py-1 text-right tabular-nums">{v.goodPercent === null ? "keine Daten" : `${v.goodPercent} %`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-serif text-4xl tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
