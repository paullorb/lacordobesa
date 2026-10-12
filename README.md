# La Cordobesa

Website and staff app for La Cordobesa Pastelería Argentina, Frankfurt am Main.

- **Public site** (`/`): German-first landing page with menu, specials, opening hours and a table reservation form.
- **Gallery** (`/gallery`): photos of the venue, food and events, uploaded by staff under `/staff/gallery`.
- **Staff app** (`/staff`): installable PWA where the team confirms reservations and edits menu, specials, gallery, hours and settings.

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
content is in [`supabase/seed.sql`](supabase/seed.sql). After changing the schema, regenerate the types:

```bash
npx supabase gen types typescript --project-id iabpugtwgjqldlzjjgqj > src/lib/database.types.ts
```

How reservations work:

- Guests call the `request_reservation` RPC (via a Server Action). It checks opening hours, closures, lead time,
  party size and seat capacity (overlapping reservations × duration) inside one transaction and inserts a
  `pending` row. Guests can never read the reservations table.
- Abuse limits live inside `request_reservation` (migrations 0005 and 0009), because anon can call it straight
  through the REST API: text length caps, max 3 requests per phone/e-mail per 24 h, one open booking per phone per
  day, and a site-wide cap of 15/hour and 80/24 h. The quota checks, the capacity check and the insert all run under
  one site-wide advisory lock (0009), so a concurrent burst cannot slip past the counts. Tune the constants at the
  top of the function. A Vercel firewall rate-limit rule on `POST /` (the Server Actions) sits in front of the form
  as a first line of defence.
- Staff confirm/cancel in the staff area; the WhatsApp button pre-fills a confirmation message.
- Rules (capacity, slot size, lead time, …) are edited under *Einstellungen* and stored in `site_settings`.

Gallery: `gallery_items` (migration 0007) plus a public Supabase Storage bucket `gallery`; only allow-listed staff can
upload or delete. Images are shrunk in the browser (max 1800 px JPEG) before upload and served through `next/image`.
The seed rows point at illustrations in `public/assets/gallery/` — staff can delete them once real photos are in.

Both public pages emit schema.org JSON-LD ([`src/lib/structured-data.ts`](src/lib/structured-data.ts)): the landing
page a `Restaurant` graph with address and opening hours, `/karte` a `Menu` graph. That is what lets Google show the
hours and a menu link in the search result; check changes with the
[Rich Results Test](https://search.google.com/test/rich-results). Facts we do not have (coordinates, a price range)
are left out on purpose rather than guessed.

Allergens and additives: `menu_items.allergens` / `.additives` hold the German declaration codes (migration
`20261012093136`), the labels live in [`src/lib/allergens.ts`](src/lib/allergens.ts), and the staff menu editor has a
checkbox grid per dish. `/karte` prints the codes as a superscript and builds the legend from the codes actually used.
Declaring the 14 LMIV allergens is a legal requirement in Germany, so the staff page warns while dishes are still
undeclared. The allowed codes are also a check constraint, so no write path can store a code the legend cannot explain.

The contact section embeds Google Maps as a click-to-load iframe (no request to Google until the visitor clicks, see
the Datenschutz page and the `frame-src` entry in the CSP in `next.config.ts`).

Public content (menu, specials, hours, gallery) is cached with `use cache` and invalidated from the staff actions, so the
landing page stays a static shell served from the CDN.

## Not yet done

- No automatic guest notification (e-mail/WhatsApp) on confirmation — staff send it manually.
- Impressum / Datenschutz exist but contain placeholders — fill in [`src/lib/legal.ts`](src/lib/legal.ts) and have the
  Datenschutzerklärung reviewed before going live.
- Contact details are hardcoded in [`src/lib/contact.ts`](src/lib/contact.ts).
- The allergen codes exist per dish, but nobody has filled them in yet: every dish still shows as undeclared in
  the staff menu editor.
