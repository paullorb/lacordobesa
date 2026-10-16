"use client";

import { useActionState, useState } from "react";
import { createPreorderManually } from "@/app/staff/actions";
import { MenuIcon } from "@/components/icons";
import { SubmitButton } from "@/components/staff/form-bits";
import { DateField, TimeField } from "@/components/staff/pickers";
import { PREPARATIONS, PREPARATION_STAFF_LABEL } from "@/lib/preorder-preparation";
import { FIELD_LIMITS } from "@/lib/reservation-limits";

export type StaffPreorderItem = { id: string; name: string; category: string; slug: string; step: number; unit: string };

/** A pre-order taken on the phone or at the counter: dishes, pickup, who. Saved as confirmed,
 *  because whoever types it in has just confirmed it with the guest. */
export function StaffPreorderForm({ items, today }: { items: StaffPreorderItem[]; today: string }) {
  const [state, formAction] = useActionState(createPreorderManually, null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const categories = [...new Set(items.map((i) => i.category))];
  const set = (id: string, n: number) => setQuantities((q) => ({ ...q, [id]: Math.max(0, n) }));

  return (
    <form action={formAction} className="mt-4 grid gap-4">
      {categories.map((category) => (
        <fieldset key={category} className="grid gap-1.5">
          <legend className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted">
            <MenuIcon slug={items.find((i) => i.category === category)?.slug ?? ""} size={16} />
            {category}
          </legend>
          {items
            .filter((i) => i.category === category)
            .map((i) => {
              const n = quantities[i.id] ?? 0;
              return (
                <div key={i.id} className={`flex items-center justify-between gap-3 rounded-md border px-3 py-1.5 ${n ? "border-ink" : "border-line"} bg-white`}>
                  <span className="text-sm">
                    {i.name}
                    {i.step > 1 && <span className="ml-2 text-xs text-muted">{i.step}er</span>}
                  </span>
                  <span className="flex items-center gap-1">
                    <button type="button" className="btn-ghost !px-3" aria-label={`Weniger ${i.name}`} disabled={!n} onClick={() => set(i.id, n - i.step)}>
                      −
                    </button>
                    <input
                      name={`qty-${i.id}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={n || ""}
                      placeholder="0"
                      onChange={(e) => set(i.id, Number(e.target.value) || 0)}
                      aria-label={`Menge ${i.name}`}
                      className="!w-16 text-center tabular-nums"
                    />
                    <button type="button" className="btn-ghost !px-3" aria-label={`Mehr ${i.name}`} onClick={() => set(i.id, n + i.step)}>
                      +
                    </button>
                  </span>
                </div>
              );
            })}
        </fieldset>
      ))}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="p-date">Abholtag</label>
          <DateField id="p-date" name="pickup_date" min={today} required />
        </div>
        <div>
          <label htmlFor="p-time">Abholzeit</label>
          <TimeField id="p-time" name="pickup_time" required />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="p-preparation">Empanadas</label>
          <select id="p-preparation" name="preparation" defaultValue="">
            <option value="">Nicht angegeben</option>
            {PREPARATIONS.map((p) => (
              <option key={p} value={p}>
                {PREPARATION_STAFF_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="p-name">Name</label>
          <input id="p-name" name="name" maxLength={FIELD_LIMITS.name} required />
        </div>
        <div>
          <label htmlFor="p-phone">Telefon</label>
          <input id="p-phone" name="phone" type="tel" maxLength={FIELD_LIMITS.phone} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="p-notes">Notiz</label>
          <input id="p-notes" name="notes" maxLength={FIELD_LIMITS.notes} />
        </div>
      </div>

      {state && !state.ok && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && <p className="text-sm text-emerald-700">Eingetragen.</p>}

      <div>
        <SubmitButton>Als bestätigt eintragen</SubmitButton>
      </div>
    </form>
  );
}
