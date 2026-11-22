/**
 * Turns a photo straight off a phone into the file the gallery serves.
 *
 *   1. Upright and at most 2000 px on the long edge.
 *   2. Everything the phone wrote into it is dropped: location, device, time. sharp does that
 *      unless told otherwise, and it matters here, because the owners take these at the shop and at home.
 *   3. The emblem in the bottom right corner, so the photo still says whose it is once it has been
 *      saved from the site and posted somewhere else.
 *   4. The venue's name, copyright line and web address written back as EXIF and XMP, which is what
 *      Google Images shows under "Creator / Credit / Copyright" and what a picture desk looks at.
 *
 * A mark in a corner can be cropped away and metadata is stripped by most social networks, so this
 * is attribution, not protection. Both are cheap and neither is in the way.
 */
import sharp from "sharp";
import { readFile } from "node:fs/promises";

export const BRANDING = {
  name: "La Cordobesa",
  credit: "La Cordobesa, Pastelería Argentina, Frankfurt am Main",
  city: "Frankfurt am Main",
  country: "Germany",
};

const LONG_EDGE = 2000;
/** The request to the site must stay under Vercel's 4.5 MB body limit; see MAX_BYTES in the route. */
const MAX_BYTES = 3.5 * 1024 * 1024;
const LOGO = new URL("../../public/assets/logo.svg", import.meta.url);

const xml = (s) => String(s).replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The XMP packet: Dublin Core for creator/rights/title, Photoshop for credit and place,
 *  xmpRights for the "this is copyrighted, and here is where to ask" pair. */
export function xmpPacket({ siteUrl, caption, year }) {
  const rights = `© ${year} ${BRANDING.name}`;
  const alt = (tag, value) => `<${tag}><rdf:Alt><rdf:li xml:lang="x-default">${xml(value)}</rdf:li></rdf:Alt></${tag}>`;
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/" xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"
 photoshop:Credit="${xml(BRANDING.credit)}" photoshop:Source="${xml(siteUrl)}" photoshop:City="${xml(BRANDING.city)}" photoshop:Country="${xml(BRANDING.country)}"
 xmpRights:Marked="True" xmpRights:WebStatement="${xml(siteUrl)}">
<dc:creator><rdf:Seq><rdf:li>${xml(BRANDING.name)}</rdf:li></rdf:Seq></dc:creator>
${alt("dc:rights", rights)}
${caption ? alt("dc:description", caption) : ""}
</rdf:Description></rdf:RDF></x:xmpmeta>
<?xpacket end="w"?>`;
}

/** `input` (any format sharp reads, HEIC excluded: Apple's web derivatives are JPEG) -> branded JPEG buffer. */
export async function brandPhoto(input, { siteUrl, caption = "", year = new Date().getFullYear() }) {
  const upright = await sharp(input, { failOn: "error" })
    .rotate()
    .resize({ width: LONG_EDGE, height: LONG_EDGE, fit: "inside", withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });
  const { width, height } = upright.info;

  // 9% of the short edge, never so small it turns to mush on a phone-sized original.
  const size = Math.max(56, Math.round(Math.min(width, height) * 0.09));
  const margin = Math.round(size * 0.35);
  const emblem = await sharp(await readFile(LOGO), { density: 300 }).resize(size, size).png().toBuffer();
  // A thin white ring keeps the blue disc readable on a blue tablecloth or a dark counter.
  const ring = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size + 6}" height="${size + 6}"><circle cx="${size / 2 + 3}" cy="${size / 2 + 3}" r="${size / 2 + 2}" fill="white" fill-opacity="0.85"/></svg>`,
  );

  const rights = `© ${year} ${BRANDING.name}`;
  const encode = (quality) =>
    sharp(upright.data)
      .composite([
        { input: ring, left: width - size - margin - 3, top: height - size - margin - 3 },
        { input: emblem, left: width - size - margin, top: height - size - margin },
      ])
      .withExif({ IFD0: { Artist: BRANDING.name, Copyright: rights, ImageDescription: caption || BRANDING.credit } })
      .withXmp(xmpPacket({ siteUrl, caption, year }))
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

  for (const quality of [84, 76, 68]) {
    const out = await encode(quality);
    if (out.length <= MAX_BYTES) return out;
  }
  throw new Error("photo is still over the upload limit at the lowest quality");
}
