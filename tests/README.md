# Tests

Two suites, one runner, no new dependencies. Node's own test runner drives both; the browser tests
use the `playwright` package that `npm run shots` already needed.

```bash
npm run check      # lint + typecheck + unit tests. The gate for a commit.
npm run test:unit  # just the unit tests (fast, hermetic, no server)
npm run test:e2e   # the browser tests; needs `npm run dev` in another terminal
npm test           # both
```

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
link and token shapes, the WhatsApp number normalisation, and the schema.org output.

## e2e/ — a real browser against a real server

They point at whatever `.env.local` points at, which is **staging**. Nothing writes: the staff
pages are only read and the public forms are walked up to the point of sending and left there. A
submitted reservation spends the site-wide quota (15 an hour, 80 a day) and holds a seat, so a
test that books a table takes one away from a real guest.

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

Tests skip rather than fail when there is no server listening or no `STAFF_USER` / `STAFF_PASS` in
the environment, so `npm run check` stays runnable on a laptop with nothing else going on.

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
browser asks for, `/es` is Spanish, and the switch is a link. `timezone.test.mjs` pins that. English
does not exist yet; the proposal is in the pull request for #104.

