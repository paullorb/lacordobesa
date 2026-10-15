/** German labels for every workflow status in the staff app.
 *
 *  These were in four places and two conventions: two local `LABEL` consts inside components
 *  (reservations, waitlist) and two exported from their domain lib (pre-orders, inquiries). One
 *  file means a renamed status reads the same on every page, and the staff app is German only, so
 *  there is no dictionary to route these through.
 *
 *  The guest-facing wording for the same statuses is deliberately *not* here: a guest reads
 *  "Wir melden uns, sobald wir deinen Tisch bestätigen können", staff read "Offen". Those live in
 *  src/lib/dictionaries/ and carry their own tone, in every language. */
import type { Enums } from "@/lib/database.types";

export const RESERVATION_STATUS_LABEL: Record<Enums<"reservation_status">, string> = {
  pending: "Offen",
  confirmed: "Bestätigt",
  cancelled: "Storniert",
  no_show: "Nicht erschienen",
  completed: "Erledigt",
};

export const WAITLIST_STATUS_LABEL: Record<Enums<"waitlist_status">, string> = {
  waiting: "Wartet",
  notified: "Angerufen",
  converted: "Hat einen Tisch",
  expired: "Verfallen",
  cancelled: "Abgesagt",
};

export const PREORDER_STATUS_LABEL: Record<Enums<"preorder_status">, string> = {
  pending: "Offen",
  confirmed: "Bestätigt",
  ready: "Zum Abholen bereit",
  collected: "Abgeholt",
  cancelled: "Storniert",
};

export const INQUIRY_STATUS_LABEL: Record<Enums<"inquiry_status">, string> = {
  new: "Neu",
  in_progress: "In Arbeit",
  quoted: "Angebot raus",
  won: "Gewonnen",
  lost: "Verloren",
};
