/** Static business contact details. Shown on the public site and used for staff shortcuts. */
export const CONTACT = {
  name: "La Cordobesa",
  phoneE164: "+4915228087941",
  phoneDisplay: "+49 152 28087941",
  email: "lacordobesa.pasteleriaarg@gmail.com",
  instagram: "https://www.instagram.com/lacordobesa.pasteleriaarg/",
  instagramHandle: "@lacordobesa.pasteleriaarg",
  street: "Am Ginnheimer Wäldchen 1",
  city: "60431 Frankfurt am Main",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=La+Cordobesa+Am+Ginnheimer+W%C3%A4ldchen+1+Frankfurt",
} as const;

export const whatsappHref = (text?: string) =>
  `https://wa.me/${CONTACT.phoneE164.replace("+", "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

/** The digits wa.me expects from a guest-entered phone number: no plus, no spaces, and a German
 *  number written as 0170... gets its country code. Staff type these by hand off a phone screen,
 *  so the shapes vary more than a form would suggest. */
export function waNumber(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("0")) return `49${digits.slice(1)}`;
  return digits;
}

/** A wa.me link to *the guest's* number, with an optional prefilled message.
 *  whatsappHref() above points at the restaurant; this points the other way. */
export const whatsappTo = (phone: string, text?: string) =>
  `https://wa.me/${waNumber(phone)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
