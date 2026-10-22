/** Spanish labels for every workflow status in the staff app.
 *
 *  These were in four places and two conventions: two local `LABEL` consts inside components
 *  (reservations, waitlist) and two exported from their domain lib (pre-orders, inquiries). One
 *  file means a renamed status reads the same on every page, and the staff app is Spanish only, so
 *  there is no dictionary to route these through.
 *
 *  The guest-facing wording for the same statuses is deliberately *not* here: a guest reads
 *  "Wir melden uns, sobald wir deinen Tisch bestätigen können", staff read "Offen". Those live in
 *  src/lib/dictionaries/ and carry their own tone, in every language. */
import type { Enums } from "@/lib/database.types";

export const RESERVATION_STATUS_LABEL: Record<Enums<"reservation_status">, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  no_show: "No se presentó",
  completed: "Completada",
};

export const WAITLIST_STATUS_LABEL: Record<Enums<"waitlist_status">, string> = {
  waiting: "En espera",
  notified: "Contactada",
  converted: "Mesa asignada",
  expired: "Vencida",
  cancelled: "Cancelada",
};

export const PREORDER_STATUS_LABEL: Record<Enums<"preorder_status">, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  ready: "Listo para retirar",
  collected: "Retirado",
  cancelled: "Cancelado",
};

export const INQUIRY_STATUS_LABEL: Record<Enums<"inquiry_status">, string> = {
  new: "Nueva",
  in_progress: "En curso",
  quoted: "Presupuesto enviado",
  won: "Aceptada",
  lost: "Perdida",
};
