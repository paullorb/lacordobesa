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
  // Both query ends are inclusive, so today plus the 89 days before it make the 90.
  const from = addDays(today, -(WINDOW_DAYS - 1));

  const [{ data: reservations }, preorders] = await Promise.all([
    // Bounded at both ends: a booking for next Friday has not happened yet, so letting it into the
    // weekday pattern or the cancellation rate would describe the future rather than the business.
    supabase.from("reservations").select("date, party_size, status").gte("date", from).lte("date", today),
    supabase
      .from("preorder_lines")
      .select("label, quantity, preorders!inner(pickup_date)")
      .gte("preorders.pickup_date", from)
      .lte("preorders.pickup_date", today),
  ]);

  const stats = reservationStats(reservations ?? [], today);
  const dishes = preorders.error ? [] : topPreorderedDishes(preorders.data ?? []);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">Zahlen</h1>
        <p className="text-sm text-muted">
          Die letzten {WINDOW_DAYS} Tage, ab {fmtDateDE(from)}. „Gäste“ zählt Plätze, ohne Stornierungen und Nichterscheinen.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Tile label="Gäste heute" value={stats.coversToday} />
        <Tile label="Gäste diese Woche" value={stats.coversWeek} />
        <Tile label="Gäste diesen Monat" value={stats.coversMonth} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <RateTile label="Nicht erschienen" rate={stats.noShow} hint="Anteil der vergangenen Reservierungen" />
        <RateTile label="Storniert" rate={stats.cancelled} hint="Anteil der vergangenen Reservierungen" />
      </section>

      <section className="card grid gap-6 lg:grid-cols-2">
        <BarList caption={`Gäste pro Wochentag (${WINDOW_DAYS} Tage)`} valueLabel="Gäste" bars={stats.byWeekday} />
        <BarList caption="Am häufigsten vorbestellt" valueLabel="Menge" bars={dishes} />
      </section>
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
