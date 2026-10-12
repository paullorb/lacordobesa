import Link from "next/link";
import { Suspense } from "react";
import { ReservationCard } from "@/components/admin/reservation-card";
import { requireStaff } from "@/lib/auth";
import { addDays, fmtDateDE, todayISO } from "@/lib/dates";

export const metadata = { title: "Heute" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Lade …</p>}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const { supabase } = await requireStaff();
  const today = todayISO();

  const [{ data: todays }, { count: pendingCount }, { data: upcomingPending }] = await Promise.all([
    supabase
      .from("reservations")
      .select("*")
      .eq("date", today)
      .neq("status", "cancelled")
      .order("start_time"),
    supabase.from("reservations").select("*", { count: "exact", head: true }).eq("status", "pending").gte("date", today),
    supabase
      .from("reservations")
      .select("*")
      .eq("status", "pending")
      .gte("date", today)
      .order("date")
      .order("start_time")
      .limit(10),
  ]);

  const seats = (todays ?? []).filter((r) => r.status !== "no_show").reduce((n, r) => n + r.party_size, 0);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">{fmtDateDE(today, { weekday: "long" })}</h1>
          <p className="text-sm text-muted">
            {todays?.length ?? 0} Reservierungen · {seats} Gäste
          </p>
        </div>
        <Link href={`/admin/reservierungen?date=${addDays(today, 1)}`} className="btn-ghost">
          Morgen →
        </Link>
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
    </div>
  );
}
