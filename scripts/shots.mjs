/**
 * Screenshots every public page, at desktop and phone widths, and reports any console error it
 * saw on the way.
 *
 * This exists because the thing that actually catches problems here is looking at the page. Three
 * real defects were found this way and would not have been found by `npm run check`: a staff
 * calendar that rendered ink on ink, a navbar that wrapped onto two lines, and a Spanish page
 * quietly showing German dish descriptions. Typechecking cannot see any of those.
 *
 *   npm run dev                 # in one terminal
 *   npm run shots               # in another
 *   npm run shots -- --staff    # also walk the staff area, needs STAFF_USER / STAFF_PASS
 *
 * Browsers are not installed by `npm install`. Once per machine:
 *   npx playwright install chromium
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.env.SHOTS_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOTS_OUT ?? ".shots";
const WITH_STAFF = process.argv.includes("--staff");

/** The public pages, in both languages where they have one. */
const PUBLIC_PAGES = [
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
  ["not-found", "/diese-seite-gibt-es-nicht"],
  ["staff-login", "/staff/login"],
];

const STAFF_PAGES = [
  ["staff-today", "/staff"],
  ["staff-reservations", "/staff/reservierungen"],
  ["staff-waitlist", "/staff/warteliste"],
  ["staff-preorders", "/staff/vorbestellungen"],
  ["staff-inquiries", "/staff/anfragen"],
  ["staff-numbers", "/staff/zahlen"],
  ["staff-menu", "/staff/karte"],
  ["staff-specials", "/staff/specials"],
  ["staff-broadcast", "/staff/broadcast"],
  ["staff-gallery", "/staff/gallery"],
  ["staff-hours", "/staff/oeffnungszeiten"],
  ["staff-settings", "/staff/einstellungen"],
];

const VIEWPORTS = [
  ["desktop", 1280, 900, true],
  ["phone", 390, 844, false],
];

/** Collects console errors and uncaught exceptions for one page visit. */
function watch(page) {
  const seen = [];
  page.on("console", (m) => m.type() === "error" && seen.push(`console: ${m.text().slice(0, 140)}`));
  page.on("pageerror", (e) => seen.push(`pageerror: ${String(e).slice(0, 140)}`));
  return seen;
}

async function shoot(browser, pages, label, storageState) {
  let failures = 0;
  for (const [name, path] of pages) {
    for (const [vp, width, height, fullPage] of VIEWPORTS) {
      // reducedMotion so captures are deterministic. Sections reveal on a `view()` timeline, which
      // is a *timeline* rather than a one-shot trigger: anything outside the viewport sits at
      // opacity 0, and scrolling back to the top re-hides it, so a full-page capture of the
      // animated page is mostly blank no matter how you scroll first. Under reduced motion the
      // reveals are not declared at all, which is exactly the "all content visible" rendering a
      // screenshot should show. The motion itself is verified by reading computed styles, not here.
      const context = await browser.newContext({
        viewport: { width, height },
        storageState,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const problems = watch(page);
      try {
        const response = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 60_000 });
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${OUT}/${name}-${vp}.png`, fullPage });
        const status = response?.status() ?? 0;
        // 404 is the right answer for the not-found page, and the browser logs its own console
        // error for that status, so neither counts as a problem there.
        const expected404 = name === "not-found";
        const real = expected404 ? problems.filter((p) => !p.includes("404 (Not Found)")) : problems;
        const bad = status >= 400 && !expected404;
        if (bad || real.length) failures++;
        console.log(`  ${name}-${vp}`.padEnd(30), status, real.length ? real[0] : "clean");
      } catch (error) {
        failures++;
        console.log(`  ${name}-${vp}`.padEnd(30), "FAILED", String(error).slice(0, 110));
      }
      await context.close();
    }
  }
  return failures;
}

/** Signs in once and hands back the cookies, so each staff page does not log in again. */
async function staffSession(browser) {
  const user = process.env.STAFF_USER;
  const pass = process.env.STAFF_PASS;
  if (!user || !pass) throw new Error("--staff needs STAFF_USER and STAFF_PASS in the environment");

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/staff/login`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.fill("#username", user);
  await page.fill("#password", pass);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 60_000 }).catch(() => {}),
    page.click(".btn-primary"),
  ]);
  if (page.url().includes("/login")) {
    const alert = await page.textContent("[role=alert]").catch(() => null);
    throw new Error(`staff sign-in failed: ${alert ?? "no reason given"}`);
  }
  const state = await context.storageState();
  await context.close();
  return state;
}

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });
console.log(`${BASE} -> ${OUT}/`);

let failures = await shoot(browser, PUBLIC_PAGES, "public");
if (WITH_STAFF) {
  console.log("staff:");
  failures += await shoot(browser, STAFF_PAGES, "staff", await staffSession(browser));
}

await browser.close();
console.log(failures ? `\n${failures} page(s) need a look.` : "\nAll pages rendered cleanly.");
process.exit(failures ? 1 : 0);
