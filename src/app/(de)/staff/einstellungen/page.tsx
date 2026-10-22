import Link from "next/link";
import { Suspense } from "react";
import { StaffLoading } from "@/components/staff/card-bits";
import { saveSettings } from "@/app/staff/actions";
import { ActionForm, SubmitButton } from "@/components/staff/form-bits";
import { requireStaff } from "@/lib/auth";
import { DEFAULT_PREORDER_SETTINGS, type PreorderSettings } from "@/lib/preorders";
import { effectiveReservationSettings } from "@/lib/settings-merge";

export const metadata = { title: "Ajustes" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<StaffLoading />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const { supabase, isAdmin } = await requireStaff();
  const { data } = await supabase.from("site_settings").select("key, value");
  const get = (k: string) => data?.find((r) => r.key === k)?.value;
  const r = effectiveReservationSettings(get("reservations"));
  const announcement = (get("announcement") as { text?: string } | undefined)?.text ?? "";
  const pre: PreorderSettings = { ...DEFAULT_PREORDER_SETTINGS, ...((get("preorders") as Partial<PreorderSettings>) ?? {}) };

  return (
    <div className="grid gap-6">
      <h1 className="font-serif text-3xl">Ajustes</h1>
      <ActionForm action={saveSettings} className="grid gap-6">
        <section className="card grid gap-3">
          <h2 className="font-semibold">Sitio web</h2>
          <div>
            <label htmlFor="announcement">Aviso en la parte superior (vacío para ocultar)</label>
            <input id="announcement" name="announcement" defaultValue={announcement} />
          </div>
        </section>

        <section className="card grid gap-4">
          <h2 className="font-semibold">Reservas</h2>
          <label className="!mb-0 flex items-center gap-2 text-sm normal-case tracking-normal">
            <input type="checkbox" name="enabled" defaultChecked={r.enabled} /> Aceptar reservas en línea
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="capacity_seats" label="Capacidad total" value={r.capacity_seats} />
            <Field
              name="max_party_size"
              label="Máximo de personas por reserva en línea"
              value={r.max_party_size}
              hint="Los grupos más grandes deben reservar por teléfono."
            />
          </div>
        </section>

        <section className="card grid gap-3">
          <h2 className="font-semibold">Pedidos anticipados</h2>
          <label className="!mb-0 flex items-center gap-2 text-sm normal-case tracking-normal">
            <input type="checkbox" name="preorders_enabled" defaultChecked={pre.enabled} /> Aceptar pedidos anticipados
            desde el sitio web
          </label>
          <p className="text-xs text-muted">Elegí qué platos se pueden pedir por adelantado en «Menú».</p>
        </section>

        <div>
          <SubmitButton>Guardar</SubmitButton>
        </div>
      </ActionForm>
      {isAdmin && (
        <p className="text-sm">
          <Link href="/staff/team" className="underline underline-offset-2">
            Administrar accesos del equipo
          </Link>
        </p>
      )}
    </div>
  );
}

function Field({ name, label, hint, value }: { name: string; label: string; hint?: string; value: number }) {
  return (
    <div>
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type="number" min={1} defaultValue={value} />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
