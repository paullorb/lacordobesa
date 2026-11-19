-- The language a guest signed up for the specials in, so the unsubscribe link staff send them points
-- at /es/abmelden or /en/abmelden instead of always the German page.
--
-- A separate column and a small setter rather than a new parameter on request_broadcast_email() and
-- subscribe_broadcast(): changing those signatures would make a deploy that runs before this
-- migration fail every sign-up. The Server Action calls the setter after the sign-up succeeded and
-- ignores a failure, so the worst case is the German link that every row had until now.

alter table public.broadcast_optins
  add column locale text not null default 'de' constraint broadcast_optins_locale_check check (locale in ('de', 'es', 'en'));

comment on column public.broadcast_optins.locale is 'Language of the page the guest signed up on; picks the language of their unsubscribe link.';

-- Only touches a row that is still waiting for its confirmation: a confirmed row keeps the language
-- it was confirmed in, and a repeat sign-up for it must not change anything.
create or replace function public.set_broadcast_optin_locale(
  p_channel text, p_email text, p_phone text, p_locale text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_locale is null or p_locale not in ('de', 'es', 'en') then return; end if;
  if p_channel = 'email' then
    update public.broadcast_optins o set locale = p_locale
     where o.channel = 'email' and o.unsubscribed_at is null and o.confirmed_at is null
       and lower(o.email) = lower(trim(coalesce(p_email, '')));
  elsif p_channel = 'whatsapp' then
    update public.broadcast_optins o set locale = p_locale
     where o.channel = 'whatsapp' and o.unsubscribed_at is null and o.confirmed_at is null
       and public.phone_key(o.phone) = public.phone_key(trim(coalesce(p_phone, '')));
  end if;
end $$;

revoke execute on function public.set_broadcast_optin_locale(text, text, text, text) from public, anon, authenticated;
grant execute on function public.set_broadcast_optin_locale(text, text, text, text) to service_role;

-- The e-mail confirmation page renders in the guest's language, which the link already carries
-- (?lang=); WhatsApp rows are confirmed by staff, so they take the language from the sign-up.
