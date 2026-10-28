import type { ReactNode } from "react";
import { ArrowIcon, ClockIcon, MailIcon, PhoneIcon, PinIcon } from "@/components/icons";
import { CONTACT } from "@/lib/contact";

const ICONS = { address: PinIcon, hours: ClockIcon, phone: PhoneIcon, email: MailIcon } as const;

export type ContactKind = keyof typeof ICONS;

/** One line of "where to find us": a round icon, a small caps label and the content. The visit card
 *  and the footer both render their address, hours, phone and e-mail through this, so the two cannot
 *  drift apart in icon or structure. Only the colours differ, by the container it sits in. */
export function ContactRow({ kind, label, children }: { kind: ContactKind; label: string; children: ReactNode }) {
  const Icon = ICONS[kind];
  return (
    <div className="contact-row">
      <span className="contact-icon">
        <Icon />
      </span>
      <div>
        <small>{label}</small>
        {children}
      </div>
    </div>
  );
}

export function ContactAddress() {
  return (
    <address>
      <a
        className="contact-address-map-link"
        href={CONTACT.mapsUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`Google Maps: ${CONTACT.street}, ${CONTACT.city}`}
      >
        <span>
          {/* The house number stays with the street name instead of wrapping onto a line of its own. */}
          {CONTACT.street.replace(/ (\S+)$/, "\u00a0$1")}
          <br />
          {CONTACT.city}
        </span>
        <ArrowIcon direction="up-right" />
      </a>
    </address>
  );
}

export function ContactPhone() {
  return <a href={`tel:${CONTACT.phoneE164}`}>{CONTACT.phoneDisplay}</a>;
}

/** The address may wrap after a dot in the name or after the @, never in the middle of a word and
 *  never inside the domain. */
export function ContactEmail() {
  const parts = CONTACT.email.split(/(?<=@)|(?<=\.)(?=[^@]*@)/);
  return (
    <a className="contact-email" href={`mailto:${CONTACT.email}`}>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <wbr />}
          {part}
        </span>
      ))}
    </a>
  );
}
