# La Cordobesa

Website and staff app for La Cordobesa Pastelería Argentina, Frankfurt am Main.

- **Public site** (`/`): German-first landing page with menu, specials, opening hours and a table reservation form.
- **Staff app** (`/admin`): installable PWA where the team confirms reservations and edits menu, specials, hours and settings.

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

Open http://localhost:3000. The admin is at http://localhost:3000/admin.

## Staff accounts

Staff sign in with a short **name** and password (no e-mail). Supabase Auth is e-mail based, so each name maps
to `<name>@staff.lacordobesa.local` (see [`src/lib/staff.ts`](src/lib/staff.ts)).

To add a staff member: Supabase dashboard → **Authentication → Users → Add user**, e-mail
`maria@staff.lacordobesa.local`, a password, and **Auto Confirm** on. They then log in as `maria`.
Keep "Allow new users to sign up" turned off under Authentication → Providers → Email. Every authenticated
user is staff.

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
- Staff confirm/cancel in the admin; the WhatsApp button pre-fills a confirmation message.
- Rules (capacity, slot size, lead time, …) are edited under *Einstellungen* and stored in `site_settings`.

Public content (menu, specials, hours) is cached with `use cache` and invalidated from the admin actions, so the
landing page stays a static shell served from the CDN.

## Not yet done

- No automatic guest notification (e-mail/WhatsApp) on confirmation — staff send it manually.
- Impressum / Datenschutz exist but contain placeholders — fill in [`src/lib/legal.ts`](src/lib/legal.ts) and have the
  Datenschutzerklärung reviewed before going live.
- Opening hours in the seed are placeholders — set the real ones in the admin.
- Contact details are hardcoded in [`src/lib/contact.ts`](src/lib/contact.ts).
