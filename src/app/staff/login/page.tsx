import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden" };

export default function LoginPage(props: PageProps<"/staff/login">) {
  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className="card">
        <h1 className="mb-1 font-serif text-2xl">Anmelden</h1>
        <p className="mb-5 text-sm text-muted">Nur für das Team. Zugänge werden von La Cordobesa vergeben.</p>
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
  "kein-zugang": "Dieser Zugang ist nicht für das Team freigeschaltet. Bitte an La Cordobesa wenden.",
  "pruefung-fehlgeschlagen":
    "Die Zugangsprüfung hat gerade nicht funktioniert. Das liegt nicht an deinem Passwort. Bitte versuch es gleich noch einmal.",
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
