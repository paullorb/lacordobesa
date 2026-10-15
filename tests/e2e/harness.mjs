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
 *   npx playwright install chromium webkit
 *
 * With no server listening, or with no STAFF_USER / STAFF_PASS, the affected tests skip rather
 * than fail: `npm run check` has to stay runnable on a laptop with nothing else going on.
 */
import { chromium, webkit, devices } from "playwright";

export const BASE = process.env.E2E_BASE ?? process.env.SHOTS_BASE ?? "http://localhost:3000";

/** Set when the suite runs against `next build && next start`, which turns the size budgets on. */
export const PRODUCTION_BUILD = process.env.E2E_PRODUCTION === "1";

/** Every public page, in both languages where there is one. Mirrors scripts/shots.mjs. */
export const PUBLIC_PAGES = [
  ["home", "/"],
  ["home-es", "/es"],
  ["menu", "/karte"],
  ["menu-es", "/es/karte"],
  ["preorder", "/vorbestellen"],
  ["preorder-es", "/es/vorbestellen"],
  ["catering", "/catering"],
  ["catering-es", "/es/catering"],
  ["gallery", "/gallery"],
  ["gallery-es", "/es/gallery"],
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
  ["menu", "/staff/karte"],
  ["specials", "/staff/specials"],
  ["broadcast", "/staff/broadcast"],
  ["gallery", "/staff/gallery"],
  ["hours", "/staff/oeffnungszeiten"],
  ["settings", "/staff/einstellungen"],
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
  if (!shared) shared = await chromium.launch();
  return shared;
}

export async function closeBrowser() {
  if (shared) await shared.close();
  shared = null;
}

/** WebKit, for the handful of checks where Safari is the browser that misbehaves. Launched on
 *  demand and closed by the caller, because most tests do not need it. */
export const safari = () => webkit.launch();

/** True when something is listening and serving the site. */
export async function serverIsUp() {
  try {
    const response = await fetch(BASE, { signal: AbortSignal.timeout(90_000) });
    return response.ok;
  } catch {
    return false;
  }
}

/** Collects console errors and uncaught exceptions for one page. */
export function watchForErrors(page) {
  const seen = [];
  page.on("console", (m) => m.type() === "error" && seen.push(`console: ${m.text().slice(0, 200)}`));
  page.on("pageerror", (e) => seen.push(`pageerror: ${String(e).slice(0, 200)}`));
  return seen;
}

const staffCredentials = () => ({ user: process.env.STAFF_USER, pass: process.env.STAFF_PASS });

export const haveStaffCredentials = () => Boolean(staffCredentials().user && staffCredentials().pass);

let staffState = null;

/** Signs in once per run and hands back the cookies, so each staff page does not log in again. */
export async function staffStorageState() {
  if (staffState) return staffState;
  const { user, pass } = staffCredentials();
  if (!user || !pass) throw new Error("staff tests need STAFF_USER and STAFF_PASS");

  const context = await (await browser()).newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/staff/login`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.fill("#username", user);
  await page.fill("#password", pass);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 90_000 }).catch(() => {}),
    page.click(".btn-primary"),
  ]);
  if (page.url().includes("/login")) {
    const alert = await page.textContent("[role=alert]").catch(() => null);
    throw new Error(`staff sign-in failed: ${alert ?? "no reason given"}`);
  }
  staffState = await context.storageState();
  await context.close();
  return staffState;
}

/**
 * Opens one page and hands it to `body`, then tidies up.
 *
 * reducedMotion, because the public pages reveal their sections on a scroll-driven timeline:
 * without it everything below the fold sits at opacity 0 and measures as invisible.
 */
export async function visit(path, { width = 1280, height = 900, staff = false, body }) {
  const context = await (await browser()).newContext({
    viewport: { width, height },
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

/** A real iPhone, for the tests that are about what the team sees on the shop floor. */
export async function visitOnPhone(path, { staff = false, body }) {
  const context = await (await browser()).newContext({
    ...devices["iPhone 13"],
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
