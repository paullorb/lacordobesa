# The La Cordobesa iPhone app

A Capacitor shell around the deployed site, one-to-one: guests get the public pages (menu,
reservations, pre-orders), and the team signs in through the footer's **Team-Login** link to manage
the site under `/staff` and get a push notification for every new reservation, pre-order and catering
inquiry. Opening on the public site is also what makes it an app for everybody in App Review's eyes,
rather than an internal tool behind a login.

## Why Capacitor, not Swift, and not the PWA

- **Not the PWA.** Web Push on iOS only works once the site is added to the home screen, and even
  then it is fragile: the subscription is lost when the home-screen icon is removed or Safari data is
  cleared, there is no reliable way to tell from the server that it died, and it never got to work
  well here.
- **Not Swift.** muk.events (the sibling repository) started with a Capacitor shell and later moved
  its iPhone app to Swift, because it wanted Live Activities, widgets and other deep Apple features
  for a large app (`muk/docs/native-swift-plan.md`). That meant rewriting every screen. Here the
  staff area is a handful of pages and all it needs from the phone is notifications, so a rewrite
  would buy nothing the owners would notice. If that ever changes, the push backend below works for a
  Swift app unchanged: it is plain APNs keyed by device token.
- **Capacitor** loads the live site in a WebView, so every Vercel deploy reaches the app at once
  with no new build, and native push comes from `@capacitor/push-notifications`.

## How it fits together

| Piece | Where |
| --- | --- |
| Shell config (bundle id `de.lacordobesa.staff`, start URL, push presentation) | `capacitor.config.ts` |
| Xcode project (checked in, standard Capacitor practice) | `ios/` |
| Offline page bundled into the app | `mobile/www/index.html` |
| Device tokens, one row per phone that switched on | `staff_push_tokens`, migration `20261121135841` |
| Switch on the dashboard, tap → open the right page | `src/components/staff/native-push.tsx`, `src/components/native-push-tap.tsx`, `src/lib/native-push-client.ts` |
| Sending to APNs (HTTP/2, `.p8` key, no Firebase) | `src/lib/native-push.ts` |
| Triggers | `after()` in `requestReservation`, `requestPreorder`, `requestEventInquiry` |
| CI build, unsigned, on hosted macOS | `.github/workflows/native-build.yml` → `paullorb/cicd` `app-native-build.yml` |

The web pages never import `@capacitor/*`. They reach the plugin through the `window.Capacitor`
global the app injects, so in a browser the switch is simply not rendered.

A token belongs to a device, not a person: registering one that exists moves it to whoever is
signed in, and signing out removes it, so a shared shop phone stops notifying the previous user.
Tokens Apple reports as dead (410, `BadDeviceToken`) are deleted on the next send.

## When the app needs a new build

Only when the shell changes: a Capacitor upgrade, the icon, the start URL (for example when
`lacordobesa.de` goes live; change `server.url` in `capacitor.config.ts`), or a new plugin. Ordinary
web changes do not need one.

After editing `capacitor.config.ts`, run `npx cap sync ios`.

## One-time setup (Paul)

1. Apple Developer Program membership (99 €/year), with the team that will own the app.
2. developer.apple.com → Identifiers → App ID `de.lacordobesa.staff` with **Push Notifications**.
3. developer.apple.com → Keys → a key with **Apple Push Notifications service (APNs)**. Download the
   `.p8` once. Put `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` (the file contents) and
   `APNS_ENV=production` into Vercel's **production** environment (`vercel env add … production`,
   value from stdin; see CLAUDE.md for the traps).
4. App Store Connect → new app with that bundle id.
5. Apply the migration: `supabase db push --db-url "$SUPABASE_DB_URL"`.

## Shipping a build to the owners (TestFlight)

```bash
npm ci && npx cap sync ios && npx cap open ios
```

In Xcode: App target → Signing & Capabilities → pick the team (do not commit the team id), bump the
build number, Product → Archive → Distribute App → TestFlight & App Store. In App Store Connect add
the owners' Apple IDs as **internal testers**; they install TestFlight once and get every later
build over the air. Internal TestFlight builds expire after 90 days, so upload a fresh one at least
once a quarter, or later publish the app as unlisted on the App Store instead.

On the phone: open the app, sign in, tap **Activar avisos** on the dashboard, allow notifications.

## Testing push from Xcode

A build run from Xcode on a cable-connected iPhone registers with the APNs **sandbox**. Set
`APNS_ENV=development` in `.env.local`, run `npm run dev` against local Supabase, and point
`server.url` at your machine for that session only. The Simulator can receive pushes too
(`xcrun simctl push`), but it does not get a real device token.
