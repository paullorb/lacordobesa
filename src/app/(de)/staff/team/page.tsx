import Link from "next/link";
import { Suspense } from "react";
import { StaffLoading } from "@/components/staff/card-bits";
import { createStaffAccount, deleteStaffAccount, resetStaffPassword, revokeStaffInvite } from "@/app/staff/actions";
import { ActionForm, ConfirmSubmit, QuickForm, SubmitButton } from "@/components/staff/form-bits";
import { InviteForm } from "@/components/staff/invite-form";
import { berlinClock, fmtStaffDate } from "@/lib/dates";
import { staffDisplayName } from "@/lib/staff";
import { INVITE_TTL_DAYS, nowISO } from "@/lib/staff-signup";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Equipo" };

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
  const now = nowISO();
  const [{ data: members }, { data: users }, pendingResult, usedResult] = await Promise.all([
    admin.from("staff").select("user_id, role, added_at").order("added_at"),
    admin.auth.admin.listUsers({ perPage: 200 }),
    admin
      .from("staff_invites")
      .select("id, note, created_at, expires_at")
      .is("used_at", null)
      .is("revoked_at", null)
      .gt("expires_at", now)
      .order("created_at", { ascending: false }),
    admin
      .from("staff_invites")
      .select("id, note, used_at, used_by")
      .not("used_at", "is", null)
      .order("used_at", { ascending: false })
      .limit(5),
  ]);
  const pending = pendingResult.data ?? [];
  const used = usedResult.data ?? [];
  const invitesFailed = !!pendingResult.error || !!usedResult.error;
  if (invitesFailed) console.error("team invites", pendingResult.error ?? usedResult.error);
  const day = (iso: string) => fmtStaffDate(berlinClock(new Date(iso)).date);
  const emailOf = new Map((users?.users ?? []).map((u) => [u.id, u.email]));

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">Accesos del equipo</h1>
        <p className="mt-1 text-sm">
          <Link href="/staff/einstellungen" className="underline underline-offset-2">
            Volver a ajustes
          </Link>
        </p>
      </div>
      <section className="card grid gap-4">
        <p className="text-sm text-muted">
          Las cuentas nuevas son del equipo: pueden ver todo excepto las estadísticas de visitantes y esta lista.
        </p>
        <ul className="grid gap-2">
          {(members ?? []).map((m) => (
            <li key={m.user_id} className="grid gap-2 rounded-md bg-cream px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong>{staffDisplayName(emailOf.get(m.user_id))}</strong>
                  <span className="ml-2 text-xs text-muted">{m.role === "admin" ? "Admin" : "Equipo"}</span>
                  {m.user_id === user.id && <span className="ml-2 text-xs text-muted">(vos)</span>}
                </span>
                {m.role === "staff" && (
                  <QuickForm action={deleteStaffAccount}>
                    <input type="hidden" name="user_id" value={m.user_id} />
                    <ConfirmSubmit message="¿Seguro que querés eliminar este acceso?" className="btn-ghost text-red-700">
                      Eliminar
                    </ConfirmSubmit>
                  </QuickForm>
                )}
              </div>
              {m.role === "staff" && (
                <details>
                  <summary className="cursor-pointer text-xs text-muted">Cambiar contraseña</summary>
                  <ActionForm action={resetStaffPassword} className="mt-2 flex flex-wrap items-end gap-2" successText="Contraseña cambiada.">
                    <input type="hidden" name="user_id" value={m.user_id} />
                    <input name="password" type="text" minLength={10} required autoComplete="off" aria-label="Nueva contraseña" className="min-w-0 flex-1" />
                    <SubmitButton>Guardar</SubmitButton>
                  </ActionForm>
                </details>
              )}
            </li>
          ))}
        </ul>
        <ActionForm action={createStaffAccount} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" successText="Acceso creado.">
          <div>
            <label htmlFor="new-username">Nombre de usuario</label>
            <input id="new-username" name="username" required pattern="[a-z0-9][a-z0-9._\-]{1,31}" autoComplete="off" placeholder="maria" />
          </div>
          <div>
            <label htmlFor="new-password">Contraseña</label>
            <input id="new-password" name="password" type="text" minLength={10} required autoComplete="off" />
          </div>
          <div className="self-end">
            <SubmitButton pendingText="Creando …">Crear</SubmitButton>
          </div>
        </ActionForm>
      </section>
      <section className="card grid gap-4">
        <div>
          <h2 className="font-serif text-xl">Invitar con un enlace</h2>
          <p className="mt-1 text-sm text-muted">
            Para que la persona elija su propio nombre y contraseña. El enlace vale {INVITE_TTL_DAYS} días, sirve una sola vez y se puede revocar.
          </p>
        </div>
        <InviteForm days={INVITE_TTL_DAYS} />
        {invitesFailed && (
          <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No pudimos cargar las invitaciones. Si es la primera vez, falta aplicar la migración 20261116100200.
          </p>
        )}
        {pending.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-bold">Abiertas</h3>
            <ul className="grid gap-2">
              {pending.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-cream px-3 py-2 text-sm">
                  <span>
                    <strong>{i.note || "Sin nota"}</strong>
                    <span className="ml-2 text-xs text-muted">
                      creada el {day(i.created_at)} · vence el {day(i.expires_at)}
                    </span>
                  </span>
                  <QuickForm action={revokeStaffInvite}>
                    <input type="hidden" name="id" value={i.id} />
                    <ConfirmSubmit message="¿Revocar este enlace? Dejará de funcionar." className="btn-ghost text-red-700">
                      Revocar
                    </ConfirmSubmit>
                  </QuickForm>
                </li>
              ))}
            </ul>
          </div>
        )}
        {used.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-bold">Usadas hace poco</h3>
            <ul className="grid gap-1 text-sm text-muted">
              {used.map((i) => (
                <li key={i.id}>
                  {i.note || "Sin nota"} · {day(i.used_at!)}
                  {i.used_by ? ` · ${staffDisplayName(emailOf.get(i.used_by))}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
