"use client";

import { useActionState } from "react";
import { unsubscribeFromSpecials } from "@/app/specials/actions";

export function UnsubscribeButton({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(unsubscribeFromSpecials, null);

  if (state?.ok) {
    return (
      <div className="form-success" role="status">
        <strong>Abgemeldet.</strong>
        <p>Wir schreiben dir nichts mehr über Specials. Danke, dass du da warst, ¡gracias!</p>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />
      <button type="submit" className="button" disabled={pending}>
        {pending ? "Wird abgemeldet …" : "Jetzt abmelden"}
      </button>
    </form>
  );
}
