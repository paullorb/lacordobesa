"use client";

import { useActionState } from "react";
import { confirmSpecialsEmail } from "@/app/specials/actions";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";

export function SpecialsConfirmForm({ token, locale }: { token: string; locale: Locale }) {
  const [state, action, pending] = useActionState(confirmSpecialsEmail, null);
  const copy = getDictionary(locale).specialsConfirm;
  if (state?.ok) return <p role="status">{copy.done}</p>;
  if (state && !state.ok) return <p role="alert">{copy.invalid}</p>;
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <h1>{copy.title}</h1>
        <p>{copy.text}</p>
      </div>
      <button className="button" type="submit" disabled={pending}>{pending ? "…" : copy.submit}</button>
    </form>
  );
}
