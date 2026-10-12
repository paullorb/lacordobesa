import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden" };

export default function LoginPage(props: PageProps<"/admin/login">) {
  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className="card">
        <h1 className="mb-1 font-serif text-2xl">Anmelden</h1>
        <p className="mb-5 text-sm text-muted">Nur für das Team. Zugänge werden von La Cordobesa vergeben.</p>
        <Suspense fallback={<LoginForm next="/admin" />}>
          <LoginWithNext searchParams={props.searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function LoginWithNext({ searchParams }: Pick<PageProps<"/admin/login">, "searchParams">) {
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : "/admin"} />;
}
