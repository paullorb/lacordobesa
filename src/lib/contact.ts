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
