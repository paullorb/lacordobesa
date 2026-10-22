import { Suspense } from "react";
import { LoginForm } from "@/app/staff/login/login-form";

export const metadata = { title: "Iniciar sesión" };

export default function LoginPage(props: PageProps<"/staff/login">) {
  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className="card">
        <h1 className="mb-1 font-serif text-2xl">Iniciar sesión</h1>
        <p className="mb-5 text-sm text-muted">Acceso para el equipo de La Cordobesa.</p>
        <Suspense fallback={<LoginForm next="/staff" />}>
          <LoginWithNext searchParams={props.searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

/** Why the last attempt bounced back here. requireStaff() and the proxy both redirect with a
 *  `fehler`, and the two cases need different words: being refused is not the same as the check
 *  itself failing, and reporting the second as the first sends somebody hunting for a password
 *  problem they do not have. */
const REASONS: Record<string, string> = {
  "kein-zugang": "Esta cuenta no tiene acceso al área del equipo. Comunicate con La Cordobesa.",
  "pruefung-fehlgeschlagen":
    "No pudimos comprobar el acceso en este momento. No es un problema con tu contraseña. Volvé a intentarlo en unos minutos.",
};

async function LoginWithNext({ searchParams }: Pick<PageProps<"/staff/login">, "searchParams">) {
  const { next, fehler } = await searchParams;
  const reason = typeof fehler === "string" ? REASONS[fehler] : undefined;
  return (
    <>
      {reason && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {reason}
        </p>
      )}
      <LoginForm next={typeof next === "string" ? next : "/staff"} />
    </>
  );
}
