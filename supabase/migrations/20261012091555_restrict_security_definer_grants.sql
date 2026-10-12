-- Supabase's security advisor flags request_reservation() and reservation_availability() as
-- SECURITY DEFINER functions reachable by anon (lint 0028) and by authenticated (lint 0029).
--
-- Both have to stay SECURITY DEFINER and stay reachable by anon. They deliberately read and write
-- public.reservations, which RLS exposes to staff only: reservation_availability() counts existing
-- bookings to report free seats without handing out the rows, and request_reservation() enforces the
-- quota and capacity checks that a direct insert would skip. The public booking flow calls both with
-- the publishable key and no session (createPublicClient sets persistSession: false), so anon is the
-- role that needs them. Making them SECURITY INVOKER would mean opening public.reservations to anon
-- instead, which is strictly worse.
--
-- The `authenticated` grant, however, is unused. src/app/reservations/actions.ts is the only caller of
-- either function and it always uses createPublicClient(), so even a signed-in staff member books as
-- anon; the staff area's own RPC call is is_staff(), which is untouched here. Dropping the unused
-- grant clears lint 0029 and narrows each function to exactly the one role that calls it.
--
-- Also revokes the implicit PUBLIC grant that reservation_availability() still carried, so a role
-- added later does not inherit EXECUTE by default.

revoke execute on function public.reservation_availability(date) from public;
revoke execute on function public.reservation_availability(date) from authenticated;
grant  execute on function public.reservation_availability(date) to anon;

revoke execute on function public.request_reservation(text, text, text, int, date, time, text) from public;
revoke execute on function public.request_reservation(text, text, text, int, date, time, text) from authenticated;
grant  execute on function public.request_reservation(text, text, text, int, date, time, text) to anon;
