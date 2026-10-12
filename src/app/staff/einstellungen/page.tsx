import { Suspense } from "react";
import { saveSettings } from "@/app/staff/actions";
import { ActionForm, SubmitButton } from "@/components/staff/form-bits";
import { requireStaff } from "@/lib/auth";
import { DEFAULT_RESERVATION_SETTINGS, type ReservationSettings } from "@/lib/data";
import { DEFAULT_PREORDER_SETTINGS, type PreorderSettings } from "@/lib/preorders";

export const metadata = { title: "Einstellungen" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Lade …</p>}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const { supabase } = await requireStaff();
  const { data } = await supabase.from("site_settings").select("key, value");
  const get = (k: string) => data?.find((r) => r.key === k)?.value;
  const r: ReservationSettings = { ...DEFAULT_RESERVATION_SETTINGS, ...((get("reservations") as Partial<ReservationSettings>) ?? {}) };
  const announcement = (get("announcement") as { text?: string } | undefined)?.text ?? "";
  const pre: PreorderSettings = { ...DEFAULT_PREORDER_SETTINGS, ...((get("preorders") as Partial<PreorderSettings>) ?? {}) };
  // The pre-order block only makes sense once migration 20261012094815 added the table behind it.
  const preorderTable = !(await supabase.from("preorders").select("id").limit(1)).error;

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
            <Field name="capacity_seats" label="Sitzplätze gesamt" value={r.capacity_seats} hint="Reservierte Plätze, die gleichzeitig belegt sein dürfen." />
            <Field name="duration_minutes" label="Dauer pro Reservierung (Min.)" value={r.duration_minutes} />
            <Field name="slot_minutes" label="Zeitraster (Min.)" value={r.slot_minutes} hint="Abstand der wählbaren Uhrzeiten." />
            <Field name="last_seating_minutes_before_close" label="Letzte Reservierung vor Schluss (Min.)" value={r.last_seating_minutes_before_close} />
            <Field name="max_party_size" label="Max. Personen online" value={r.max_party_size} hint="Größere Gruppen werden ans Telefon verwiesen." />
            <Field name="min_lead_hours" label="Vorlauf (Std.)" value={r.min_lead_hours} />
            <Field name="max_days_ahead" label="Max. Tage im Voraus" value={r.max_days_ahead} />
          </div>
        </section>
        {preorderTable ? (
          <section className="card grid gap-4">
            <input type="hidden" name="preorder_settings_field" value="1" />
            <h2 className="font-semibold">Vorbestellungen</h2>
            <label className="!mb-0 flex items-center gap-2 text-sm normal-case tracking-normal">
              <input type="checkbox" name="preorders_enabled" defaultChecked={pre.enabled} /> Vorbestellungen über die
              Website annehmen
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                name="preorders_min_lead_hours"
                label="Vorlauf (Std.)"
                value={pre.min_lead_hours}
                hint="Wie lange vorher eine Bestellung da sein muss, damit ihr sie backen könnt."
              />
              <NumberField name="preorders_max_days_ahead" label="Max. Tage im Voraus" value={pre.max_days_ahead} />
              <NumberField
                name="preorders_max_lines"
                label="Max. verschiedene Gerichte"
                value={pre.max_lines}
                hint="Größere Bestellungen werden ans Telefon verwiesen."
              />
              <NumberField name="preorders_max_quantity" label="Max. Menge pro Gericht" value={pre.max_quantity} />
            </div>
            <p className="text-xs text-muted">
              Welche Gerichte vorbestellbar sind, stellst du unter „Karte“ pro Gericht ein.
            </p>
          </section>
        ) : (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Vorbestellungen sind erst verfügbar, sobald die Datenbank-Migration 20261012094815 eingespielt ist.
          </p>
        )}
        <div>
          <SubmitButton>Speichern</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}

function Field({ name, label, hint, value }: { name: keyof ReservationSettings; label: string; hint?: string; value: number }) {
  return (
    <div>
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type="number" min={0} defaultValue={value} />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Same as Field, for the pre-order keys, which are prefixed so they cannot collide with the
 *  reservation fields in the one shared form. */
function NumberField({ name, label, hint, value }: { name: string; label: string; hint?: string; value: number }) {
  return (
    <div>
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type="number" min={0} defaultValue={value} />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
