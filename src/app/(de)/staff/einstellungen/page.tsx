import Link from "next/link";
import { Suspense } from "react";
import { StaffLoading } from "@/components/staff/card-bits";
import { saveSettings } from "@/app/staff/actions";
import { ActionForm, SubmitButton } from "@/components/staff/form-bits";
import { requireStaff } from "@/lib/auth";
import { DEFAULT_PREORDER_SETTINGS, type PreorderSettings } from "@/lib/preorders";
import { effectiveReservationSettings } from "@/lib/settings-merge";

export const metadata = { title: "Einstellungen" };

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
      <h1 className="font-serif text-3xl">Einstellungen</h1>
      <ActionForm action={saveSettings} className="grid gap-6">
        <section className="card grid gap-3">
          <h2 className="font-semibold">Website</h2>
          <div>
            <label htmlFor="announcement">Hinweiszeile ganz oben (leer = ausblenden)</label>
            <input id="announcement" name="announcement" defaultValue={announcement} />
          </div>
        </section>

        <section className="card grid gap-4">
          <h2 className="font-semibold">Reservierungen</h2>
          <label className="!mb-0 flex items-center gap-2 text-sm normal-case tracking-normal">
            <input type="checkbox" name="enabled" defaultChecked={r.enabled} /> Online-Reservierungen annehmen
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="capacity_seats" label="Sitzplätze gesamt" value={r.capacity_seats} />
            <Field
              name="max_party_size"
              label="Max. Personen online"
              value={r.max_party_size}
              hint="Größere Gruppen werden ans Telefon verwiesen."
            />
          </div>
        </section>

        <section className="card grid gap-3">
          <h2 className="font-semibold">Vorbestellungen</h2>
          <label className="!mb-0 flex items-center gap-2 text-sm normal-case tracking-normal">
            <input type="checkbox" name="preorders_enabled" defaultChecked={pre.enabled} /> Vorbestellungen über die
            Website annehmen
          </label>
          <p className="text-xs text-muted">Welche Gerichte vorbestellbar sind, stellst du unter „Karte“ pro Gericht ein.</p>
        </section>

        <div>
          <SubmitButton>Speichern</SubmitButton>
        </div>
      </ActionForm>
      {isAdmin && (
        <p className="text-sm">
          <Link href="/staff/team" className="underline underline-offset-2">
            Team-Zugänge verwalten
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
