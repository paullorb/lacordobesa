# Tests

Three suites (unit, database, browser), one runner, no new dependencies. Node's own test runner drives them all; the browser tests
use the `playwright` package that `npm run shots` already needed.

```bash
npm run check             # lint + typecheck + unit tests. The gate for a commit.
npm run check:full        # the above plus the database and browser suites. Before a release.
npm run test:unit         # just the unit tests (fast, hermetic, no server)
npm run test:unit:coverage # the same, with Node's line/branch report
npm run test:integration  # the database tests; needs .env.staging.local, no server
npm run test:e2e          # the browser tests; needs `npm run dev` in another terminal
npm test                  # all three
```

`check` stays fast and hermetic on purpose, so it is runnable on a laptop with nothing else going
on. That is also how the browser suite came to rot: for three commits in a row nobody ran it, and
twelve of its tests had been failing against a selector that a UI change had removed. **`check` is
the commit gate; `check:full` is the one to run before a release.** CI (`.github/workflows/tests.yml`)
runs `check` on every push and pull request, and the database and browser suites against staging every
night; only `check` is required to merge.

Browsers are not installed by `npm install`. Once per machine:

```bash
npx playwright install chromium firefox webkit
```

## unit/ — pure functions, run on Node

`node --test` with native TypeScript stripping, so there is no build step. That needs **Node 22.18
or newer**; `tests/require-node.mjs` says so up front on an older one instead of failing on a missing
`registerHooks` export. `tests/alias-hook.mjs`
teaches Node the `@/` alias and the extensionless imports that go with it, and maps `server-only`
to nothing so a module that imports it can still be loaded. Anything that reaches for `next/*` at
runtime is out of scope here and is covered by the browser tests instead.

What is pinned: calendar arithmetic in the shop's timezone, the locale routing rules, the two
dictionaries having the same keys in the same shapes, the numbers page's aggregations, the guest
link and token shapes, the WhatsApp number normalisation, the schema.org output, the production-database
guard, the confirmation mail's escaping, and the bot and browser detection behind the numbers page.

### coverage.test.ts, and why a percentage is not enough

Node's coverage report only lists files it actually **loaded**. A module no test imports is absent
from the report rather than counted as zero, so the number goes *up* when a module stops being
covered. `npm run test:unit` once reported 96.99% while fourteen modules had no test at all,
including `supabase/env.ts`, the guard that keeps writes off the production database.

`coverage.test.ts` therefore works from the file system. Every module under `src/lib` has to be
reachable from some test, directly or through a module a test imports, or be listed in
`LIB_WITHOUT_TESTS` with a reason naming what covers it instead. Every page under `src/app` has to
be opened by the browser suite or listed in `PAGES_NOT_IN_A_LIST`. Both lists are checked for stale
entries, so an excuse cannot outlive the thing it excused. Adding a module and forgetting the test
is a failing test with the module's name in it.

The four modules that are excused are the ones that cannot be imported outside a request at all
(`next/headers`, `next/navigation`, `NextResponse`); each entry says which browser test covers it.

## integration/ — the database, through the client the app uses

`npm run test:integration`. No browser and no server: these talk to **staging**
(`lacordobesa-staging`) with `@supabase/supabase-js`, which is the same path the app takes, so the
grants and the row level security policies are part of what is exercised rather than mocked away.

There are twenty-six RPCs and seventeen tables with RLS on all of them, and before these files none
of it had a test. What is pinned:

| file | what it is for |
| --- | --- |
| `grants.test.mjs` | Who may call what and read what. The form RPCs are service_role only (20261014072715); `menu_items` is staff-read-only and the public pages read the `menu_items_public` view. Every table is checked for an anonymous read and an anonymous write. |
| `schema.test.mjs` | Schema invariants through `psql`: RLS enabled on every table, every SECURITY DEFINER function pinning its `search_path`, the full grant matrix as a snapshot, and that every migration on disk is applied. |
| `reservations.test.mjs` | `request_reservation`'s twelve refusal codes, the per-contact and site-wide limits, `phone_key` normalisation, and the guest's own link (view, cancel, move). |
| `preorders.test.mjs` | `request_preorder`: the basket's shape, pack sizes, opening hours on the chosen day, the fresh-or-par-baked rule, and the guest's order link. |
| `staff.test.mjs` | What a signed-in staff member can do: `create_preorder_manually` (and that a refused basket leaves no row), the atomic menu reorder, `analytics_breakdown`. |
| `content.test.mjs` | The `use cache` getters in `lib/data.ts` and `lib/preorders.ts` against real rows, including that `getMenu` blanks a hidden price and that the form's settings agree with the ones the RPC validates against. |

**These tests write, and they clean up after themselves.** That is the point of the staging project.
Two things follow:

- `request_reservation` has a site-wide brake of 15 an hour counted off `reservations.created_at`.
  Rows left behind would spend that allowance for the browser suite and for anyone testing a form by
  hand, and the `too_many_requests` that followed would look like a bug in the booking form. Every
  file clears up in `afterEach`, so at most two test rows exist at a time, and `cleanup()` also
  sweeps anything an earlier crashed run left under the name `ZZ Test Harness`.
- `tests/integration/harness.mjs` **refuses to run against production**, with the project ref
  hardcoded and no escape hatch. `src/lib/supabase/env.ts` guards the app; it cannot guard these
  files, because they are not the app.

Without `.env.staging.local` the whole suite skips rather than fails.

## e2e/ — a real browser against a real server

They point at whatever `.env.local` points at, which is **staging**. Nothing writes, with one
named exception: the staff pages are only read and the public forms are walked up to the point of
sending and left there. A submitted reservation spends the site-wide quota (15 an hour, 80 a day)
and holds a seat, so a test that books a table takes one away from whoever tests next.

The exception is `token-routes.test.mjs`, which has to have a booking in order to open a booking's
page. It creates its fixtures with the service key and deletes them in `after`, which gives the
quota allowance back.

| file | what it is for |
| --- | --- |
| `layout.test.mjs` | Every page at 320 / 390 / 768 / 1280 px fits the screen. Plus the WebKit check, the staff nav, tap targets and clipped text. |
| `public.test.mjs` | The reservation calendar, the celebration wizard, language switching, the legal back-links, titles and descriptions. |
| `install.test.mjs` | Add to Home Screen: each page links the right manifest, both manifests load without a session, every tab and home-screen icon loads. Safari itself needs a real iPhone. |
| `staff.test.mjs` | Sign-in, every staff page, the nav's current state, the menu editor and the opening-hours editor. |
| `a11y.test.mjs` | Headings, control names, alt text, colour contrast, keyboard reachability, landmarks. |
| `matrix.test.mjs` | Smoke test for the device matrix: every public page loads, has one h1, the right `lang`, no overflow and no console error as that browser or phone; the open-now line, the calendar and the language switch work. |
| `timezone.test.mjs` | The browser's timezone and clock set to Los Angeles, Tokyo, Samoa and Kiribati around Frankfurt's midnight: "Heute", the first bookable day and "open now" must not move. Also pins that the browser's language does not pick the site's. |
| `pwa.test.mjs` | The staff app's manifest, icons and scope, and the pages under emulated `display-mode: standalone` / `navigator.standalone`. |
| `perf.test.mjs` | Request origins, fonts, layout shift, image sizing, DOM size, duplicate requests. |
| `house-style.test.mjs` | House style as the browser paints it: the site's own icons rather than the system's emoji, and the rest of the rules an editor would flag. |
| `motion.test.mjs` | The FLIP layer: the two places where a list reorders or a grid refilters, and that the rows are followed to where they land. |
| `polish.test.mjs` | The finishing layer, each detail checked for the one way it quietly breaks: the word-by-word headline and its siblings. |
| `token-routes.test.mjs` | The twelve pages whose URL is a credential, in all three languages: that they open, that the language switch keeps the token (#134 broke the build here), that they are noindex and send no referrer, and that a dead link is answered rather than crashed on. The one file under `e2e/` that writes: it arranges one reservation, one order and one sign-up in staging and deletes them afterwards, because a token page cannot be opened without a row to open. |

Tests skip rather than fail when there is no server listening or no `STAFF_USER` / `STAFF_PASS` in
the environment, so `npm run check` stays runnable on a laptop with nothing else going on.

**One sign-in per run, cached on disk.** `node --test` runs every file in its own process, so a
module-level cache saved one sign-in *per file*: a full run signed in about thirteen times, and two
runs inside an hour added up to enough for Supabase Auth to rate-limit the endpoint. It surfaced in
CI as three tests failing with "staff sign-in failed" and an empty reason, which reads like a broken
login form rather than a quota. `staffStorageState()` now keeps the cookies in a file under the
system temp directory, keyed on the origin and good for ten minutes, and retries a refused sign-in
twice with a backoff.

### Why the layout file exists

A bug report with photographs: on an iPhone the staff menu editor rendered with the navbar
stopping two thirds of the way across, the body cut off at both edges, and the page apparently
zoomed in. All three were one cause. A single `truncate` on a dish description is
`white-space: nowrap`, whose min-content is the whole sentence, and a CSS grid track never shrinks
below min-content; the page came out 667 CSS px wide inside a 390 px viewport. Safari widens its
layout viewport to fit content that does not fit and scales the page, while the body stays at
device width, which is exactly what the photographs showed. Chromium renders the same overflow as
a sideways scrollbar nobody notices on a laptop, so the check had to be a measurement.

### Weight budgets

The byte budgets in `perf.test.mjs` are skipped by default: a dev server is unminified and serves
source maps, so a number taken there means nothing. Against a real build:

```bash
npm run build && npm start
E2E_PRODUCTION=1 npm run test:e2e
```

### Pointing somewhere else

`E2E_BASE=https://… npm run test:e2e` runs the whole suite against another origin. The staff tests
need credentials for *that* environment in `STAFF_USER` / `STAFF_PASS`.

## The device matrix (`npm run test:matrix`)

Not part of `npm run check` (that stays lint, typecheck, unit tests). The matrix runs the browser
suite once per project and takes a few minutes. It needs `npm run dev` running and refuses to
start without it, because a matrix that skips everything is green and proves nothing.

```bash
npm run test:matrix                   # every project that can run on this machine
npm run test:matrix -- iphone webkit  # just those
npm run test:matrix -- --list
E2E_PROJECT=pixel npm run test:e2e -- tests/e2e/matrix.test.mjs   # one project, one file
```

| project | engine | what it is |
| --- | --- | --- |
| `chromium`, `firefox`, `webkit` | Blink, Gecko, WebKit | Desktop Chrome, Firefox, Safari. These also run the width-by-width layout and guest-flow files, and the timezone tests. |
| `edge` | Blink via the `msedge` channel | Only where Edge is already installed; Playwright does not download it. Reported as *unavailable*, never as passed. |
| `iphone`, `ipad` | WebKit | iPhone 15 and iPad Pro 11 descriptors. |
| `pixel`, `galaxy` | Blink | Pixel 7 and Galaxy S24 descriptors. |

**What this proves.** The three engines are the real ones, so CSS one engine does not understand,
`Intl` output that differs, a script that throws in one runtime, and a page wider than a phone all
show up. A phone project adds the viewport, user agent, touch events and pixel ratio.

**What it does not prove, and nothing here can.**

- It is not iOS or Android. WebKit on macOS is not Mobile Safari: there is no dynamic toolbar,
  no safe-area insets, no iOS keyboard resizing the viewport, no Dynamic Island, no iOS text
  autosizing. Chrome for Android's address bar behaviour and Samsung Internet are not covered.
- Firefox on Android (Fenix) and Edge on a phone are not covered: Playwright has no mobile Firefox,
  and Edge needs the real browser installed.
- The installed web app (PWA) is checked as the page sees it: manifest, icons, scope, theme colour,
  and the pages under emulated `display-mode: standalone` and `navigator.standalone`. The chromeless
  window, the status-bar inset, the app switcher, the install prompt and the service worker's
  behaviour in a dev server (it registers only in a production build) need a real phone.
- Real-device checklist for a release that touches layout: add `/staff` to the home screen on an
  iPhone and on an Android phone, open it from the icon, rotate, switch apps and come back.

### Timezones and language

Opening hours, "open now", the reservation calendar and the pre-order lead time are all
**Frankfurt time for everyone**. Every conversion goes through `Europe/Berlin` in `src/lib/dates.ts`
(`todayISO`, `berlinClock`, `leadBoundary`); the visitor's timezone is never used. Unit tests run
those helpers with the machine set to six zones and with the clock at the DST changes; the browser
tests run the home page as Los Angeles, Tokyo, Pago Pago and Kiritimati around Frankfurt's midnight.

There is no language negotiation, on purpose (see `src/lib/i18n.ts`): `/` is German whatever the
browser asks for, `/es` is Spanish, `/en` is English, and the switch is a link. `timezone.test.mjs` pins that.
The unit tests check every dictionary against German key by key, and the e2e tests cover the `/en` routes, the
three-way switch on every device in the matrix, hreflang and og:locale, and the German-only legal pages with their note.

