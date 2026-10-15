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
- **Visitors** (`/staff/besucher`): consent-free analytics. The browser sends one beacon per pageview, form step,
  contact click and Web Vital to `/api/a` (own origin, no cookies or storage, silent under Do Not Track); the server
  drops bots, validates against closed lists and bumps a daily counter through `track_event` (secret key only). No
  visitor id and no per-visitor row exists, so the numbers are visits, not people. Degrades silently if the migration
  `20261015085039` is not applied.

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
- [Supabase](https://supabase.com) — Postgres, Row Level Security, Auth (projects `lacordobesa` and
  `lacordobesa-staging`, both eu-central-1; see *Environments*)
- Deployed on Vercel

## Run locally

```bash
cp .env.example .env.local   # fill in the Supabase URL + publishable key
npm install
npm run dev
```

Open http://localhost:3000. The staff area is at http://localhost:3000/staff.

Point `.env.local` at the **staging** project, not the live one. See *Environments* right below: the app now
refuses to start a query against production outside the production deployment, so a copied-from-prod
`.env.local` fails on the first page load with an explanation rather than booking real tables.

## Environments

Two Supabase projects. The rule is that only the production deployment on Vercel ever talks to the
production one.

| | Supabase project | Who uses it |
| --- | --- | --- |
| Production | `lacordobesa` (`iabpugtwgjqldlzjjgqj`) | the deployment built from `main`, and nothing else |
| Staging | `lacordobesa-staging` (`yfcpqyxonzjuflsqhasz`) | `npm run dev`, Playwright, agent sessions, anything exploratory |

Vercel's `development` environment holds the staging values too, so `vercel env pull` sets a new machine up
correctly. There is no `preview` environment at all, by choice (see the end of this section).

Until 2026-10-14 there was only the first one, and it was set for every Vercel environment as well as in
every `.env.local`. So local development and every agent session wrote into the live database. The damage is not stray rows: a test burst spends the site-wide quota
inside `request_reservation` (15/hour, 80/24 h) and holds seats in `reservation_availability`, so submitting
the reservation form twenty times to see whether it works can turn a real guest away.

[`src/lib/supabase/env.ts`](src/lib/supabase/env.ts) is what keeps the split in place: it refuses to build a
Supabase client against the production project unless `VERCEL_ENV=production`. A wrong `.env.local` now fails
loudly on the first query. To reach live data on purpose (a one-off script, reproducing something that only
exists in real data), set `ALLOW_PRODUCTION_DB=1` for that one command.

Staging is not a fixture: it was built with `supabase db push` from [`supabase/migrations`](supabase/migrations)
plus `seed.sql` and `seed_menu.sql`, which is also the only check that those files can stand a database up from
nothing. Reset or re-seed it as roughly as you like. A schema change belongs in both, staging first:

```bash
supabase db push --db-url "$STAGING_DB_URL" --yes   # staging, from .env.staging.local
supabase db push --db-url "$SUPABASE_DB_URL" --yes  # production, once it looks right
```

Staff login on staging is the user `paul`; its password, the project's keys and `STAGING_DB_URL` live in
`.env.staging.local` (gitignored, on the owner's machine only). Staging has its own auth users, so a production
password is never usable there. "Allow new users to sign up" is left at the Supabase default on staging, which
is harmless because the allowlist in `public.staff` is what grants access, not having an account.

**Vercel deploys `main` and nothing else.** There is no preview environment: no preview URLs, no preview
environment variables, no deployment for a branch or a pull request. Build minutes are scarce and nobody
reviews previews, so the project runs without them. Two settings keep it that way:

- [`vercel.json`](vercel.json) sets `git.deploymentEnabled` to `{"**": false, "main": true}`, so a push to any
  other branch creates no deployment at all (minimatch, and a branch matching one `true` rule wins).
- The project's Ignored Build Step is `if [ "$VERCEL_ENV" = "production" ]; then exit 1; else exit 0; fi`
  (exit 0 means skip), which also catches a preview somebody triggers by hand with `vercel deploy`.

So the way to see a change before it ships is `npm run dev` against staging, not a preview URL.

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
- Per-visitor limits sit in front of every public form (`src/lib/public-forms.ts`, migrations `20261012215042` and
  `20261014072715`). The phone limits alone do not stop a script that rotates numbers: it fills the evenings with
  fake pending bookings and then trips the site-wide cap, which turns real guests away. The Server Actions hash the
  visitor's address (keyed SHA-256, kept 24 h) and take a unit from `take_request_quota` before calling the RPC.
- The limit binds because the five form RPCs no longer accept the publishable key. That key ships in every browser,
  so until `20261014072715` a script could call `request_reservation` and its siblings directly and never pass the
  quota; now they are granted to `service_role` only and anon gets `permission denied for function`. What anon still
  reaches on purpose: `reservation_availability` (read-only, feeds the date picker under `use cache`) and the
  manage-link RPCs, where the guest's token is the credential. There is no Vercel firewall rule in front of the forms.
- **`SUPABASE_SECRET_KEY` is therefore required, not optional.** Without it `createPrivilegedClient()` throws and
  every public form fails to submit; it no longer degrades to "no per-visitor limit". It is set for `production` in
  Vercel and for local work in `.env.local` (pointing at staging). A new environment needs it before the forms work.
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

## Logo, favicon and home-screen icons

Everything that is not a page but still shows the logo (tab icon, "Add to Home Screen" tile, the two
web app manifests, schema.org `logo`) is listed in [`src/lib/brand.ts`](src/lib/brand.ts), with where
each file is used. To swap in the official logo: replace `public/assets/logo.svg` and
`public/assets/favicon.svg` (the simplified mark for 16 to 32 px), then run `npm run icons`, which
regenerates `public/favicon.ico` and everything in `public/icons/`. The Instagram and WhatsApp
profile pictures are uploaded by hand in those apps. The public site and the staff area are two
separate installable apps (`/manifest.webmanifest`, `/staff.webmanifest`).

## Tests

```bash
npm run check      # lint + typecheck + unit tests. The gate for a commit.
npm run test:e2e   # browser tests; needs `npm run dev` in another terminal
```

Node's own test runner drives both suites and no test dependency was added: the unit tests use
native TypeScript stripping with a small resolver hook for the `@/` alias, and the browser tests
use the `playwright` package `npm run shots` already needed. `tests/unit/` covers the pure
functions (dates in the shop's timezone, locale routing, dictionary parity, the numbers page's
aggregations, guest links). `tests/e2e/` drives a real browser against a real server for layout,
behaviour, accessibility and performance, signed in and signed out. See
[`tests/README.md`](tests/README.md).

`npm run lint` is `oxlint --deny-warnings`, so its findings are *warnings*: read the exit code,
never grep the output for "error".

## Not yet done

- No automatic WhatsApp notification; the WhatsApp button still pre-fills a message staff send by hand.
- Impressum / Datenschutz exist but contain placeholders — fill in [`src/lib/legal.ts`](src/lib/legal.ts) and have the
  Datenschutzerklärung reviewed before going live.
- Contact details are hardcoded in [`src/lib/contact.ts`](src/lib/contact.ts).
- There is still no real food photography. The gallery holds the seeded SVG illustrations, so the landing page shows
  the bundled hero JPEG and no photo strip. This is the single highest-leverage thing left: the plumbing is done,
  it needs photos.
