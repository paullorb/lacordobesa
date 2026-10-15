# Photo drop folder

Stock photographs for the site, until there are real ones of the shop (#35).

**Put the downloaded files here, named exactly as the table below.** Nothing reads this folder at
build time: it is a staging area. Two of these files get copied into `public/assets/` and wired in
by hand; the rest are uploaded through `/staff/gallery`, which is the only way gallery content ever
enters the database (see `CLAUDE.md`, "Content lives behind the staff UI").

**Status (2026-10-15):** nine sample photographs from Unsplash are in this folder and live in the
gallery (staging and production), see `CREDITS.md`. They are named after their subject, not after the
twelve slots below, and they are all food: the room, the counter, the table and the hands (#6 to #12
in the list) are still to be shot. Unsplash needs no attribution, so `CREDITS.md` keeps no per-file
source rows. `upload-gallery.mjs` re-runs the upload against any site and skips what already exists.

---

## What the layout actually demands

Four slots render photography. Their shapes are not negotiable, and two of them put text on top of
the image, so composition matters more than subject.

### 1. Hero, landing page

`public/assets/hero-pasteleria.jpg`, rendered at up to **1392 x 640** behind the headline.

`.hero::before` lays a near-black gradient over it: **91% opaque at the left edge, 77% at a third
across, 18% at three quarters, 4% at the right.** The bottom-right corner carries the opening-status
pill and the logo (`.hero-note`). So the usable frame is a band on the **right, between roughly 60%
and 95% across and 15% to 75% down**. Anything to the left of centre is painted out.

The photo that is there now was composed for exactly this: pastries piled on the right, an empty
blue table running away to the left. A replacement that centres its subject will bury it under the
scrim and make the `h1` unreadable at the same time. Keep the composition or the hero breaks.

Under ~900px the wash goes flat (88% to 36%) and `object-position` shifts to `58% center`, so the
subject has to survive a centre-right crop too.

- **2800 x 1280** ideal, 2400 x 1100 the floor. Keep the file under ~600 KB.

### 2. Visit photo, landing page `#besuch`

Rendered **~554 x 620**, `object-fit: cover`, sticky beside the address card. Falls back to the hero
file when no gallery photo is marked *Hauptbild*.

A caption plate sits **bottom-left, about 300 x 56px, on opaque cream**. Nothing important there.

- Portrait, **4:5**, at least 1400 x 1750. Uploaded through `/staff/gallery` and marked *Hauptbild*.

### 3. Photo strip, landing page

Square tiles, ~212px rendered, four or five across. Fed by the gallery photos ticked *Auf der
Startseite zeigen*. **These disappear the moment an Instagram token is configured (#34)** and the
strip switches to the real feed, so treat them as a stopgap.

- Must crop to **1:1** without losing the subject.

### 4. `/gallery`

**4:3** tiles, opened in a lightbox that shows the whole frame (`object-fit: contain`) at full
viewport width. The staff uploader resizes to a max edge of 1800px, which is exactly what the
lightbox wants, so upload the largest version you have and let it shrink.

Three categories: `venue` (Lokal), `food` (Essen), `events`.

### Not photo slots, on purpose

`/karte` and `/catering` use the hand-drawn SVG icon set (`src/components/menu-icons/`), the story
block uses the logo on blue, and the craft block uses the empanada mark. **Do not add dish
photography to the menu.** The icons are the design, and photos of 60 menu items is a maintenance
burden nobody will carry.

---

## The list

Twelve files. Ordered by how much each one earns its place.

| # | Filename | Slot | Shape | What it has to show |
|---|---|---|---|---|
| 1 | `hero.jpg` | Hero, static | 2800x1280 | Empanadas and medialunas on a table, piled **right of centre**, light raking in, left third empty surface. Warm neutrals with one cool accent. Replaces the file in `public/assets/`. |
| 2 | `og.jpg` | Link previews, static | 1200x630 | Same subject, **centred**. Not a crop of #1: link previews get no scrim, so the hero's empty left half reads as a mistake on WhatsApp and Slack. |
| 3 | `empanadas-close.jpg` | strip + `/gallery` food | 1:1 and 4:3 | One empanada close enough that the crimped edge is legible. The repulgue is the site's whole visual signature; this is the photo that proves it. |
| 4 | `alfajores.jpg` | strip + `/gallery` food | 1:1 | An alfajor broken open, dulce de leche visible, coconut rim. |
| 5 | `medialunas-cafe.jpg` | strip + `/gallery` food | 1:1 | Medialunas with a cortado on a small table. Sells the *pasteleria* half of the name, which nothing on the site currently shows. |
| 6 | `parrilla.jpg` | `/gallery` food | 4:3 | Bife de chorizo or ribeye, sliced, on a board. **The site is 60% parrilla and 100% pastry in pictures.** This closes the biggest gap between the menu and the photography. |
| 7 | `mesa-dulce.jpg` | `/gallery` events | 4:3 | A laid table of sweets and cakes. `/catering` has no photography at all and this is what would sell it. |
| 8 | `room-wide.jpg` | *Hauptbild* + `/gallery` venue | 4:5 portrait | A small warm dining room, daylight, no recognisable faces. **Read the warning below before using this one.** |
| 9 | `counter.jpg` | `/gallery` venue | 4:3 | A pastry display case or counter, framed tight enough that it is not a particular room. The safe way to show "Lokal". |
| 10 | `hands-dough.jpg` | strip + `/gallery` food | 1:1 | Hands shaping or filling dough. The story copy is built on *hecho a mano*; this is the evidence. Hands only, no face. |
| 11 | `table-sharing.jpg` | `/gallery` events | 4:3 | Plates being passed across a shared table, hands and forearms only. |
| 12 | `tarta.jpg` | `/gallery` food | 4:3 | A slice of cake on a plate, for *Tarta del Dia*. |

### Look and feel

The site is bright: cream `#f5f1e9`, paper `#fffdf8`, a strong blue `#52a8d2`, coral `#e68061`.

- **Daylight, warm neutrals, a little blue.** Linen, pale wood, white ceramic, cobalt.
- **Avoid** the dark moody steakhouse grading, red checked tablecloths, heavy teal-and-orange
  colour grading, and anything that reads as a stock food blog hero with a sprig of herb placed on
  a slate tile.
- **Avoid recognisable faces.** Unsplash does not guarantee a model release, and the license
  explicitly leaves depicted people's rights to you. Hands and backs are fine.
- Prefer photos that could plausibly be the same room and the same light as each other. Twelve
  photos from twelve different kitchens look like twelve photos from twelve different kitchens.

---

## Before any of this goes live

Licensing is the easy half. Unsplash's license covers commercial use and asks for no attribution,
and Pexels and similar are comparable. That part is fine.

**Representation is the half that matters.** The site presents these as La Cordobesa: the visit
photo carries an Instagram caption with the shop's handle on it, and the seeded gallery captions say
things like *"Unser Lokal am Ginnheimer Waeldchen"*. A stock interior under that caption is a
factual claim about a specific address, and in Germany that is the kind of thing §5 UWG calls an
*irrefuehrende geschaeftliche Handlung*. The same goes for any photo of people presented as the
team or as guests.

So, concretely:

- **For the mockup and staging: use all twelve.** That is what they are for, and nobody is misled by
  a demo.
- **Before production:** food close-ups (#3, #4, #5, #6, #12) and the hands (#10) are generic enough
  to be honest, since the shop really does sell these things. **#8 `room-wide.jpg`, #11
  `table-sharing.jpg` and the Instagram caption on the visit photo are the ones to pull** unless the
  owner has shot the real room by then. #9 `counter.jpg` sits in between: safe if it is tight enough
  not to depict a place.
- Either way, the real shoot in #35 is still the answer. This buys time, it does not close that
  issue.

---

## Putting them in

Files 1 and 2 are static assets. Drop them here and say so; copying them into `public/assets/` and
pointing `root-document.tsx` at a separate OG image is a small code change.

Everything else goes in through the staff UI, at `/staff/gallery` → *Neues Bild*:

1. Pick the category from the table.
2. **Write a real German caption.** It becomes the `alt` text, so it is what a screen reader and
   Google get. Use commas or `·` rather than dashes, like the rest of the site's copy.
3. Tick *Auf der Startseite zeigen* on #3, #4, #5 and #10 for the strip.
4. Hit *Als Hauptbild* on #8 so it becomes the visit photo.
5. Delete the five seeded SVG illustrations (`lokal`, `empanadas`, `alfajores`, `merienda`, `feier`)
   once the real files are up. They are placeholders and the seed comment says they are deletable.
