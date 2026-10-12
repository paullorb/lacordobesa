"use client";

import { useActionState } from "react";
import { signIn } from "../actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="username">Name</label>
        <input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      </div>
      <div>
        <label htmlFor="password">Passwort</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state && !state.ok && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}
      <button className="btn-primary mt-2" disabled={pending}>
        {pending ? "Anmelden …" : "Anmelden"}
      </button>
    </form>
  );
}
