"use client";

import { useActionState } from "react";
import { signUpStaff } from "./actions";

export function SignupForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(signUpStaff.bind(null, token), null);
  return (
    <form action={action} className="grid gap-3">
      <div>
        <label htmlFor="username">Nombre de usuario</label>
        <input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]{1,31}" required />
      </div>
      <div>
        <label htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
      </div>
      {state?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{state.error}</p>}
      <button className="btn-primary mt-2" disabled={pending}>{pending ? "Creando acceso …" : "Crear acceso"}</button>
    </form>
  );
}
