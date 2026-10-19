import Link from "next/link";
import { Suspense } from "react";
import { StaffLoading } from "@/components/staff/card-bits";
import { createStaffAccount, deleteStaffAccount, resetStaffPassword } from "@/app/staff/actions";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/staff/form-bits";
import { staffDisplayName } from "@/lib/staff";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Team" };

export default function TeamPage() {
  return (
    <Suspense fallback={<StaffLoading />}>
      <Team />
    </Suspense>
  );
}

/** The team's logins. Admins only: everyone made here is a normal staff account. */
async function Team() {
  const { user } = await requireAdmin();
  const admin = createPrivilegedClient();
  const [{ data: members }, { data: users }] = await Promise.all([
    admin.from("staff").select("user_id, role, added_at").order("added_at"),
    admin.auth.admin.listUsers({ perPage: 200 }),
  ]);
  const emailOf = new Map((users?.users ?? []).map((u) => [u.id, u.email]));

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">Team-Zugänge</h1>
        <p className="mt-1 text-sm">
          <Link href="/staff/einstellungen" className="underline underline-offset-2">
            Zurück zu Einstellungen
          </Link>
        </p>
      </div>
      <section className="card grid gap-4">
        <p className="text-sm text-muted">
          Neue Zugänge sind normale Team-Konten: sie sehen alles außer den Besucherzahlen und dieser Liste.
        </p>
        <ul className="grid gap-2">
          {(members ?? []).map((m) => (
            <li key={m.user_id} className="grid gap-2 rounded-md bg-cream px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong>{staffDisplayName(emailOf.get(m.user_id))}</strong>
                  <span className="ml-2 text-xs text-muted">{m.role === "admin" ? "Admin" : "Team"}</span>
                  {m.user_id === user.id && <span className="ml-2 text-xs text-muted">(du)</span>}
                </span>
                {m.role === "staff" && (
                  <form action={deleteStaffAccount}>
                    <input type="hidden" name="user_id" value={m.user_id} />
                    <ConfirmSubmit message="Diesen Zugang wirklich löschen?" className="btn-ghost text-red-700">
                      Löschen
                    </ConfirmSubmit>
                  </form>
                )}
              </div>
              {m.role === "staff" && (
                <details>
                  <summary className="cursor-pointer text-xs text-muted">Neues Passwort setzen</summary>
                  <ActionForm action={resetStaffPassword} className="mt-2 flex flex-wrap items-end gap-2" successText="Passwort geändert.">
                    <input type="hidden" name="user_id" value={m.user_id} />
                    <input name="password" type="text" minLength={10} required autoComplete="off" aria-label="Neues Passwort" className="min-w-0 flex-1" />
                    <SubmitButton>Setzen</SubmitButton>
                  </ActionForm>
                </details>
              )}
            </li>
          ))}
        </ul>
        <ActionForm action={createStaffAccount} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" successText="Zugang angelegt.">
          <div>
            <label htmlFor="new-username">Name zum Anmelden</label>
            <input id="new-username" name="username" required pattern="[a-z0-9][a-z0-9._\-]{1,31}" autoComplete="off" placeholder="maria" />
          </div>
          <div>
            <label htmlFor="new-password">Passwort</label>
            <input id="new-password" name="password" type="text" minLength={10} required autoComplete="off" />
          </div>
          <div className="self-end">
            <SubmitButton pendingText="Anlegen …">Anlegen</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
