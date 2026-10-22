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
import { requireAdmin } from "@/lib/auth";
import { addDays, fmtStaffDate, todayISO } from "@/lib/dates";

export const metadata = { title: "Visitantes" };

const WINDOW_DAYS = 30;

export default function VisitorsPage() {
  return (
    <Suspense fallback={<StaffLoading />}>
      <Visitors />
    </Suspense>
  );
}

async function Visitors() {
  const { supabase } = await requireAdmin();
  const to = todayISO();
  const from = addDays(to, -(WINDOW_DAYS - 1));

  async function by(
    event: string,
    dimension: string,
    detail?: string,
  ): Promise<{ rows: Row[] }> {
    const { data } = await supabase.rpc("analytics_breakdown", {
      p_from: from,
      p_to: to,
      p_event: event,
      p_by: dimension,
      p_detail: detail,
    });
    return {
      rows: (data ?? []).map((r) => ({
        bucket: r.bucket,
        total: Number(r.total),
      })),
    };
  }

  const [
    days,
    pages,
    referrers,
    devices,
    browsers,
    langs,
    clicks,
    submits,
    successes,
    errors,
    steps,
    vitals,
    gallery,
    maps,
  ] = await Promise.all([
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

  const count = (r: { rows: Row[] }, key: string) =>
    r.rows.find((x) => x.bucket === key)?.total ?? 0;
  const views = sum(days.rows);
  const reservationSubmits = count(submits, "reservation");
  const reservationDone = count(successes, "reservation");
  const reservationFailed = count(errors, "reservation");
  const contactClicks = sum(
    clicks.rows.filter((r) => r.bucket === "phone" || r.bucket === "whatsapp"),
  );

  const funnel = [
    { label: "Día elegido", value: count(steps, "2") },
    { label: "Hora elegida", value: count(steps, "3") },
    { label: "Personas elegidas", value: count(steps, "4") },
    { label: "Enviados", value: reservationSubmits },
    { label: "Recibidos", value: reservationDone },
  ];

  const formLines = [
    "reservation",
    "waitlist",
    "preorder",
    "inquiry",
    "specials",
  ].map((form) => ({
    form,
    label:
      {
        reservation: "Reserva",
        waitlist: "Lista de espera",
        preorder: "Pedido anticipado",
        inquiry: "Consulta para eventos",
        specials: "Specials",
      }[form] ?? form,
    submitted: count(submits, form),
    ok: count(successes, form),
    failed: count(errors, form),
  }));

  const clickLabel: Record<string, string> = {
    phone: "Llamada",
    whatsapp: "WhatsApp",
    email: "Correo",
    maps: "Google Maps",
    instagram: "Instagram",
  };

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">Visitantes</h1>
        <p className="text-sm text-muted">
          Los últimos {WINDOW_DAYS} días, desde el {fmtStaffDate(from)}. Contamos visitas y clics, no personas:
          no identificamos visitantes, así que una misma persona puede contarse varias veces. Los bots y los navegadores
          con “Do Not Track” no se cuentan; las cifras pueden ser algo menores que la realidad.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Visitas a páginas" value={views} />
        <Tile
          label="Reservas enviadas"
          value={reservationSubmits}
          hint={`${reservationDone} recibidas, ${reservationFailed} con error`}
        />
        <Tile label="Clics en teléfono o WhatsApp" value={contactClicks} />
        <Tile
          label="Fotos abiertas"
          value={sum(gallery.rows)}
          hint={`Mapa cargado: ${sum(maps.rows)}`}
        />
      </section>

      <section className="card">
        <BarList
          caption="Visitas por día (últimos 14 días)"
          valueLabel="Visitas"
          bars={dailyBars(days.rows, addDays(to, -13), to)}
        />
      </section>

      <section className="card grid gap-6 lg:grid-cols-2">
        <BarList
          caption="Páginas más vistas"
          valueLabel="Visitas"
          bars={toBars(pages.rows, pageLabel)}
        />
        <BarList
          caption="Origen de las visitas"
          valueLabel="Visitas"
          bars={toBars(referrers.rows, (k) =>
            k === "other" ? "Otros sitios" : k || "Directo o desconocido",
          )}
        />
      </section>

      <section className="card grid gap-6 lg:grid-cols-3">
        <BarList
          caption="Dispositivos"
          valueLabel="Visitas"
          bars={toBars(devices.rows, deviceLabel)}
        />
        <BarList
          caption="Navegadores"
          valueLabel="Visitas"
          bars={toBars(browsers.rows, browserLabel)}
        />
        <BarList
          caption="Idioma del navegador"
          valueLabel="Visitas"
          bars={toBars(langs.rows, langLabel)}
        />
      </section>

      <section className="card grid gap-6 lg:grid-cols-2">
        <div className="grid content-start gap-2">
          <BarList
            caption="Reserva: avance de los visitantes"
            valueLabel="Recuento"
            bars={funnel}
          />
          <p className="text-xs text-muted">
            Si alguien vuelve a un paso anterior y avanza otra vez, se cuenta de nuevo. Sirve para comparar pasos,
            no como número exacto de personas.
          </p>
        </div>
        <BarList
          caption="Clics de contacto"
          valueLabel="Clics"
          bars={toBars(clicks.rows, (k) => clickLabel[k] ?? k)}
        />
      </section>

      {/* min-w-0 plus a scrolling wrapper, because a table never shrinks below the sum of its
          columns' min-content and a grid track never shrinks below its item: without both, these
          four columns made the whole page 395px wide inside a 390px phone, which is the same
          failure the staff menu editor had (tests/README.md). */}
      <section className="card grid min-w-0 gap-2">
        <h2 className="text-sm font-semibold">Formularios</h2>
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="py-1 pr-3 font-semibold">Formulario</th>
                <th className="py-1 pr-3 text-right font-semibold">
                  Enviados
                </th>
                <th className="py-1 pr-3 text-right font-semibold">
                  Recibidos
                </th>
                <th className="py-1 text-right font-semibold">Errores</th>
              </tr>
            </thead>
            <tbody>
              {formLines.map((f) => (
                <tr key={f.form} className="border-t border-line">
                  <th scope="row" className="py-1 pr-3 text-left font-normal">
                    {f.label}
                  </th>
                  <td className="py-1 pr-3 text-right tabular-nums">
                    {f.submitted}
                  </td>
                  <td className="py-1 pr-3 text-right tabular-nums">{f.ok}</td>
                  <td className="py-1 text-right tabular-nums">{f.failed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card grid min-w-0 gap-2">
        <h2 className="text-sm font-semibold">Rendimiento (Web Vitals)</h2>
        <p className="text-xs text-muted">
          Cuántas visitas alcanzan el nivel “bueno” del navegador. LCP: cuándo aparece el contenido principal.
          CLS: cuánto se desplaza la página. INP: qué tan rápido responde a los toques.
        </p>
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="py-1 pr-3 font-semibold">Medida</th>
                <th className="py-1 pr-3 text-right font-semibold">Bueno</th>
                <th className="py-1 pr-3 text-right font-semibold">Medio</th>
                <th className="py-1 pr-3 text-right font-semibold">Malo</th>
                <th className="py-1 text-right font-semibold">Porcentaje bueno</th>
              </tr>
            </thead>
            <tbody>
              {vitalLines(vitals.rows, VITALS).map((v) => (
                <tr key={v.name} className="border-t border-line">
                  <th scope="row" className="py-1 pr-3 text-left font-normal">
                    {v.name}
                  </th>
                  <td className="py-1 pr-3 text-right tabular-nums">
                    {v.good}
                  </td>
                  <td className="py-1 pr-3 text-right tabular-nums">
                    {v.improve}
                  </td>
                  <td className="py-1 pr-3 text-right tabular-nums">
                    {v.poor}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {v.goodPercent === null
                      ? "sin datos"
                      : `${v.goodPercent} %`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="mt-1 font-serif text-4xl tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
