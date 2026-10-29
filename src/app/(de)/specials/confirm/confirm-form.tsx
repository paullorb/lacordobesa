"use client";

import { useActionState } from "react";
import { confirmSpecialsEmail } from "./actions";
import type { Locale } from "@/lib/i18n";

const COPY: Record<Locale, { title: string; text: string; submit: string; done: string; invalid: string }> = {
  de: {
    title: "E-Mail-Adresse bestätigen",
    text: "Bestätige, dass du die Specials von La Cordobesa per E-Mail erhalten möchtest.",
    submit: "Anmeldung bestätigen",
    done: "Danke, deine E-Mail-Adresse ist bestätigt. Du kannst dich jederzeit über den Link in einer Nachricht abmelden.",
    invalid: "Dieser Bestätigungslink ist ungültig oder wurde bereits verwendet.",
  },
  es: {
    title: "Confirmar e-mail",
    text: "Confirmá que querés recibir las novedades de La Cordobesa por e-mail.",
    submit: "Confirmar suscripción",
    done: "Gracias, confirmamos tu e-mail. Podés darte de baja cuando quieras desde el enlace de cada mensaje.",
    invalid: "Este enlace no es válido o ya se usó.",
  },
  en: {
    title: "Confirm your email address",
    text: "Confirm that you want to receive La Cordobesa specials by email.",
    submit: "Confirm subscription",
    done: "Thanks, your email address is confirmed. You can unsubscribe at any time using the link in a message.",
    invalid: "This confirmation link is invalid or has already been used.",
  },
};

export function ConfirmSpecialsEmailForm({ token, locale }: { token: string; locale: Locale }) {
  const [state, action, pending] = useActionState(confirmSpecialsEmail, null);
  const copy = COPY[locale];
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
