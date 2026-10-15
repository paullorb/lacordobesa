/**
 * Regenerates every raster icon from the two logo SVGs. Run it after replacing the logo:
 *
 *   npm run icons
 *
 * Reads   public/assets/logo.svg      the full emblem, for the home-screen and manifest icons
 *         public/assets/favicon.svg   the simplified mark, for the 16 to 48 px tab icons
 * Writes  public/favicon.ico, public/icons/*.png
 *
 * `src/lib/brand.ts` lists what is generated and where each file is used; the unit test there checks
 * that every file it names exists, so a missing output fails `npm run check`.
 *
 * Why not one transparent circle for everything: iOS fills transparent pixels in a home-screen icon
 * with black, and Android's maskable icons are cropped to a shape. So the home-screen and maskable
 * icons are a full-bleed square in the brand colour, the emblem sits inside it, and only the plain
 * "any" icons keep the round cut-out.
 */
import sharp from "sharp";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const BLUE = "#52a8d2";
const INK = "#152f3b";

// librsvg (what sharp rasterises with) does not draw <textPath>, so the lettering on the arc would be
// silently missing from every PNG. Swap it, in memory only, for one rotated <text> per letter on the same
// circle (centre 120,121, radius 80). The pitch is a fixed estimate of Arial 16px plus its letter-spacing,
// so the spacing is close to the browser's but not identical; the SVG on the site is untouched.
function withLetteredArc(svg) {
  const label = svg.match(/<textPath[^>]*>([^<]+)<\/textPath>/)?.[1];
  if (!label) return svg;
  const step = (14.4 / 80) * (180 / Math.PI);
  const first = (-step * (label.length - 1)) / 2;
  const letters = [...label]
    .map((ch, i) =>
      ch === " "
        ? ""
        : `<text x="120" y="41" transform="rotate(${(first + step * i).toFixed(2)} 120 121)" text-anchor="middle">${ch}</text>`,
    )
    .join("");
  return svg.replace(
    /<text[^>]*>\s*<textPath[\s\S]*?<\/text>/,
    `<g fill="#fff8e9" font-family="Arial,sans-serif" font-size="16">${letters}</g>`,
  );
}

const logo = Buffer.from(withLetteredArc(await readFile(path.join(PUBLIC, "assets/logo.svg"), "utf8")));
const mark = await readFile(path.join(PUBLIC, "assets/favicon.svg"));

/** The emblem rendered at `size` px, rasterised from the SVG large, then scaled down, so a small size is not a blown-up small render. */
const render = (svg, size) => sharp(svg, { density: 576 }).resize(size, size).png().toBuffer();

/** A square `size` px, filled with `background`, with the emblem centred at `scale` of the width.
 *  No alpha channel: nothing is left for a home screen to fill in black. */
async function tile(size, background, scale) {
  const inner = Math.round(size * scale);
  const offset = Math.round((size - inner) / 2);
  return sharp({ create: { width: size, height: size, channels: 3, background } })
    .composite([{ input: await render(logo, inner), left: offset, top: offset }])
    .removeAlpha()
    .png()
    .toBuffer();
}

/** Just the round emblem on a transparent square, for manifest icons with purpose "any". */
const round = (size) => render(logo, size);

/** An .ico that holds PNGs, which every browser since IE 11 reads: a 6 byte header, a 16 byte entry
 *  per image, then the images. Saves a dependency for what is a tiny, fixed format. */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const out = (file, data) => writeFile(path.join(PUBLIC, file), data).then(() => console.log("wrote", file));

await mkdir(path.join(PUBLIC, "icons"), { recursive: true });

// Tab icons.
const favicons = await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await render(mark, size) })));
await out("favicon.ico", ico(favicons));
await out("icons/favicon-32.png", favicons[1].data);

// Home-screen tiles. 180 is what iOS asks for; it scales it down for older devices.
await out("icons/apple-touch-icon.png", await tile(180, BLUE, 1));
await out("icons/staff-apple-touch-icon.png", await tile(180, INK, 0.84));

// Web app manifest icons. Maskable ones keep the emblem inside the central 80% safe zone.
await out("icons/icon-192.png", await round(192));
await out("icons/icon-512.png", await round(512));
await out("icons/icon-512-maskable.png", await tile(512, BLUE, 0.8));
await out("icons/staff-icon-192.png", await tile(192, INK, 0.86));
await out("icons/staff-icon-512.png", await tile(512, INK, 0.86));
await out("icons/staff-icon-512-maskable.png", await tile(512, INK, 0.8));
