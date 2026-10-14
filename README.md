# La Cordobesa

Website and staff app for La Cordobesa Pastelería Argentina, Frankfurt am Main.

- **Public site** (`/`): German landing page with menu, specials, opening hours and a table reservation form, also in
  Spanish (`/es`).
- **Gallery** (`/gallery`): photos of the venue, food and events, uploaded by staff under `/staff/gallery`.
- **Pre-orders** (`/vorbestellen`): empanadas by the dozen, a torta for Saturday. Staff mark dishes as pre-orderable
  per dish under `/staff/karte` and work the inbox under `/staff/vorbestellungen`.
- **Waitlist**: a full day offers a waitlist instead of a dead end; staff work it under `/staff/warteliste`.
- **Feiern & Catering** (`/catering`): inquiries for birthdays, Firmenfeiern, Taufen and catering, worked as a small
  lead pipeline under `/staff/anfragen`.
- **Staff app** (`/staff`): installable PWA where the team confirms reservations and edits menu, specials, gallery, hours and settings.
- **Numbers** (`/staff/zahlen`): covers per day/week/month, no-show and cancellation rates, the weekday and time-of-day
  pattern, and the most pre-ordered dishes.

## Languages

German and Spanish (Argentine). German is the default and stays **unprefixed** (`/`, `/karte`); Spanish lives under
`/es/...`.

English was deliberately dropped. Frankfurt's English-speaking visitors read one of the two comfortably enough to
order from a menu, and a third set of copy is a third thing to keep correct every time a sentence changes. Adding it
back is mechanical: `LOCALES` in [`src/lib/i18n.ts`](src/lib/i18n.ts), a dictionary, and a route group.

- **One root layout per language.** `app/(de)/layout.tsx` and `app/(es)/layout.tsx` each render their own `<html>`,
  so `lang` is `de-DE` or `es-AR` depending on which group the URL fell into. This is the reason for the route
  groups; it is the only way to get `<html lang>` right without middleware. The cost is a full page load when
  crossing between them, which happens exactly once per visit: when somebody switches language.
- **No middleware.** Locale rewriting in `proxy.ts` would put an edge function in front of every public request and
  break the "public site stays fully static" promise below. Instead each page has one thin wrapper per URL shape
  (`app/(de)/karte/page.tsx`, `app/(es)/es/karte/page.tsx`) over one shared view in `src/components/pages/`. Every
  variant prerenders and the German URLs never moved.
- **The 404** is `app/global-not-found.tsx`, not `not-found.tsx`: with a root layout per language there is no single
  layout a global 404 could be composed from, so it renders its own document. Needs `experimental.globalNotFound`.
- **Copy** lives in [`src/lib/dictionaries/`](src/lib/dictionaries). `de.ts` defines the shape and `es.ts` is typed
  against it, so a missing key is a build error rather than a blank spot. Interpolation uses functions, not
  `{placeholder}` strings, so the compiler checks the arguments too. That also means client components import the
  dictionary rather than receiving it as a prop, since a function cannot cross the RSC boundary.
- **Staff-entered content** is not in the dictionaries. Dish *names* are already Spanish and work in both languages;
  `menu_items.description_es` (migration `20261012102608`) is optional and falls back to the German description, and
  `/es` says so rather than quietly showing German text under a Spanish heading. `description_en` is still in the
  schema and still editable, simply unread. Specials and category labels are deliberately not translatable: a special
  lives for a few days, and asking the team to write each one twice is how a feature stops being used.
- **The staff app and the e-mail templates are German only.** The team works in German, and a translated Impressum or
  Datenschutzerklärung would be a second legally-relevant text to keep correct, so those stay German in both locales.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Cache Components) + Tailwind v4
- [Supabase](https://supabase.com) — Postgres, Row Level Security, Auth (project `lacordobesa`, eu-central-1)
- Deployed on Vercel

## Run locally

```bash
cp .env.example .env.local   # fill in the Supabase URL + publishable key
npm install
npm run dev
```

Open http://localhost:3000. The staff area is at http://localhost:3000/staff.

## Staff accounts

Staff sign in with a short **name** and password (no e-mail). Supabase Auth is e-mail based, so each name maps
to `<name>@staff.lacordobesa.local` (see [`src/lib/staff.ts`](src/lib/staff.ts)).

Being signed in is not enough: the account also needs a row in `public.staff` (the allowlist from migration
0004, which `is_staff()` checks). There is intentionally no API path that inserts one, so adding a staff member
is two steps in the Supabase dashboard:

1. **Authentication → Users → Add user**, e-mail `maria@staff.lacordobesa.local`, a password, **Auto Confirm** on.
2. **SQL Editor** — allow-list that user (copy the UUID from the users table, or match on the e-mail):

   ```sql
   insert into public.staff (user_id)
   select id from auth.users where email = 'maria@staff.lacordobesa.local'
   on conflict do nothing;
   ```

Skipping step 2 leaves an account that logs in and is then rejected everywhere ("Dieser Zugang ist nicht für
das Team freigeschaltet"). To revoke access, delete the `public.staff` row (the login itself keeps working but
sees nothing). Keep "Allow new users to sign up" turned off under Authentication → Providers → Email.

Auth hardening (dashboard settings, not in migrations): Authentication → Sign In / Providers → Email → set
**Minimum password length to 8** (raise it later if you want) and turn on **Prevent use of leaked passwords** (HaveIBeenPwned; Pro plan).
Both only apply when a password is set or changed, so reset any older short staff passwords.

## Database

Schema lives in [`supabase/migrations`](supabase/migrations) and is already applied to the cloud project; seed
content is in [`supabase/seed.sql`](supabase/seed.sql), and the menu in
[`supabase/seed_menu.sql`](supabase/seed_menu.sql), which runs after it on a fresh database. After changing the
schema, regenerate the types:

```bash
npx supabase gen types typescript --project-id iabpugtwgjqldlzjjgqj > src/lib/database.types.ts
```

How reservations work:

- Guests call the `request_reservation` RPC (via a Server Action). It checks opening hours, closures, lead time,
  party size and seat capacity (overlapping reservations × duration) inside one transaction and inserts a
  `pending` row. Guests can never read the reservations table.
- Abuse limits live inside `request_reservation` (migrations 0005 and 0009): text length caps, max 3 requests per
  phone/e-mail per 24 h, one open booking per phone per day, and a site-wide cap of 15/hour and 80/24 h. The quota
  checks, the capacity check and the insert all run under one site-wide advisory lock (0009), so a concurrent burst
  cannot slip past the counts. Guest moves (`move_reservation_by_token`) take the same lock since `20261012215040`.
  Tune the constants at the top of the function.
- Per-visitor limits sit in front of every public form (`src/lib/public-forms.ts`, migration `20261012215042`). The
  phone limits alone do not stop a script that rotates numbers: it fills the evenings with fake pending bookings and
  then trips the site-wide cap, which turns real guests away. The Server Actions hash the visitor's address (keyed
  SHA-256, kept 24 h) and take a unit from `take_request_quota` before calling the RPC. This needs
  `SUPABASE_SECRET_KEY` on the server; without it the forms run on the publishable key with no per-visitor limit.
- The limit only binds once the form RPCs stop accepting the publishable key, since that key ships in every
  browser and a script can call the RPCs directly. Revoking anon is a separate migration, to be applied only after
  `SUPABASE_SECRET_KEY` is set in Vercel and deployed; applying it earlier breaks every public form. There is no
  Vercel firewall rule in front of the forms.
- Staff confirm/cancel in the staff area; the WhatsApp button pre-fills a confirmation message that includes the
  guest's own management link.
- Guests manage their booking at `/reservierung/<manage_token>`: cancel it, or move it to another slot (at most three
  times). `manage_token` is 18 random bytes as hex, generated by a column default, and is the only credential; the page
  is `noindex` with `referrer: no-referrer`. `cancel_reservation_by_token` and `move_reservation_by_token` re-run the
  same capacity and lead-time checks as `request_reservation`, and a moved booking goes back to `pending` so the
  restaurant confirms the new time. A cancellation hands the seats straight back to `reservation_availability`.
- Rules (capacity, slot size, lead time, …) are edited under *Einstellungen* and stored in `site_settings`.

How pre-orders work (migration `20261012094815`): the public form calls `request_preorder`, which validates the pickup
window against opening hours and closures, enforces the same per-phone and site-wide quotas as `request_reservation`,
and checks every line against `menu_items.is_preorderable`. `preorder_lines` **snapshots** the dish name, unit and price
at order time, so a later menu edit or a deleted dish cannot rewrite what a guest ordered. Guests see and cancel their
order at `/vorbestellung/<manage_token>`; `ready` orders are deliberately not cancellable online, because they are
already baked. Rules live under *Einstellungen* in `site_settings` under key `preorders`. No money changes hands online,
guests pay at pickup.

Specials list (migrations `20261012100835`, `20261012215041`): `specials` had no distribution channel, so only a
visitor who happened to open the site ever saw one. Guests opt in on the landing page, right under the specials, and
staff send from `/staff/broadcast` with a per-guest `wa.me` link. **Double opt-in:** a sign-up is stored unconfirmed,
the guest then sends the restaurant a prefilled WhatsApp from that number, and staff press "bestätigen" when it
arrives. Only confirmed rows are offered for sending, so a stranger's number entered by someone else never gets a
message. E-mail sign-ups are switched off (in `OPEN_CHANNELS` and in `subscribe_broadcast`) because their second step
would be a confirmation mail and no mail sender is configured in production; there is deliberately no "copy all
numbers" or BCC list either, since a group message cannot carry each guest's own unsubscribe link. **Not an automated sender**: the WhatsApp Cloud
API needs a Meta Business account, a verified number and approved templates, none of which exist yet; swapping the
sender later does not change the table. Consent is stored as evidence, not a boolean: `consent_text` snapshots the exact
wording shown ([`src/lib/broadcast.ts`](src/lib/broadcast.ts)), with `consented_at` and `source`, and every message
carries a one-click `/abmelden/<token>` link. Subscribing an already-subscribed contact returns silently rather than
erroring, so the endpoint cannot be used to test whether a number is on the list.

Waitlist (migration `20261012100456`): when every slot on a day exists but none has a free seat, the wizard offers
`/staff/warteliste` instead of a dead end. One entry per phone number per day, compared on the normalised `phone_key`,
so the same guest tapping twice does not push somebody else down the list. Deliberately **not** an automatic allocation
queue: who gets a freed table is the restaurant's judgement, so staff see the list per day in signup order and call
down it. A cancellation or a move already returns the seats to `reservation_availability`, which is what makes the list
worth keeping.

Event inquiries (migration `20261012095610`) are leads, not bookings: there is no capacity to check and no slot to
hold, so `event_inquiries` is a pipeline (`new`, `in_progress`, `quoted`, `won`, `lost`). Date and headcount are both
nullable, because those are usually what the guest wants to discuss. Occasion and budget band are check-constrained to
the sets in [`src/lib/events.ts`](src/lib/events.ts) so the staff list can group on them.

Landing-page photos (migration `20261012101400`): the page shipped with one bundled JPEG and a gallery seeded with SVG
illustrations, so the most appetising thing a restaurant has, its own photography, could not reach the page visitors
land on. Staff now tick *"Auf der Startseite zeigen"* per photo for the strip, and *"Als Hauptbild"* for the large photo
in *Besuch uns*. The hero is one choice, so it is `site_settings.hero.gallery_item_id` rather than a second flag two
rows could both carry; if that photo is deleted the bundled JPEG comes back. The strip prefers the Instagram feed
([`src/lib/instagram.ts`](src/lib/instagram.ts)) when `INSTAGRAM_ACCESS_TOKEN` and `INSTAGRAM_USER_ID` are set, falls
back to the featured photos, and is absent entirely when there is neither. An expired token hides the section rather
than breaking the page.

Gallery: `gallery_items` (migration 0007) plus a public Supabase Storage bucket `gallery`; only allow-listed staff can
upload or delete. Images are shrunk in the browser (max 1800 px JPEG) before upload and served through `next/image`.
The seed rows point at illustrations in `public/assets/gallery/` — staff can delete them once real photos are in.

Both public pages emit schema.org JSON-LD ([`src/lib/structured-data.ts`](src/lib/structured-data.ts)): the landing
page a `Restaurant` graph with address and opening hours, `/karte` a `Menu` graph. That is what lets Google show the
hours and a menu link in the search result; check changes with the
[Rich Results Test](https://search.google.com/test/rich-results). Facts we do not have (coordinates, a price range)
are left out on purpose rather than guessed.

The contact section embeds Google Maps as a click-to-load iframe (no request to Google until the visitor clicks, see
the Datenschutz page and the `frame-src` entry in the CSP in `next.config.ts`).

The numbers page aggregates in TypeScript ([`src/lib/staff-stats.ts`](src/lib/staff-stats.ts)) over one bounded query
per table rather than in SQL: a 20-seat bakery produces a few hundred reservations a quarter, so the window fits in
memory and no migration stands between the team and their numbers. The functions are pure, so they can be exercised on
their own. A "cover" counts seats, not bookings, and never counts a cancelled or no-show booking. Rates keep their
denominator ("3 von 48") and report `null` rather than 0 % when there is nothing to divide by.

Public content (menu, specials, hours, gallery) is cached with `use cache` and invalidated from the staff actions, so the
landing page stays a static shell served from the CDN.

Confirmation mail: when staff confirm a reservation, `setReservationStatus` mails the guest through Resend
([`src/lib/mail.ts`](src/lib/mail.ts), template in [`src/lib/mail-templates.ts`](src/lib/mail-templates.ts)) and records
`confirmation_sent_at`. The send can never undo the confirmation: it is best effort, and whenever it did not succeed the
staff card says so and offers a retry. Set `RESEND_API_KEY` and `MAIL_FROM` to switch it on; without them nothing is
sent and the card reports "nicht konfiguriert".

## Not yet done

- No automatic WhatsApp notification; the WhatsApp button still pre-fills a message staff send by hand.
- Impressum / Datenschutz exist but contain placeholders — fill in [`src/lib/legal.ts`](src/lib/legal.ts) and have the
  Datenschutzerklärung reviewed before going live.
- Contact details are hardcoded in [`src/lib/contact.ts`](src/lib/contact.ts).
- There is still no real food photography. The gallery holds the seeded SVG illustrations, so the landing page shows
  the bundled hero JPEG and no photo strip. This is the single highest-leverage thing left: the plumbing is done,
  it needs photos.
