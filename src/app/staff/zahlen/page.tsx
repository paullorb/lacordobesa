import { Suspense } from "react";
import { StaffLoading } from "@/components/staff/card-bits";
import { BarList } from "@/components/staff/bar-list";
import { requireStaff } from "@/lib/auth";
import { addDays, fmtDateDE, todayISO } from "@/lib/dates";
import { reservationStats, topPreorderedDishes, type Rate } from "@/lib/staff-stats";

export const metadata = { title: "Zahlen" };

/** How far back the page looks. Long enough for a weekday pattern to mean something, short enough
 *  that one bounded query answers everything. */
const WINDOW_DAYS = 90;

export default function NumbersPage() {
  return (
    <Suspense fallback={<StaffLoading />}>
      <Numbers />
    </Suspense>
  );
}

async function Numbers() {
  const { supabase } = await requireStaff();
  const today = todayISO();
  const from = addDays(today, -WINDOW_DAYS);

  const [{ data: reservations }, preorders, inquiries] = await Promise.all([
    // Bounded at both ends: a booking for next Friday has not happened yet, so letting it into the
    // weekday pattern or the cancellation rate would describe the future rather than the business.
    supabase.from("reservations").select("date, start_time, party_size, status, source").gte("date", from).lte("date", today),
    // Both tables arrive with later migrations; an error here means "not deployed yet", not "broken".
    supabase
      .from("preorder_lines")
      .select("label, quantity, preorders!inner(pickup_date)")
      .gte("preorders.pickup_date", from)
      .lte("preorders.pickup_date", today),
    supabase.from("event_inquiries").select("status"),
  ]);

  const stats = reservationStats(reservations ?? [], today);
  const dishes = preorders.error ? [] : topPreorderedDishes(preorders.data ?? []);
  const openInquiries = inquiries.error
    ? null
    : (inquiries.data ?? []).filter((i) => i.status === "new" || i.status === "in_progress" || i.status === "quoted").length;
  const wonInquiries = inquiries.error ? null : (inquiries.data ?? []).filter((i) => i.status === "won").length;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">Zahlen</h1>
        <p className="text-sm text-muted">
          Reservierungen und Gäste der letzten {WINDOW_DAYS} Tage, also ab {fmtDateDE(from)}. „Gäste“ zählt Plätze, nicht
          Buchungen, und zählt Stornierungen und Nichterscheinen nicht mit.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Tile label="Gäste heute" value={stats.coversToday} />
        <Tile label="Gäste diese Woche" value={stats.coversWeek} />
        <Tile label="Gäste diesen Monat" value={stats.coversMonth} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Reservierungen im Zeitraum" value={stats.bookingsWindow} />
        <RateTile label="Nicht erschienen" rate={stats.noShow} hint="Anteil der vergangenen Reservierungen" />
        <RateTile label="Storniert" rate={stats.cancelled} hint="Anteil aller Reservierungen" />
        <RateTile label="Über die Website" rate={stats.online} hint="Rest kam per Telefon oder vor Ort" />
      </section>

      <section className="card grid gap-6 lg:grid-cols-2">
        <BarList caption={`Gäste pro Wochentag (${WINDOW_DAYS} Tage)`} valueLabel="Gäste" bars={stats.byWeekday} />
        <BarList caption={`Gäste pro Uhrzeit (${WINDOW_DAYS} Tage)`} valueLabel="Gäste" bars={stats.byHour} />
      </section>

      <section className="card grid gap-6 lg:grid-cols-2">
        {preorders.error ? (
          <p className="text-sm text-muted">
            Vorbestellungen erscheinen hier, sobald die Datenbank-Migration 20261012094815 eingespielt ist.
          </p>
        ) : (
          <BarList caption="Am häufigsten vorbestellt" valueLabel="Menge" bars={dishes} />
        )}
        <div className="grid content-start gap-3">
          <h2 className="text-sm font-semibold">Feier-Anfragen</h2>
          {openInquiries === null ? (
            <p className="text-sm text-muted">
              Erscheint hier, sobald die Datenbank-Migration 20261012095610 eingespielt ist.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Tile label="Offen" value={openInquiries} />
              <Tile label="Gewonnen" value={wonInquiries ?? 0} />
            </div>
          )}
        </div>
      </section>

      {stats.averageParty !== null && (
        <p className="text-sm text-muted">
          Durchschnittliche Gruppengröße: {stats.averageParty.toLocaleString("de-DE")} Personen pro Reservierung.
        </p>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-serif text-4xl tabular-nums">{value}</p>
    </div>
  );
}

/** A share always shows its denominator: "3 von 48" is actionable where a bare 6 % is not, and
 *  "noch keine Daten" is the honest answer when the denominator is zero. */
function RateTile({ label, rate, hint }: { label: string; rate: Rate; hint: string }) {
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      {rate.percent === null ? (
        <p className="mt-1 text-sm text-muted">Noch keine Daten.</p>
      ) : (
        <>
          <p className="mt-1 font-serif text-4xl tabular-nums">{rate.percent} %</p>
          <p className="text-xs text-muted">
            {rate.value} von {rate.of} · {hint}
          </p>
        </>
      )}
    </div>
  );
}
