// Uploads the sample photos through the staff UI of whichever site BASE points at, skipping any caption
// that already exists. Credentials come from the environment, never from the command line.
//   staging:    BASE=http://localhost:3000 STAFF_USER=... STAFF_PASS=... node photos/upload-gallery.mjs
//   production: ALLOW_PRODUCTION_DB=1 BASE=https://lacordobesa.vercel.app STAFF_USER=... STAFF_PASS=... node photos/upload-gallery.mjs
// BASE has no default: a forgotten variable must not quietly land on the live site. Anything that is
// not a local dev server needs ALLOW_PRODUCTION_DB=1 as well, the same switch the app's own guard uses.
import { chromium } from "playwright";

const { BASE } = process.env;
if (!BASE) throw new Error("BASE is required, e.g. BASE=http://localhost:3000 (staging via npm run dev)");
const local = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(BASE).hostname);
if (!local && process.env.ALLOW_PRODUCTION_DB !== "1") {
  throw new Error(`${BASE} is not a local dev server; set ALLOW_PRODUCTION_DB=1 to upload to a deployed site`);
}
const { STAFF_USER, STAFF_PASS } = process.env;
if (!STAFF_USER || !STAFF_PASS) throw new Error("STAFF_USER and STAFF_PASS are required");

// Upload order is the reverse of display order: the newest upload is listed first.
const photos = [
  ["empanadas", "Empanadas mit handgedrücktem Repulgue, noch ungebacken", true],
  ["alfajores", "Alfajores mit Dulce de Leche, frisch mit Puderzucker bestäubt", true],
  ["tostadas", "Geröstetes Brot mit Tomate, Oliven und Petersilie", false],
  ["tortilla", "Tortilla de papa, goldbraun gebraten", false],
  ["pasta-pilze", "Gefüllte Pasta mit Champignons und frischem Chili", false],
  ["choripan", "Choripán, gegrillte Chorizo im Brot mit Salsa criolla", true],
  ["bife", "Gegrilltes Steak mit Kartoffelgratin und Schmorgemüse", false],
  ["flan", "Flan mit Karamell, Dulce de Leche und Kirsche", false],
  ["torta-rogel", "Torta Rogel, Teigböden mit Dulce de Leche und geflammtem Baiser", true],
];

const settle = async (page) => {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
};

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await page.goto(`${BASE}/staff/login`, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.fill("#username", STAFF_USER);
await page.fill("#password", STAFF_PASS);
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 90_000 }),
  page.click(".btn-primary"),
]);
await page.goto(`${BASE}/staff/gallery`, { waitUntil: "networkidle", timeout: 90_000 });
await settle(page);

const hasCaption = (caption) => page.locator(`input[name=caption][value="${caption}"]`).count();

for (const [file, caption] of photos) {
  if (await hasCaption(caption)) {
    console.log("skip (exists):", file);
    continue;
  }
  await page.setInputFiles("#g-file", new URL(`./${file}.jpg`, import.meta.url).pathname);
  await page.locator('img[alt="Vorschau"]').waitFor({ timeout: 30_000 });
  await page.selectOption("#g-category", "food");
  await page.fill("#g-caption", caption);
  await page.getByRole("button", { name: "Hochladen" }).click();
  await page.getByText("Bild veröffentlicht.").waitFor({ timeout: 60_000 });
  console.log("uploaded:", file);
  await page.reload({ waitUntil: "networkidle" });
  await settle(page);
}

for (const [, caption, featured] of photos) {
  if (!featured) continue;
  const card = page.locator(".card", { has: page.locator(`input[name=caption][value="${caption}"]`) });
  const box = card.locator("input[name=is_featured]");
  if (await box.isChecked()) continue;
  await box.check();
  await card.getByRole("button", { name: "Speichern" }).click();
  // ActionForm renders "Gespeichert." on success and a role=alert paragraph on failure.
  const saved = card.getByText("Gespeichert.");
  const failed = card.getByRole("alert");
  await saved.or(failed).first().waitFor({ timeout: 60_000 });
  if (await failed.count()) throw new Error(`could not feature "${caption}": ${await failed.first().innerText()}`);
  console.log("featured:", caption);
}

await page.reload({ waitUntil: "networkidle" });
await settle(page);
console.log("gallery cards (incl. the upload form):", await page.locator(".card").count());
await browser.close();
