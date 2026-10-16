import { PhoneIcon } from "@/components/icons";
import { CONTACT } from "@/lib/contact";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";

/** "Lieber anrufen? +49 …": the number, as a real link, wherever somebody is asked to fill in a form or
 *  press a reserve button. Plain, not a button: it must not compete with the primary action. */
export function PhoneNote({ locale, className }: { locale: Locale; className?: string }) {
  return (
    <p className={className ? `phone-note ${className}` : "phone-note"}>
      <PhoneIcon size={15} />
      <span>
        {getDictionary(locale).wizard.callPrompt}
        <a href={`tel:${CONTACT.phoneE164}`}>{CONTACT.phoneDisplay}</a>
      </span>
    </p>
  );
}
