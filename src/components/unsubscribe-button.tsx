"use client";

import { useActionState } from "react";
import { unsubscribeFromSpecials } from "@/app/specials/actions";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";

export function UnsubscribeButton({ locale, token }: { locale: Locale; token: string }) {
  const [state, formAction, pending] = useActionState(unsubscribeFromSpecials, null);
  const t = getDictionary(locale).unsubscribe;

  if (state?.ok) {
    return (
      <div className="form-success" role="status">
        <strong>{t.doneTitle}</strong>
        <p>{t.doneText}</p>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="locale" value={locale} />
      {state?.ok === false && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="button" disabled={pending}>
        {pending ? t.submitting : t.submit}
      </button>
    </form>
  );
}
