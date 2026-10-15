// Uploads the sample photos through the staff UI of whichever site BASE points at, skipping any caption
// that already exists. Credentials come from the environment, never from the command line.
//   staging:    BASE=http://localhost:3000 STAFF_USER=... STAFF_PASS=... node photos/upload-gallery.mjs
//   production: set -a; . ./.env.production.local; set +a; node photos/upload-gallery.mjs
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "https://lacordobesa.vercel.app";
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
  await page.waitForTimeout(2500);
  console.log("featured:", caption);
}

await page.reload({ waitUntil: "networkidle" });
await settle(page);
console.log("gallery cards (incl. the upload form):", await page.locator(".card").count());
await browser.close();
