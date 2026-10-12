/** Mirrors the limits enforced in request_reservation() and the reservations table constraints. */
export const FIELD_LIMITS = { name: 100, phone: 30, email: 254, notes: 500 } as const;
