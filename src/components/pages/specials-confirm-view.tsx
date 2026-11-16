import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SpecialsConfirmForm } from "@/components/specials-confirm-form";
import { getDictionary } from "@/lib/dictionaries";
import { DEFAULT_LOCALE, isLocale, localeHref, type Locale } from "@/lib/i18n";

export const SPECIALS_CONFIRM_PATH = "/specials/confirm";

const TOKEN = /^[0-9a-f]{64}$/;

/** The page the confirmation mail of the specials e-mail sign-up links to, in the guest's language.
 *  The mail links straight to the language's own path, so `<html lang>` and the words agree. */
export function SpecialsConfirmView({
  locale,
  searchParams,
}: {
  locale: Locale;
  searchParams: PageProps<"/specials/confirm">["searchParams"];
}) {
  return (
    <main id="main" className="mx-auto grid min-h-[50vh] max-w-xl content-center px-5">
      <Suspense fallback={null}>
        <ConfirmContent locale={locale} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ConfirmContent({
  locale,
  searchParams,
}: {
  locale: Locale;
  searchParams: PageProps<"/specials/confirm">["searchParams"];
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const lang = typeof params.lang === "string" ? params.lang : "";
  // Mails sent before the language had its own path link to the German page with `?lang=`. Follow it
  // to the right page instead of showing German words under a German <html lang>.
  if (locale === DEFAULT_LOCALE && isLocale(lang) && lang !== DEFAULT_LOCALE && TOKEN.test(token)) {
    redirect(`${localeHref(lang, SPECIALS_CONFIRM_PATH)}?token=${token}`);
  }
  if (!TOKEN.test(token)) {
    return <p role="alert">{getDictionary(locale).specialsConfirm.badLink}</p>;
  }
  return <SpecialsConfirmForm token={token} locale={locale} />;
}
