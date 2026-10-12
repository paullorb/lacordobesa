-- The public form RPCs stop accepting the publishable key.
--
-- APPLY ONLY AFTER SUPABASE_SECRET_KEY IS SET IN VERCEL AND DEPLOYED. Until then the Server Actions
-- call these functions with the publishable key, and this migration turns every booking, pre-order,
-- inquiry, waitlist entry and specials sign-up into an error.
--
-- The publishable key ships in every visitor's browser, so as long as anon may execute these
-- functions a script can call them through the REST API and skip the per-visitor limit in the
-- Server Actions (20261012215042) entirely. Rotating phone numbers then fills the evenings with fake
-- pending bookings and trips the site-wide caps, which turns real guests away. After this migration
-- the only way in is a Server Action, which runs on the secret key and counts per visitor.
--
-- Left on anon on purpose: reservation_availability (read-only), and the *_by_token functions, which
-- need a 144-bit token the caller can only have from their own booking.

revoke execute on function public.request_reservation(text, text, text, int, date, time, text) from public, anon, authenticated;
revoke execute on function public.request_preorder(text, text, text, date, time, jsonb, text) from public, anon, authenticated;
revoke execute on function public.request_event_inquiry(text, text, text, text, text, date, int, text) from public, anon, authenticated;
revoke execute on function public.join_waitlist(text, text, text, date, int, text) from public, anon, authenticated;
revoke execute on function public.subscribe_broadcast(text, text, text, text, text) from public, anon, authenticated;

grant execute on function public.request_reservation(text, text, text, int, date, time, text) to service_role;
grant execute on function public.request_preorder(text, text, text, date, time, jsonb, text) to service_role;
grant execute on function public.request_event_inquiry(text, text, text, text, text, date, int, text) to service_role;
grant execute on function public.join_waitlist(text, text, text, date, int, text) to service_role;
grant execute on function public.subscribe_broadcast(text, text, text, text, text) to service_role;
