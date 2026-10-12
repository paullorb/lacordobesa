import { getDictionary, type Dictionary } from "@/lib/dictionaries";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";

/** The locale a public form was displayed in. Every public form submits it as a hidden field, so a
 *  Server Action answers in the visitor's language rather than always in German. */
export function formLocale(formData: FormData): Locale {
  const submitted = String(formData.get("locale") ?? "");
  return isLocale(submitted) ? submitted : DEFAULT_LOCALE;
}

/**
 * Turns an error code into the sentence a guest sees, in the form's locale.
 *
 * `section` picks the form's own `errors` from the dictionary. Its entries win, then the shared
 * `formErrors`, then the generic "that did not work" line, so a code the RPC grows later still
 * reaches the guest as something readable rather than as `slot_full`.
 */
export function formErrors(formData: FormData, section: (d: Dictionary) => Record<string, string>) {
  const dictionary = getDictionary(formLocale(formData));
  const own = section(dictionary);
  const shared: Record<string, string> = dictionary.formErrors;
  return (code: string) => own[code] ?? shared[code] ?? dictionary.formErrors.generic;
}
