import { Suspense } from "react";
import { PreorderCard } from "@/components/staff/preorder-card";
import { requireStaff } from "@/lib/auth";
import { fmtDateDE, todayISO } from "@/lib/dates";
import type { Tables } from "@/lib/database.types";

export const metadata = { title: "Vorbestellungen" };

export default function PreordersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Lade …</p>}>
      <Preorders />
    </Suspense>
  );
}

type Line = Pick<Tables<"preorder_lines">, "id" | "label" | "unit_label" | "price_label" | "quantity">;
export type PreorderWithLines = Tables<"preorders"> & { preorder_lines: Line[] };

async function Preorders() {
  const { supabase } = await requireStaff();
  const today = todayISO();

  const { data, error } = await supabase
    .from("preorders")
    .select("*, preorder_lines(id, label, unit_label, price_label, quantity)")
    .gte("pickup_date", today)
    .order("pickup_date")
    .order("pickup_time");

  // Migration 20261012094815 may not be deployed yet; PostgREST answers with 42P01 for a missing table.
  if (error) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Vorbestellungen sind erst verfügbar, sobald die Datenbank-Migration 20261012094815 eingespielt ist.
      </p>
    );
  }

  const orders = (data ?? []) as PreorderWithLines[];
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
