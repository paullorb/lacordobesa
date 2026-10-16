import { Suspense } from "react";
import { StaffLoading } from "@/components/staff/card-bits";
import { PreorderCard } from "@/components/staff/preorder-card";
import { StaffPreorderForm } from "@/components/staff/staff-preorder-form";
import type { PreorderWithLines } from "@/lib/preorders";
import { requireStaff } from "@/lib/auth";
import { fmtDateDE, todayISO } from "@/lib/dates";

export const metadata = { title: "Vorbestellungen" };

export default function PreordersPage() {
  return (
    <Suspense fallback={<StaffLoading />}>
      <Preorders />
    </Suspense>
  );
}


async function Preorders() {
  const { supabase } = await requireStaff();
  const today = todayISO();

  const [{ data, error }, { data: dishes }] = await Promise.all([
    supabase
      .from("preorders")
      .select("*, preorder_lines(id, label, unit_label, price_label, quantity)")
      .gte("pickup_date", today)
      .order("pickup_date")
      .order("pickup_time"),
    supabase
      .from("menu_items")
      .select("id, name, preorder_step, preorder_unit, menu_categories(label, sort_order)")
      .eq("is_preorderable", true)
      .eq("is_available", true)
      .order("sort_order"),
  ]);

  // Migration 20261012094815 may not be deployed yet; PostgREST answers with 42P01 for a missing table.
  if (error) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Vorbestellungen sind erst verfügbar, sobald die Datenbank-Migration 20261012094815 eingespielt ist.
      </p>
    );
  }

  const orders = (data ?? []) as PreorderWithLines[];
  // In menu order: category first, then the dish's place inside it.
  const items = (dishes ?? [])
    .toSorted((a, b) => (a.menu_categories?.sort_order ?? 0) - (b.menu_categories?.sort_order ?? 0))
    .map((d) => ({ id: d.id, name: d.name, step: d.preorder_step, unit: d.preorder_unit, category: d.menu_categories?.label ?? "Weitere" }));
  const openOrders = orders.filter((o) => o.status === "pending");
  const upcoming = orders.filter((o) => o.status === "confirmed" || o.status === "ready");
  const done = orders.filter((o) => o.status === "collected" || o.status === "cancelled");

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">Vorbestellungen</h1>
        <p className="text-sm text-muted">
          Alles ab {fmtDateDE(today)}. „Bestätigen“ sagt dem Gast zu, „Bereit“ heißt abholbereit, „Abgeholt“ schließt
          die Bestellung ab. Bezahlt wird bei der Abholung.
        </p>
      </div>

      <details className="card">
        <summary className="cursor-pointer font-semibold">Vorbestellung eintragen (Telefon / vor Ort)</summary>
        {items.length > 0 ? (
          <StaffPreorderForm items={items} today={today} />
        ) : (
          <p className="mt-3 text-sm text-muted">
            Noch kein Gericht ist vorbestellbar. Unter „Karte“ beim Gericht „vorbestellbar“ ankreuzen.
          </p>
        )}
      </details>

      <Section title={`Offen (${openOrders.length})`} orders={openOrders} highlight empty="Keine offenen Vorbestellungen." />
      <Section title={`In Arbeit (${upcoming.length})`} orders={upcoming} empty="Nichts in Arbeit." />
      {done.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Abgeschlossen und storniert ({done.length})</summary>
          <div className="mt-3 grid gap-3">
            {done.map((o) => (
              <PreorderCard key={o.id} order={o} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function Section({
  title,
  orders,
  empty,
  highlight,
}: {
  title: string;
  orders: PreorderWithLines[];
  empty: string;
  highlight?: boolean;
}) {
  return (
    <section className={highlight && orders.length > 0 ? "card border-amber-200 bg-amber-50" : undefined}>
      <h2 className="mb-3 font-semibold">{title}</h2>
      {orders.length > 0 ? (
        <div className="grid gap-3">
          {orders.map((o) => (
            <PreorderCard key={o.id} order={o} />
          ))}
        </div>
      ) : (
        <p className="card text-sm text-muted">{empty}</p>
      )}
    </section>
  );
}
