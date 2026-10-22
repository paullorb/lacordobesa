/**
 * Shared plumbing for the browser tests.
 *
 * They drive a real `npm run dev` against the **staging** Supabase project, which is what
 * `.env.local` already points at. Nothing here writes: the staff pages are only read, and the
 * public forms are filled in but never submitted, because a submitted reservation spends the
 * site-wide quota and holds a seat.
 *
 *   npm run dev            # one terminal
 *   npm run test:e2e       # another
 *
 * Browsers are not installed by `npm install`. Once per machine:
 *   npx playwright install chromium firefox webkit
 *
 * With no server listening, or with no STAFF_USER / STAFF_PASS, the affected tests skip rather
 * than fail: `npm run check` has to stay runnable on a laptop with nothing else going on.
 */
import { chromium, firefox, webkit, devices } from "playwright";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const BASE = process.env.E2E_BASE ?? process.env.SHOTS_BASE ?? "http://localhost:3000";

// ------------------------------------------------------------------ the device matrix

/**
 * The browsers and devices the suite can run as. Chosen with `E2E_PROJECT`, which defaults to
 * desktop Chromium so `npm run test:e2e` behaves exactly as it always has; `npm run test:matrix`
 * (scripts/test-matrix.mjs) walks the lot.
 *
 * Every entry is an engine plus a Playwright device descriptor. What this does and does not prove
 * is written up in tests/README.md: the engines are real (Blink, Gecko, WebKit), the phones are
 * emulation (viewport, user agent, touch, pixel ratio) and not iOS or Android.
 */
export const PROJECTS = {
  chromium: { engine: "chromium", label: "Chrome, desktop", device: "Desktop Chrome" },
  firefox: { engine: "firefox", label: "Firefox, desktop", device: "Desktop Firefox" },
  webkit: { engine: "webkit", label: "Safari, desktop", device: "Desktop Safari" },
  // Only runs where Microsoft Edge is installed: Playwright drives the real browser through its
  // channel and does not download it. Elsewhere the matrix reports it as unavailable.
  edge: { engine: "chromium", channel: "msedge", label: "Edge, desktop", device: "Desktop Edge" },
  iphone: { engine: "webkit", label: "Safari on an iPhone 15", device: "iPhone 15", mobile: true },
  ipad: { engine: "webkit", label: "Safari on an iPad Pro 11", device: "iPad Pro 11", mobile: true },
  pixel: { engine: "chromium", label: "Chrome on a Pixel 7", device: "Pixel 7", mobile: true },
  galaxy: { engine: "chromium", label: "Chrome on a Galaxy S24", device: "Galaxy S24", mobile: true },
};

export const PROJECT = process.env.E2E_PROJECT ?? "chromium";

const ENGINES = { chromium, firefox, webkit };

if (!PROJECTS[PROJECT]) {
  throw new Error(`E2E_PROJECT=${PROJECT} is not one of ${Object.keys(PROJECTS).join(", ")}`);
}

/** The context options that make a context look like the project's device. Firefox has no mobile
 *  mode, so `isMobile` is dropped there rather than letting Playwright refuse the context. */
export function deviceOptions(name = PROJECT) {
  const { device, engine } = PROJECTS[name];
  const { defaultBrowserType: _ignored, ...options } = devices[device];
  if (engine === "firefox") delete options.isMobile;
  return options;
}

/** The phone the phone-sized tests use, in whichever engine the project runs. */
function phoneOptions() {
  const { defaultBrowserType: _ignored, ...options } = devices["iPhone 13"];
  if (PROJECTS[PROJECT].engine === "firefox") delete options.isMobile;
  return options;
}

/** Whether Microsoft Edge is installed, by trying to start it. */
export async function edgeIsInstalled() {
  try {
    const b = await chromium.launch({ channel: "msedge" });
    await b.close();
    return true;
  } catch {
    return false;
  }
}

/** Set when the suite runs against `next build && next start`, which turns the size budgets on. */
export const PRODUCTION_BUILD = process.env.E2E_PRODUCTION === "1";

/** Every public page, in all three languages where there are. Mirrors scripts/shots.mjs. */
export const PUBLIC_PAGES = [
  ["home", "/"],
  ["home-es", "/es"],
  ["home-en", "/en"],
  ["menu", "/karte"],
  ["menu-es", "/es/karte"],
  ["menu-en", "/en/karte"],
  ["preorder", "/vorbestellen"],
  ["preorder-es", "/es/vorbestellen"],
  ["preorder-en", "/en/vorbestellen"],
  ["catering", "/catering"],
  ["catering-es", "/es/catering"],
  ["catering-en", "/en/catering"],
  ["gallery", "/gallery"],
  ["gallery-es", "/es/gallery"],
  ["gallery-en", "/en/gallery"],
  ["impressum", "/impressum"],
  ["datenschutz", "/datenschutz"],
  ["staff-login", "/staff/login"],
];

export const STAFF_PAGES = [
  ["today", "/staff"],
  ["reservations", "/staff/reservierungen"],
  ["waitlist", "/staff/warteliste"],
  ["preorders", "/staff/vorbestellungen"],
  ["inquiries", "/staff/anfragen"],
  ["numbers", "/staff/zahlen"],
  // Admin only (nav.tsx marks it adminOnly, the page calls requireAdmin). It was the one staff page
  // in the app that no test ever opened, because it is absent from this list rather than because it
  // is hard to reach: the staff account the suite signs in with is an admin. A non-admin session is
  // redirected away, so on such an account these assertions describe whichever page it lands on.
  ["visitors", "/staff/besucher"],
  ["menu", "/staff/karte"],
  ["specials", "/staff/specials"],
  ["gallery", "/staff/gallery"],
  ["hours", "/staff/oeffnungszeiten"],
  ["reviews", "/staff/bewertungen"],
  ["settings", "/staff/einstellungen"],
  // Admin only, like visitors above: the suite signs in as an admin.
  ["team", "/staff/team"],
];

/** The widths that actually decide a layout here: the narrowest phone still in use, the phone the
 *  team carries, a tablet, and a laptop. 320 is the one that catches grids with a fixed column. */
export const WIDTHS = [
  ["narrow-phone", 320, 844],
  ["phone", 390, 844],
  ["tablet", 768, 1024],
  ["laptop", 1280, 900],
];

let shared = null;

/** One browser for the whole run; contexts are cheap, launches are not. */
export async function browser() {
  if (!shared) {
    const { engine, channel } = PROJECTS[PROJECT];
    shared = await ENGINES[engine].launch(channel ? { channel } : {});
  }
  return shared;
}

export async function closeBrowser() {
  if (shared) await shared.close();
  shared = null;
}

/** WebKit, for the handful of checks where Safari is the browser that misbehaves. Launched on
 *  demand and closed by the caller, because most tests do not need it. */
export const safari = () => webkit.launch();

/** True when something answers at BASE. Any HTTP status counts: a 4xx/5xx home page is a regression
 *  for the tests to report, not a reason to skip them. Only a failed connection means "no server". */
export async function serverIsUp() {
  try {
    await fetch(BASE, { signal: AbortSignal.timeout(90_000) });
    return true;
  } catch {
    return false;
  }
}

/**
 * Collects console errors and uncaught exceptions for one page.
 *
 * The cap used to be 200 characters, which is shorter than a React warning's own preamble: a
 * failure said "Each child in a list should have a unique key prop" and then stopped, with the
 * component stack, which is the half that names the file and the line, cut off. A console error is
 * only worth failing a test over if the failure says where to look, so the whole message is kept.
 */
export function watchForErrors(page) {
  const seen = [];
  page.on("console", (m) => m.type() === "error" && seen.push(`console: ${m.text().slice(0, 4000)}`));
  page.on("pageerror", (e) => seen.push(`pageerror: ${(e?.stack ?? String(e)).slice(0, 4000)}`));
  return seen;
}

const staffCredentials = () => ({ user: process.env.STAFF_USER, pass: process.env.STAFF_PASS });

export const haveStaffCredentials = () => Boolean(staffCredentials().user && staffCredentials().pass);

let staffState = null;

/**
 * Where the signed-in cookies are kept between test *files*.
 *
 * `node --test` runs every file in its own process, so a module-level cache only ever saved one
 * sign-in per file: a full run signed in about thirteen times, and two runs inside an hour added up
 * to enough for Supabase Auth to start refusing with a rate limit. That surfaced as three tests
 * failing with "staff sign-in failed" and an empty reason, which looks like a broken login form
 * rather than like a quota. Keeping the state on disk means one sign-in for the whole run.
 *
 * Keyed on the origin **and the staff identity**, so a run against staging and a run against
 * another environment never share a session, and neither do two runs as different users: an
 * origin-only key handed an admin's cookies to a run configured for a non-admin account, which
 * makes admin-only coverage pass for the wrong reason. Short-lived too: a stale session would fail
 * as a redirect to /login, which is a confusing way to find out. Ten minutes is longer than a full
 * run and far inside the token's own lifetime.
 */
const STAFF_STATE_KEY = createHash("sha256")
  .update(`${BASE}\n${(process.env.STAFF_USER ?? "").trim().toLowerCase()}`)
  .digest("hex")
  .slice(0, 12);
const STAFF_STATE_FILE = path.join(os.tmpdir(), `lacordobesa-staff-${STAFF_STATE_KEY}.json`);
const STAFF_STATE_LOCK = `${STAFF_STATE_FILE}.lock`;
const STAFF_STATE_TTL_MS = 10 * 60_000;

/**
 * One process signs in, the others wait for its file.
 *
 * `package.json` runs the suite with `--test-concurrency=2`, so on a cold cache two staff-bearing
 * files can both miss and both start authenticating. Letting the last write win protects the
 * result but not the request, and the rate limit is on the request: that is the flake this cache
 * exists to remove. `mkdir` is atomic on every platform the suite runs on, so exactly one process
 * gets the lock and the rest wait for the state it writes.
 *
 * The holder touches the lock every few seconds while it works, so "abandoned" means a process
 * that stopped, not one that is slow. Without the heartbeat the threshold would have to exceed the
 * whole retry sequence below, which is three attempts of two 90-second timeouts plus its backoff:
 * over nine minutes, and a waiter that gave up sooner would delete a live holder's lock and sign in
 * beside it, under exactly the rate limit the lock exists to avoid.
 */
const SIGN_IN_LOCK_STALE_MS = 30_000;
const SIGN_IN_HEARTBEAT_MS = 5_000;
/** Generous: the wait only ends early, when the holder's file appears. */
const SIGN_IN_WAIT_MS = 10 * 60_000;

const takeSignInLock = () => {
  try {
    mkdirSync(STAFF_STATE_LOCK);
    return true;
  } catch {
    // A lock left behind by a killed process must not stall the next run for ever. A live holder
    // keeps its mtime fresh, so anything this old has stopped.
    try {
      if (Date.now() - statSync(STAFF_STATE_LOCK).mtimeMs > SIGN_IN_LOCK_STALE_MS) {
        rmSync(STAFF_STATE_LOCK, { force: true, recursive: true });
        mkdirSync(STAFF_STATE_LOCK);
        return true;
      }
    } catch {
      /* someone else won the race to clear it */
    }
    return false;
  }
};

/** Says the holder is still alive, until the returned stop is called. */
const beatSignInLock = () => {
  const id = setInterval(() => {
    try {
      const now = new Date();
      utimesSync(STAFF_STATE_LOCK, now, now);
    } catch {
      /* the lock is gone; the finally below will not mind either */
    }
  }, SIGN_IN_HEARTBEAT_MS);
  id.unref?.();
  return () => clearInterval(id);
};

const releaseSignInLock = () => {
  try {
    rmSync(STAFF_STATE_LOCK, { force: true, recursive: true });
  } catch {
    /* nothing to do about it */
  }
};

const freshStateOnDisk = () => {
  try {
    if (Date.now() - statSync(STAFF_STATE_FILE).mtimeMs > STAFF_STATE_TTL_MS) return null;
    const state = JSON.parse(readFileSync(STAFF_STATE_FILE, "utf8"));
    return state?.cookies?.length > 0 ? state : null;
  } catch {
    return null;
  }
};

/** One sign-in, then the cookies, so no staff page logs in again. */
export async function staffStorageState() {
  if (staffState) return staffState;
  const { user, pass } = staffCredentials();
  if (!user || !pass) throw new Error("staff tests need STAFF_USER and STAFF_PASS");

  staffState = freshStateOnDisk();
  if (staffState) return staffState;

  // Whoever does not get the lock waits for the holder's file, and only ever signs in while
  // holding the lock itself: the waiter re-tries acquisition rather than clearing a lock it does
  // not own, so a slow-but-live holder is never joined by a second sign-in.
  for (let waited = 0; !takeSignInLock(); waited += 500) {
    if (waited >= SIGN_IN_WAIT_MS) {
      throw new Error(
        `waited ${Math.round(SIGN_IN_WAIT_MS / 1000)}s for another test process to sign in and it ` +
          `never wrote ${STAFF_STATE_FILE}. Remove ${STAFF_STATE_LOCK} if nothing is running.`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    staffState = freshStateOnDisk();
    if (staffState) return staffState;
  }

  const stopBeating = beatSignInLock();
  try {
    // Once more now the lock is ours: the holder can have written its file and released between
    // this process reading the file and winning the lock, and signing in on top of a valid cache
    // is the duplicate request the lock exists to prevent.
    staffState = freshStateOnDisk();
    if (staffState) return staffState;
    return await signInAndCache();
  } finally {
    stopBeating();
    releaseSignInLock();
  }
}

/** The sign-in itself, run by the one process holding the lock. */
async function signInAndCache() {
  const { user, pass } = staffCredentials();

  // Auth is the one thing here with a rate limit, so a refusal is worth one patient retry rather
  // than failing the file that happened to go first.
  let lastReason = "no reason given";
  for (const waitBefore of [0, 4000, 12_000]) {
    if (waitBefore > 0) await new Promise((resolve) => setTimeout(resolve, waitBefore));

    const context = await (await browser()).newContext();
    const page = await context.newPage();
    try {
      await page.goto(`${BASE}/staff/login`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.fill("#username", user);
      await page.fill("#password", pass);
      await Promise.all([
        page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 90_000 }).catch(() => {}),
        page.click(".btn-primary"),
      ]);
      if (!page.url().includes("/login")) {
        staffState = await context.storageState();
        // Another file may be signing in at the same moment; last write wins and either is valid.
        try {
          writeFileSync(STAFF_STATE_FILE, JSON.stringify(staffState), { mode: 0o600 });
        } catch {
          /* a read-only tmp is not a reason to fail the suite */
        }
        return staffState;
      }
      lastReason = (await page.textContent("[role=alert]").catch(() => null)) || "no reason given";
    } finally {
      await context.close();
    }
  }
  throw new Error(
    `staff sign-in failed after three attempts: ${lastReason}. An empty reason here is usually ` +
      "Supabase Auth rate limiting the sign-in endpoint, not a broken form.",
  );
}

/**
 * Opens one page and hands it to `body`, then tidies up.
 *
 * reducedMotion, because the public pages reveal their sections on a scroll-driven timeline:
 * without it everything below the fold sits at opacity 0 and measures as invisible.
 *
 * `motion: true` turns that off again, for the few tests whose subject *is* the movement. Nothing
 * that measures a layout should ask for it.
 *
 * `before` runs with the fresh page *before* it is navigated, and whatever it returns reaches
 * `body` as `before`. Anything that has to be in place for the very first load belongs there:
 * recording the requests a page makes, or fixing the clock before a script can read it.
 *
 * Use it rather than navigating a second time. A page that is already loaded has everything in
 * cache, so a second navigation reports only about half the requests the first one made (28 of 54
 * on the home page) and never goes `networkidle` at all, because Playwright never sees the
 * activity it is waiting to die down — which is how four of these tests came to hang for 30 s.
 */
export async function visit(
  path,
  { width = 1280, height = 900, native = false, staff = false, motion = false, before, timezoneId, locale, at, standalone = false, body },
) {
  const context = await (await browser()).newContext({
    // `native` is the matrix's own mode: the project's device exactly as Playwright describes it,
    // with its viewport, user agent and touch. Otherwise the width asked for.
    ...(native ? deviceOptions() : { viewport: { width, height } }),
    storageState: staff ? await staffStorageState() : undefined,
    reducedMotion: motion ? "no-preference" : "reduce",
    ...(timezoneId ? { timezoneId } : {}),
    ...(locale ? { locale } : {}),
  });
  // The visitor's clock, frozen at an instant, before the first script runs. Together with
  // `timezoneId` this is "it is 00:30 in Frankfurt and 15:30 in Los Angeles".
  if (at) await context.clock.setFixedTime(at);
  if (standalone) await emulateStandalone(context);
  const page = await context.newPage();
  const errors = watchForErrors(page);
  const prepared = before ? await before({ page, context }) : undefined;
  try {
    const response = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 90_000 });
    return await body({ page, response, errors, context, before: prepared });
  } finally {
    await context.close();
  }
}

/**
 * What an installed web app looks like to the page: `display-mode: standalone` as a media query
 * (Chrome, Edge, Android, Firefox desktop PWAs) and `navigator.standalone` (the iOS home screen).
 *
 * This is the page's view of being installed and nothing more. It does not give you the chromeless
 * window, the status-bar inset or the OS app switcher, so it proves "the CSS and scripts that
 * branch on standalone behave", not "the installed app looks right on an iPhone".
 */
export async function emulateStandalone(context) {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { value: true, configurable: true });
    const real = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      const result = real(query);
      if (!/display-mode:\s*standalone/.test(query)) return result;
      return new Proxy(result, {
        get: (target, key) =>
          key === "matches" ? true : typeof target[key] === "function" ? target[key].bind(target) : target[key],
      });
    };
  });
}

/** A real iPhone, for the tests that are about what the team sees on the shop floor. */
export async function visitOnPhone(path, { staff = false, body }) {
  const context = await (await browser()).newContext({
    ...phoneOptions(),
    storageState: staff ? await staffStorageState() : undefined,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = watchForErrors(page);
  try {
    const response = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 90_000 });
    return await body({ page, response, errors, context });
  } finally {
    await context.close();
  }
}

// ------------------------------------------------------------------ measurements

/**
 * Anything sticking out past the right edge of the viewport.
 *
 * This is the measurement behind the "cropped UI" the team reported: one `white-space: nowrap`
 * inside a grid track made a staff page 667 CSS px wide on a 390 px phone. Safari then widens the
 * layout viewport to fit the content and scales the page up, so the header ends two thirds across
 * the screen and the body is cut off on both sides. Chromium just gives you a sideways scrollbar,
 * which is why nobody saw it on a laptop.
 *
 * Reports the deepest offenders, because an overflowing leaf drags every ancestor out with it.
 */
export async function horizontalOverflow(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const sticksOut = (el) => el.getBoundingClientRect().right > vw + 1;
    const offenders = [];
    for (const el of document.querySelectorAll("body *")) {
      if (!sticksOut(el)) continue;
      // An element inside a sideways-scrolling box is not overflowing the page.
      let scroller = el.parentElement;
      let contained = false;
      while (scroller && scroller !== document.body) {
        const overflowX = getComputedStyle(scroller).overflowX;
        if (overflowX === "auto" || overflowX === "scroll" || overflowX === "hidden") {
          contained = true;
          break;
        }
        scroller = scroller.parentElement;
      }
      if (contained || [...el.children].some(sticksOut)) continue;
      // A closed <details> still reports boxes for its contents; nobody can see them.
      if (!el.checkVisibility({ contentVisibilityAuto: true })) continue;
      offenders.push({
        tag: el.tagName.toLowerCase(),
        className: (el.getAttribute("class") ?? "").slice(0, 80),
        right: Math.round(el.getBoundingClientRect().right),
        text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 50),
      });
    }
    // A box can fit while the text inside it does not: an unbreakable German compound in a heading
    // widens the document without the heading's own rectangle ever leaving the viewport.
    if (offenders.length === 0) {
      for (const el of document.querySelectorAll("body *")) {
        if (el.scrollWidth <= el.clientWidth + 1 || el.clientWidth === 0) continue;
        const overflowX = getComputedStyle(el).overflowX;
        if (overflowX !== "visible") continue;
        if ([...el.children].some((c) => c.scrollWidth > c.clientWidth + 1)) continue;
        offenders.push({
          tag: el.tagName.toLowerCase(),
          className: (el.getAttribute("class") ?? "").slice(0, 80),
          right: el.scrollWidth,
          text: `content needs ${el.scrollWidth}px in ${el.clientWidth}px: ${(el.textContent ?? "").trim().slice(0, 40)}`,
        });
      }
    }
    return { viewport: vw, scrollWidth, overflow: Math.max(0, scrollWidth - vw), offenders: offenders.slice(0, 6) };
  });
}

/** A readable one-liner per offender, for an assertion message somebody has to act on. */
export const describeOverflow = (result) =>
  `${result.scrollWidth}px of content in a ${result.viewport}px viewport\n` +
  result.offenders.map((o) => `      ${o.tag}.${o.className} right=${o.right} "${o.text}"`).join("\n");

/** The clip-path/1px trick the skip link and the screen-reader-only paragraphs use. Those are
 *  meant to be 1x1 and off-screen, so neither the tap-target nor the clipped-text check applies. */
export const VISUALLY_HIDDEN = `(() => {
  // checkVisibility() is the one that knows about a closed <details>: its contents still report a
  // bounding box, so measuring them would flag controls nobody can reach.
  if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) return true;
  if (getComputedStyle(el).clipPath.startsWith("inset(50%")) return true;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 1 || rect.height <= 1) return true;
  return el.closest("[hidden]") !== null || el.closest(".sr-only, .skip-link") !== null;
})()`;

/**
 * Presses "Anordnen" on /staff/karte and waits until the drag handles are there.
 *
 * The page is server-rendered, so a click that lands before React has hydrated is lost without a
 * sound. Press again until the button has taken (it then reads "Fertig" and is aria-pressed).
 */
export async function startArranging(page) {
  const button = page.getByRole("button", { name: "Ordenar", exact: true });
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await page.locator('main button[aria-pressed="true"]').count()) return;
    await button.click({ timeout: 2_000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
  throw new Error("Anordnen never switched on");
}

/**
 * Everything a finger has to hit, with the box it actually offers.
 *
 * A checkbox is reported as the `<label>` wrapped around it where there is one: the browser draws
 * a 13px box, but the whole label is clickable and that is what the thumb aims at.
 */
export async function tapTargets(page) {
  return page.evaluate(
    (hiddenSource) => {
      const isHidden = new Function("el", `return ${hiddenSource}`);
      const selector = "a[href], button, input[type=checkbox], input[type=radio], summary, [role=button]";
      const seen = new Set();
      const out = [];
      for (const el of document.querySelectorAll(selector)) {
        if (isHidden(el)) continue;
        // The hit area is the label around a checkbox, not the little square the browser draws.
        const target = el.matches("input") ? (el.closest("label") ?? el) : el;
        if (seen.has(target)) continue;
        seen.add(target);
        const rect = target.getBoundingClientRect();
        out.push({
          tag: el.tagName.toLowerCase(),
          label: (el.getAttribute("aria-label") ?? target.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
        });
      }
      return out;
    },
    VISUALLY_HIDDEN,
  );
}

/** Text whose own box cuts it off, which is "cropped UI" when the overflow is vertical rather than
 *  sideways: the words are in the DOM and simply not on the screen. Deliberate truncation
 *  (line-clamp, an ellipsis) does not count, nor does anything hidden on purpose. */
export async function clippedText(page) {
  return page.evaluate(
    (hiddenSource) => {
      const isHidden = new Function("el", `return ${hiddenSource}`);
      return [...document.querySelectorAll("h1, h2, h3, p, label, button, a")]
        .filter((el) => {
          if (isHidden(el)) return false;
          const style = getComputedStyle(el);
          if (style.overflow !== "hidden" && style.overflowX !== "hidden") return false;
          if (style.webkitLineClamp !== "none" || style.textOverflow === "ellipsis") return false;
          return el.scrollWidth > el.clientWidth + 1;
        })
        .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 40)}"`);
    },
    VISUALLY_HIDDEN,
  );
}

/**
 * Targets that fail WCAG 2.2 Target Size (Minimum), level AA.
 *
 * The rule is not "everything must be 24px". An undersized target passes on *spacing*: if a 24px
 * circle centred on it touches no other target's circle, a thumb cannot hit the wrong one, which
 * is what the criterion is actually about. That exception is what keeps a column of footer links
 * at their natural line height from being reported, while a 20px × sitting next to a 22px drag
 * handle is.
 */
export function undersizedTargets(targets, minimum = 24) {
  const tooSmall = targets.filter((t) => t.width < minimum || t.height < minimum);
  return tooSmall.filter((t) =>
    targets.some((other) => other !== t && Math.hypot(other.x - t.x, other.y - t.y) < minimum),
  );
}
