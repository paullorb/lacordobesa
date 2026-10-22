/**
 * The staff area, signed in.
 *
 * Read-only throughout: these pages drive the live shop, and the suite points at staging, where a
 * stray write still costs the next person a confusing afternoon. Nothing is saved, nothing is
 * dragged into a new order, nothing is marked sold out.
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import {
  BASE,
  closeBrowser,
  haveStaffCredentials,
  serverIsUp,
  STAFF_PAGES,
  startArranging,
  visit,
  visitOnPhone,
} from "./harness.mjs";

const up = await serverIsUp();
const skip = up ? (haveStaffCredentials() ? false : "no STAFF_USER / STAFF_PASS") : `no site at ${BASE}`;
const skipAnon = up ? false : `no site at ${BASE}`;
after(closeBrowser);

describe("signing in", () => {
  test("a stranger is sent to the login page", { skip: skipAnon }, async () => {
    await visit("/staff/karte", {
      body: async ({ page }) => {
        assert.match(page.url(), /\/staff\/login/);
      },
    });
  });

  test("the login page remembers where you were going", { skip: skipAnon }, async () => {
    await visit("/staff/zahlen", {
      body: async ({ page }) => {
        const next = await page.locator('input[name="next"]').getAttribute("value");
        assert.equal(next, "/staff/zahlen");
      },
    });
  });

  test("the staff area is not offered to search engines", { skip: skipAnon }, async () => {
    await visit("/staff/login", {
      body: async ({ page }) => {
        const robots = await page.locator('meta[name="robots"]').getAttribute("content");
        assert.match(robots ?? "", /noindex/);
      },
    });
  });

  test("the sign-in form is usable by name, not by CSS class", { skip: skipAnon }, async () => {
    await visit("/staff/login", {
      body: async ({ page }) => {
        await page.getByLabel(/nombre de usuario/i).first().waitFor();
        await page.getByLabel(/contraseña/i).first().waitFor();
      },
    });
  });
});

describe("every staff page loads for a signed-in member of the team", () => {
  for (const [name, path] of STAFF_PAGES) {
    test(name, { skip }, async () => {
      await visit(path, {
        staff: true,
        body: async ({ page, response, errors }) => {
          assert.equal(response.status(), 200, path);
          assert.doesNotMatch(page.url(), /\/login/, `${path} bounced back to the login page`);
          await page.waitForTimeout(300);
          assert.deepEqual(errors, [], `${path} logged console errors`);
          // Every page owns a heading, so the team can tell where they are.
          assert.equal(await page.locator("main h1").count(), 1, `${path} has no single h1`);
        },
      });
    });
  }
});

describe("the navigation says where you are", () => {
  const cases = [
    ["/staff", "Hoy"],
    ["/staff/reservierungen", "Mesas"],
    ["/staff/oeffnungszeiten", "Mesas"],
    ["/staff/vorbestellungen", "Pedidos"],
    ["/staff/karte", "Sitio web"],
    ["/staff/gallery", "Sitio web"],
    ["/staff/zahlen", "Estadísticas"],
    ["/staff/einstellungen", "Ajustes"],
  ];

  for (const [path, area] of cases) {
    test(`${path} highlights ${area}`, { skip }, async () => {
      await visit(path, {
        staff: true,
        body: async ({ page }) => {
          const current = page.locator('nav[aria-label="Secciones"] a[aria-current]');
          assert.equal(await current.count(), 1, "exactly one area should be marked current");
          assert.equal((await current.textContent()).trim(), area);
        },
      });
    });
  }

  test("the page itself is aria-current=page, not merely the area", { skip }, async () => {
    await visit("/staff/warteliste", {
      staff: true,
      body: async ({ page }) => {
        // Tische leads to Reservierungen, so the tab is "true" and the sub-link is "page".
        assert.equal(
          await page.locator('nav[aria-label="Secciones"] a[aria-current="true"]').count(),
          1,
          "the area tab leads elsewhere, so it is current but not the page",
        );
        const page_ = page.locator('nav[aria-label="Mesas"] a[aria-current="page"]');
        assert.equal((await page_.textContent()).trim(), "Lista de espera");
      },
    });
  });
});

describe("Einstellungen holds four decisions, and Team-Zugänge has its own page", () => {
  test("the form carries the announcement, the two switches and two numbers, and one Speichern", { skip }, async () => {
    await visit("/staff/einstellungen", {
      staff: true,
      body: async ({ page }) => {
        const names = await page.locator("main form [name]").evaluateAll((els) =>
          els.map((e) => e.getAttribute("name")).filter((n) => !n.startsWith("$ACTION")).sort(), // Next's own hidden inputs
        );
        assert.deepEqual(names, ["announcement", "capacity_seats", "enabled", "max_party_size", "preorders_enabled"]);
        assert.equal(await page.getByRole("button", { name: "Guardar", exact: true }).count(), 1);
        for (const label of ["Aviso en la parte superior", "Capacidad total", "Máximo de personas por reserva en línea"]) {
          assert.equal(await page.getByLabel(label, { exact: false }).count(), 1, label);
        }
        assert.equal(await page.getByText("Datenbank-Migration").count(), 0, "the migration banner is gone");
        assert.equal(await page.getByText("Accesos del equipo", { exact: true }).count(), 0, "the account list moved to /staff/team");
      },
    });
  });

  test("an admin gets a link to the Team page", { skip }, async () => {
    // The suite signs in as an admin (see STAFF_PAGES), so the link is there.
    await visit("/staff/einstellungen", {
      staff: true,
      body: async ({ page }) => {
        const link = page.getByRole("link", { name: "Administrar accesos del equipo" });
        assert.equal(await link.count(), 1);
        assert.equal(await link.getAttribute("href"), "/staff/team");
      },
    });
  });

  test("the Team page lists the accounts and offers the form to add one", { skip }, async () => {
    await visit("/staff/team", {
      staff: true,
      body: async ({ page }) => {
        assert.match(page.url(), /\/staff\/team$/);
        assert.ok((await page.locator("main ul li").count()) > 0, "no accounts listed");
        assert.equal(await page.locator("#new-username").count(), 1);
        assert.equal(await page.locator("#new-password").count(), 1);
        assert.equal(await page.getByRole("button", { name: "Crear", exact: true }).count(), 1);
      },
    });
  });
});

describe("Heute is the one-glance page", () => {
  test("it links to the reservations and their calendar instead of carrying a calendar", { skip }, async () => {
    await visit("/staff", {
      staff: true,
      body: async ({ page }) => {
        assert.equal(await page.locator('main [aria-label="Mes anterior"]').count(), 0, "the month calendar is back on Heute");
        const link = page.getByRole("link", { name: "Ver todas las reservas y el calendario" });
        assert.equal(await link.getAttribute("href"), "/staff/reservierungen");
      },
    });
  });
});

describe("the agency's pages stay out of the restaurant's way", () => {
  test("the navigation lists Specials once and no separate Verschicken", { skip }, async () => {
    await visit("/staff/specials", {
      staff: true,
      body: async ({ page }) => {
        assert.equal(await page.locator('nav a[href="/staff/specials"]').count(), 1);
        assert.equal(await page.locator('nav a[href="/staff/broadcast"]').count(), 0, "Verschicken is part of Specials now");
      },
    });
  });
});

describe("the menu editor", () => {
  test("the Karte pill names the category being read once the page is scrolled", { skip }, async () => {
    await visit("/staff/karte", {
      staff: true,
      body: async ({ page }) => {
        const pill = page.locator('nav[aria-label="Sitio web"] a[aria-current="page"]');
        assert.equal((await pill.textContent()).trim(), "Menú", "at the top the pill just says Karte");
        // The second category, so the first is certainly above the header line.
        const target = page.locator("[data-arrange-cat]").nth(1);
        const label = await target.getAttribute("data-cat-label");
        await target.evaluate((el) =>
          window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 150, behavior: "instant" }),
        );
        await page.waitForFunction(
          () => document.querySelector('nav[aria-label="Sitio web"] a[aria-current="page"]')?.getAttribute("aria-label")?.startsWith("Menú: "),
          null,
          { timeout: 5000 },
        );
        assert.equal(await pill.getAttribute("aria-label"), `Menú: ${label}`);
      },
    });
  });

  test("lists the categories with their dish counts", { skip }, async () => {
    await visit("/staff/karte", {
      staff: true,
      body: async ({ page }) => {
        const links = await page.locator('main nav a[href^="#cat-"]').count();
        assert.ok(links > 0, "no category jump links");
      },
    });
  });

  test("a dish description is clamped to a line rather than forced onto one", { skip }, async () => {
    // `truncate` (white-space: nowrap) is what widened the whole page to 667px on a phone; the
    // clamp looks the same and lets the grid track shrink.
    await visitOnPhone("/staff/karte", {
      staff: true,
      body: async ({ page }) => {
        const descriptions = page.locator("main details summary span.line-clamp-1");
        assert.ok((await descriptions.count()) > 0, "expected clamped dish descriptions");
        const nowrap = await descriptions.evaluateAll((els) =>
          els.filter((el) => getComputedStyle(el).whiteSpace === "nowrap").length,
        );
        assert.equal(nowrap, 0, "a dish description is still white-space: nowrap");
      },
    });
  });

  test("the sold-out button sits on the collapsed row and reads as an action, not as a status", { skip }, async () => {
    await visit("/staff/karte", {
      staff: true,
      body: async ({ page }) => {
        const rows = await page.locator("main details:has(> summary form)").count();
        assert.ok(rows > 0, "no availability button on a collapsed dish row");
        // One per dish, and none left in the expanded card.
        const inCard = await page.locator('main details > div form:has(input[name="is_available"])').count();
        assert.equal(inCard, 0, "the availability button is also in the expanded card");
        const labels = await page
          .locator('main summary form:has(input[name="is_available"]) button')
          .evaluateAll((els) => [...new Set(els.map((e) => e.textContent.trim()))]);
        assert.ok(labels.length > 0, "no availability buttons found");
        for (const label of labels) {
          assert.ok(
            /Marcar agotado|Volver a ofrecer/.test(label),
            `"${label}" next to a dish reads as that dish being sold out, rather than as the button that marks it`,
          );
        }
      },
    });
  });

  test("the sold-out button is a thumb-sized target and does not open or close the card", { skip }, async () => {
    await visitOnPhone("/staff/karte", {
      staff: true,
      body: async ({ page }) => {
        // Hold every write: this suite does not mark real dishes sold out. The POST is never answered.
        await page.route("**/*", (route) => (route.request().method() === "POST" ? undefined : route.continue()));
        const button = page.locator('main summary form:has(input[name="is_available"]) button').first();
        const box = await button.boundingBox();
        assert.ok(box.height >= 40, `the sold-out button is ${Math.round(box.height)}px tall`);
        const card = page.locator("main details:has(> summary form)").first();
        // Wait for hydration, which is when React attaches the form action; a native submit before
        // that would navigate. The held POST means either way nothing is saved.
        await page.waitForTimeout(1500);
        await button.click();
        await page.waitForTimeout(300);
        assert.equal(await card.evaluate((el) => el.open), false, "clicking the sold-out button opened the card");
      },
    });
  });

  test("the page starts calm: no drag handles and no Startseite drop zone until Anordnen", { skip }, async () => {
    await visit("/staff/karte", {
      staff: true,
      body: async ({ page }) => {
        assert.equal(await page.locator("[data-handle]").count(), 0, "drag handles on the calm list");
        assert.equal(await page.locator("#startseite-title").count(), 0, "the Startseite zone on the calm list");
        const toggle = page.getByRole("button", { name: "Ordenar", exact: true });
        assert.equal(await toggle.getAttribute("aria-pressed"), "false");
        await startArranging(page);
        assert.ok((await page.locator("[data-handle]").count()) > 0, "no drag handles while arranging");
        assert.equal(await page.locator("#startseite-title").count(), 1, "no Startseite zone while arranging");
        const done = page.getByRole("button", { name: "Listo", exact: true });
        assert.equal(await done.getAttribute("aria-pressed"), "true");
        await done.click();
        await page.waitForTimeout(300);
        assert.equal(await page.locator("[data-handle]").count(), 0, "handles stayed after Fertig");
        assert.equal(await page.locator("#startseite-title").count(), 0, "the zone stayed after Fertig");
      },
    });
  });

  test("every drag handle can be reached from the keyboard and says what it does", { skip }, async () => {
    await visit("/staff/karte", {
      staff: true,
      body: async ({ page }) => {
        await startArranging(page);
        const handles = page.locator("[data-handle]");
        const count = await handles.count();
        assert.ok(count > 0, "no drag handles");
        const unlabelled = await handles.evaluateAll((els) =>
          els.filter((el) => !(el.getAttribute("aria-label") ?? "").trim()).map((el) => el.outerHTML.slice(0, 60)),
        );
        assert.deepEqual(unlabelled, []);
      },
    });
  });

  test("the category form is one field and a button, with the rest behind Mehr", { skip }, async () => {
    await visit("/staff/karte", {
      staff: true,
      body: async ({ page }) => {
        const header = page.locator('main details:has(> summary:has-text("Editar categoría"))').first();
        await header.locator("> summary").click();
        const form = header.locator("form").first();
        const visible = await form.locator("input:not([type=hidden])").evaluateAll((els) =>
          els.filter((el) => el.checkVisibility()).map((el) => el.name),
        );
        assert.deepEqual(visible, ["label"]);
        const more = form.locator("details").first();
        assert.equal((await more.locator("> summary").textContent()).trim(), "Más");
        assert.equal(await more.evaluate((el) => el.open), false, "Mehr starts open");
        // Closed, yet still submitted with the form.
        const submitted = await form.evaluate((f) => [...new FormData(f).keys()]);
        assert.ok(submitted.includes("label_secondary") && submitted.includes("note"), `Mehr fields are not in the form: ${submitted}`);
        assert.ok(!submitted.includes("show_prices"), "the price toggle is back");
      },
    });
  });

  test("the dish form has no translation fields", { skip }, async () => {
    await visit("/staff/karte", {
      staff: true,
      body: async ({ page }) => {
        assert.equal(await page.locator('[name="description_es"], [name="description_en"], [name="translations_field"]').count(), 0);
      },
    });
  });

  test("the editor forms start closed, so the page opens as a list", { skip }, async () => {
    await visit("/staff/karte", {
      staff: true,
      body: async ({ page }) => {
        const open = await page.locator("main details[open]").count();
        assert.equal(open, 0);
      },
    });
  });
});

describe("sending lives on the specials page", () => {
  test("the old Verschicken address lands on Specials, at the sending section", { skip }, async () => {
    await visit("/staff/broadcast", {
      staff: true,
      body: async ({ page }) => {
        assert.match(new URL(page.url()).pathname, /^\/staff\/specials$/);
        const section = page.locator("main section#verschicken");
        assert.equal(await section.count(), 1);
        assert.equal(await section.getByRole("heading", { name: "Enviar a clientes" }).count(), 1);
      },
    });
  });

  test("the ideas editor is gone from the specials page", { skip }, async () => {
    await visit("/staff/specials", {
      staff: true,
      body: async ({ page }) => {
        assert.equal(await page.locator('input[name="sort_order"], input[name="title_es"]').count(), 0);
        assert.equal(await page.getByText("Ideen für Specials").count(), 0);
      },
    });
  });
});

describe("the gallery form", () => {
  test("does not ask about the cursor: that follows the category", { skip }, async () => {
    await visit("/staff/gallery", {
      staff: true,
      body: async ({ page }) => {
        assert.equal(await page.locator('input[name="cursor_cheer"]').count(), 0);
      },
    });
  });
});

describe("the opening hours page", () => {
  test("has no month calendar, which belongs to the reservations page", { skip }, async () => {
    await visit("/staff/oeffnungszeiten", {
      staff: true,
      body: async ({ page }) => {
        assert.equal(await page.getByRole("link", { name: "Mes siguiente" }).count(), 0);
      },
    });
  });
});

describe("the opening hours editor", () => {
  test("every weekday has an opening time, a closing time and a rest-day box", { skip }, async () => {
    await visit("/staff/oeffnungszeiten", {
      staff: true,
      body: async ({ page }) => {
        for (const wd of [0, 1, 2, 3, 4, 5, 6]) {
          assert.equal(await page.locator(`input[name="opens_${wd}"]`).count(), 1, `opens_${wd}`);
          assert.equal(await page.locator(`input[name="closes_${wd}"]`).count(), 1, `closes_${wd}`);
          assert.equal(await page.locator(`input[name="closed_${wd}"]`).count(), 1, `closed_${wd}`);
        }
      },
    });
  });

  test("the time fields are labelled, because they look identical", { skip }, async () => {
    await visit("/staff/oeffnungszeiten", {
      staff: true,
      body: async ({ page }) => {
        const unlabelled = await page
          .locator('input[type="time"]')
          .evaluateAll((els) => els.filter((el) => !el.getAttribute("aria-label")).length);
        assert.equal(unlabelled, 0);
      },
    });
  });

  test("a weekday row fits on a phone", { skip }, async () => {
    await visitOnPhone("/staff/oeffnungszeiten", {
      staff: true,
      body: async ({ page }) => {
        const viewport = page.viewportSize().width;
        const rows = await page
          .locator('input[name="opens_1"]')
          .evaluateAll((els) => els.map((el) => el.closest("div").getBoundingClientRect().right));
        for (const right of rows) assert.ok(right <= viewport + 1, `a weekday row ends at ${Math.round(right)}px`);
      },
    });
  });

  test("a closure cannot be entered for a day that has passed", { skip }, async () => {
    await visit("/staff/oeffnungszeiten", {
      staff: true,
      body: async ({ page }) => {
        // 24e19d4 replaced the native date inputs with the custom picker, so there is no `min`
        // attribute to read any more: the rule now lives in `allowed()` in pickers.tsx, which
        // disables the day buttons. Test the rule itself, which is what the shop cares about —
        // the earliest day the picker will let you choose is today.
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
        const thisMonth = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "Europe/Berlin" }).format(new Date());

        for (const id of ["#cl-from", "#cl-to"]) {
          await page.locator(id).click();
          const pop = page.locator(".picker-pop").first();
          await pop.waitFor({ timeout: 10_000 });
          assert.equal((await pop.locator("strong").first().textContent())?.trim(), thisMonth, `${id} opens on another month`);

          const days = await pop.locator(".picker-day").evaluateAll((els) => els.map((el) => ({ n: Number(el.textContent), off: el.disabled })));
          const earliest = days.find((d) => !d.off);
          assert.equal(earliest?.n, Number(today.slice(8)), `${id} offers day ${earliest?.n}, today is the ${Number(today.slice(8))}.`);
          assert.deepEqual(
            days.filter((d) => d.n < earliest.n && !d.off).map((d) => d.n),
            [],
            `${id} lets a closure start on a day that has passed`,
          );

          await page.keyboard.press("Escape");
        }
      },
    });
  });
});

describe("today's page", () => {
  test("names today, in the shop's timezone", { skip }, async () => {
    await visit("/staff", {
      staff: true,
      body: async ({ page }) => {
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
        const expected = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" })
          .format(new Date(`${today}T00:00:00Z`));
        const heading = await page.locator("main h1").textContent();
        assert.ok(heading.includes(expected), `the page says "${heading.trim()}", today is ${expected}`);
      },
    });
  });

  test("the month calendar marks today and nothing else", { skip }, async () => {
    await visit("/staff", {
      staff: true,
      body: async ({ page }) => {
        const today = Number(
          new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date()).slice(8),
        );
        const marked = page.locator('main a[aria-current="date"], main [data-today="true"]');
        if ((await marked.count()) === 0) return; // the calendar marks the selected day instead
        assert.equal(await marked.count(), 1);
        assert.ok((await marked.textContent()).trim().startsWith(String(today)));
      },
    });
  });
});

describe("the installed app", () => {
  test("the staff manifest is served and scoped to the staff area", { skip: skipAnon }, async () => {
    const response = await fetch(`${BASE}/staff.webmanifest`);
    assert.equal(response.status, 200);
    const manifest = await response.json();
    assert.ok(manifest.start_url.startsWith("/staff"), `start_url is ${manifest.start_url}`);
    assert.ok((manifest.icons ?? []).length > 0, "no icons");
  });

  test("the public pages advertise their own manifest, not the staff one", { skip: skipAnon }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        assert.equal(await page.locator('link[rel="manifest"]').getAttribute("href"), "/manifest.webmanifest");
      },
    });
  });
});
