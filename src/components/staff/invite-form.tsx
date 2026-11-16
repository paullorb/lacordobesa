"use client";

import { useActionState } from "react";
import { createStaffInvite, type InviteResult } from "@/app/staff/actions";
import { CopyButton } from "@/components/staff/copy-button";
import { SubmitButton } from "@/components/staff/form-bits";

/** Makes a sign-up link and shows it once. The server keeps only a hash of it, so this response is
 *  the only place the link ever exists: leaving the page loses it, and the answer is a new link. */
export function InviteForm({ days }: { days: number }) {
  const [state, action] = useActionState<InviteResult, FormData>(createStaffInvite, null);
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <label htmlFor="invite-note">Para quién es (opcional)</label>
          <input id="invite-note" name="note" maxLength={80} autoComplete="off" placeholder="María, turno de la tarde" />
        </div>
        <div className="self-end">
          <SubmitButton pendingText="Creando …">Crear enlace</SubmitButton>
        </div>
      </div>
      <p className="text-xs text-muted">
        Vale {days} días y sirve para una sola cuenta. Se muestra una vez: copialo ahora y mandáselo a la persona.
      </p>
      {state && !state.ok && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <div className="grid gap-2 rounded-md bg-cream px-3 py-2">
          <p className="text-sm font-bold">Enlace listo. No se vuelve a mostrar.</p>
          <input readOnly value={state.url} aria-label="Enlace de invitación" className="text-xs" onFocus={(e) => e.currentTarget.select()} />
          <div className="flex flex-wrap gap-2">
            <CopyButton text={state.url} label="Copiar enlace" />
          </div>
        </div>
      )}
    </form>
  );
}
