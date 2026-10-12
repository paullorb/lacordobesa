import { Suspense } from "react";
import { StaffLoading } from "@/components/staff/card-bits";
import { MonthCalendar } from "@/components/staff/month-calendar";
import { ReservationCard } from "@/components/staff/reservation-card";
import { loadCalendarMonth, monthParam } from "@/lib/staff-calendar";
import { requireStaff } from "@/lib/auth";
import { fmtDateDE, todayISO } from "@/lib/dates";

export const metadata = { title: "Heute" };

export default function DashboardPage(props: PageProps<"/staff">) {
  return (
    <Suspense fallback={<StaffLoading />}>
      <Dashboard searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: Pick<PageProps<"/staff">, "searchParams">) {
  const { supabase } = await requireStaff();
  const sp = await searchParams;
  const today = todayISO();
  const month = monthParam(sp, today);

  const [{ data: todays }, { count: pendingCount }, { data: upcomingPending }, cal] = await Promise.all([
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
    loadCalendarMonth(supabase, month),
  ]);

  const seats = (todays ?? []).filter((r) => r.status !== "no_show").reduce((n, r) => n + r.party_size, 0);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">{fmtDateDE(today, { weekday: "long" })}</h1>
        <p className="text-sm text-muted">
          {todays?.length ?? 0} Reservierungen · {seats} Gäste heute
        </p>
      </div>

      <MonthCalendar
        month={month}
        today={today}
        selected={today}
        days={cal.days}
        weeklyClosed={cal.weeklyClosed}
        hrefForDay={(d) => `/staff/reservierungen?date=${d}`}
        hrefForMonth={(m) => `/staff?monat=${m}`}
      />

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
