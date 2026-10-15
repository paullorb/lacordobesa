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
npx playwright install chromium webkit
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
| `staff.test.mjs` | Sign-in, every staff page, the nav's current state, the menu editor and the opening-hours editor. |
| `a11y.test.mjs` | Headings, control names, alt text, colour contrast, keyboard reachability, landmarks. |
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
