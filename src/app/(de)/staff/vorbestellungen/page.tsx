import { Suspense } from "react";
import { Disclosure, StaffLoadError, StaffLoading } from "@/components/staff/card-bits";
import { PreorderCard } from "@/components/staff/preorder-card";
import { StaffPreorderForm } from "@/components/staff/staff-preorder-form";
import type { PreorderWithLines } from "@/lib/preorders";
import { requireStaff } from "@/lib/auth";
import { fmtStaffDate, todayISO } from "@/lib/dates";

export const metadata = { title: "Pedidos anticipados" };

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
      .select("*, preorder_lines(id, label, unit_label, price_label, quantity, menu_items(menu_categories(slug)))")
      .gte("pickup_date", today)
      .order("pickup_date")
      .order("pickup_time"),
    supabase
      .from("menu_items")
      .select("id, name, preorder_step, preorder_unit, menu_categories(label, slug, sort_order)")
      .eq("is_preorderable", true)
      .eq("is_available", true)
      .order("sort_order"),
  ]);

  if (error) {
    console.error("staff/vorbestellungen", error);
    return <StaffLoadError />;
  }

  const orders = (data ?? []) as PreorderWithLines[];
  // In menu order: category first, then the dish's place inside it.
  const items = (dishes ?? [])
    .toSorted((a, b) => (a.menu_categories?.sort_order ?? 0) - (b.menu_categories?.sort_order ?? 0))
    .map((d) => ({ id: d.id, name: d.name, step: d.preorder_step, unit: d.preorder_unit, category: d.menu_categories?.label ?? "Otros", slug: d.menu_categories?.slug ?? "" }));
  const openOrders = orders.filter((o) => o.status === "pending");
  const upcoming = orders.filter((o) => o.status === "confirmed" || o.status === "ready");
  const done = orders.filter((o) => o.status === "collected" || o.status === "cancelled");

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">Pedidos anticipados</h1>
        <p className="text-sm text-muted">Pedidos para retirar desde el {fmtStaffDate(today)}. Se paga al retirar.</p>
        <Disclosure summary="Cómo funciona">
          <p className="text-sm text-muted">
            «Confirmar» acepta el pedido; «Listo» indica que puede retirarse; «Retirado» lo cierra.
          </p>
        </Disclosure>
      </div>

      <details className="card">
        <summary className="cursor-pointer font-semibold">Añadir un pedido (por teléfono o en el local)</summary>
        {items.length > 0 ? (
          <StaffPreorderForm items={items} today={today} />
        ) : (
          <p className="mt-3 text-sm text-muted">
            Todavía no hay platos disponibles para pedidos anticipados. Activá «Pedido anticipado» para un plato en «Menú».
          </p>
        )}
      </details>

      <Section title={`Pendientes (${openOrders.length})`} orders={openOrders} highlight empty="No hay pedidos pendientes." />
      <Section title={`En curso (${upcoming.length})`} orders={upcoming} empty="No hay pedidos en curso." />
      {done.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Retirados y cancelados ({done.length})</summary>
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
