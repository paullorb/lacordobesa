import { Suspense } from "react";
import type { Metadata } from "next";
import { ConfirmSpecialsEmailForm } from "./confirm-form";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";

export const metadata: Metadata = { title: "E-Mail bestätigen · La Cordobesa", robots: { index: false, follow: false } };

export default function ConfirmSpecialsEmailPage(props: PageProps<"/specials/confirm">) {
  return (
    <main className="mx-auto grid min-h-[50vh] max-w-xl content-center px-5">
      <Suspense fallback={null}>
        <ConfirmContent searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function ConfirmContent({ searchParams }: Pick<PageProps<"/specials/confirm">, "searchParams">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const submittedLocale = typeof params.lang === "string" ? params.lang : "";
  const locale = isLocale(submittedLocale) ? submittedLocale : DEFAULT_LOCALE;
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return <p role="alert">Der Bestätigungslink ist ungültig.</p>;
  }
  return <ConfirmSpecialsEmailForm token={token} locale={locale} />;
}
