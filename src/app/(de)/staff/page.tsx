import Link from "next/link";
import { Suspense } from "react";
import { StaffLoading } from "@/components/staff/card-bits";
import { ReservationCard } from "@/components/staff/reservation-card";
import { requireStaff } from "@/lib/auth";
import { fmtTime } from "@/lib/data";
import { fmtDateDE, todayISO } from "@/lib/dates";
import { PREORDER_STATUS_LABEL } from "@/lib/statuses";

export const metadata = { title: "Heute" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<StaffLoading />}>
      <Dashboard />
    </Suspense>
  );
}

/** The one-glance page: what needs an answer, what is being picked up, who is waiting, who is
 *  coming. A block with nothing in it is not rendered, so a quiet day is a short page. */
async function Dashboard() {
  const { supabase } = await requireStaff();
  const today = todayISO();

  const [{ data: todays }, { count: pendingCount }, { data: upcomingPending }, { data: pickups }, { data: waiting }] =
    await Promise.all([
      supabase.from("reservations").select("*").eq("date", today).neq("status", "cancelled").order("start_time"),
      supabase.from("reservations").select("*", { count: "exact", head: true }).eq("status", "pending").gte("date", today),
      supabase
        .from("reservations")
        .select("*")
        .eq("status", "pending")
        .gte("date", today)
        .order("date")
        .order("start_time")
        .limit(10),
      // Only what the glance needs: the line quantities for a count, not the lines themselves. A
      // missing table (migration not deployed) answers with an error and `data: null`, which just
      // hides the block.
      supabase
        .from("preorders")
        .select("id, name, pickup_time, status, preorder_lines(quantity)")
        .eq("pickup_date", today)
        .in("status", ["pending", "confirmed", "ready"])
        .order("pickup_time"),
      supabase
        .from("waitlist_entries")
        .select("id, name, party_size")
        .eq("date", today)
        .eq("status", "waiting")
        .order("created_at"),
    ]);

  const seats = (todays ?? []).filter((r) => r.status !== "no_show").reduce((n, r) => n + r.party_size, 0);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">{fmtDateDE(today, { weekday: "long" })}</h1>
        <p className="text-sm text-muted">
          {todays?.length ?? 0} Reservierungen · {seats} Gäste
        </p>
      </div>

      {(pendingCount ?? 0) > 0 && (
        <section className="card border-amber-200 bg-amber-50">
          <h2 className="mb-3 font-semibold">
            {pendingCount} offene {pendingCount === 1 ? "Anfrage" : "Anfragen"} warten auf Bestätigung
          </h2>
          <div className="grid gap-3">
            {upcomingPending?.map((r) => <ReservationCard key={r.id} r={r} showDate />)}
          </div>
        </section>
      )}

      {pickups && pickups.length > 0 && (
        <section className="card">
          <h2 className="mb-3 font-semibold">Heute abzuholen</h2>
          <ul className="grid gap-2">
            {pickups.map((o) => {
              const items = o.preorder_lines.reduce((n, l) => n + l.quantity, 0);
              return (
                <li key={o.id}>
                  <Link
                    href="/staff/vorbestellungen"
                    className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-1 hover:bg-mint"
                  >
                    <strong className="font-serif text-lg tabular-nums">{fmtTime(o.pickup_time)}</strong>
                    <span className="font-semibold">{o.name}</span>
                    <span className="text-sm text-muted">{items} Stück</span>
                    <span className={`status status-${o.status}`}>{PREORDER_STATUS_LABEL[o.status]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {waiting && waiting.length > 0 && (
        <section className="card">
          <h2 className="mb-3 font-semibold">Warteliste heute</h2>
          <ul className="grid gap-2">
            {waiting.map((w) => (
              <li key={w.id}>
                <Link
                  href="/staff/warteliste"
                  className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-1 hover:bg-mint"
                >
                  <span className="font-semibold">{w.name}</span>
                  <span className="text-sm text-muted">
                    {w.party_size} {w.party_size === 1 ? "Person" : "Personen"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-semibold">Heute</h2>
        {todays && todays.length > 0 ? (
          <div className="grid gap-3">
            {todays.map((r) => (
              <ReservationCard key={r.id} r={r} />
            ))}
          </div>
        ) : (
          <p className="card text-sm text-muted">Keine Reservierungen für heute.</p>
        )}
      </section>

      <p>
        <Link href="/staff/reservierungen" className="inline-flex min-h-10 items-center text-sm text-blue-dark underline">
          Alle Reservierungen und Kalender
        </Link>
      </p>
    </div>
  );
}
