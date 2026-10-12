-- Tracks whether the guest has actually been told their table is confirmed.
--
-- Set only after the mail provider accepts the message, so an outage or a missing API key leaves the
-- column null and the staff card offers a retry instead of quietly pretending the guest was informed.
-- Confirming a reservation must never fail because mail failed, which is why this is a separate column
-- rather than part of the status.

alter table public.reservations add column confirmation_sent_at timestamptz;

comment on column public.reservations.confirmation_sent_at is
  'When the confirmation e-mail was accepted by the provider; null = guest not informed by mail yet';
