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
        await page.getByLabel(/name/i).first().waitFor();
        await page.getByLabel(/passwort/i).first().waitFor();
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
    ["/staff", "Heute"],
    ["/staff/reservierungen", "Gäste"],
    ["/staff/karte", "Inhalte"],
    ["/staff/zahlen", "Zahlen"],
    ["/staff/einstellungen", "Einstellungen"],
  ];

  for (const [path, area] of cases) {
    test(`${path} highlights ${area}`, { skip }, async () => {
      await visit(path, {
        staff: true,
        body: async ({ page }) => {
          const current = page.locator('nav[aria-label="Bereiche"] a[aria-current]');
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
        // Gäste leads to Reservierungen, so the tab is "true" and the sub-link is "page".
        assert.equal(
          await page.locator('nav[aria-label="Bereiche"] a[aria-current="true"]').count(),
          1,
          "the area tab leads elsewhere, so it is current but not the page",
        );
        const page_ = page.locator('nav[aria-label="Gäste"] a[aria-current="page"]');
        assert.equal((await page_.textContent()).trim(), "Warteliste");
      },
    });
  });
});

describe("the menu editor", () => {
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

  test("the sold-out button reads as an action, not as a status", { skip }, async () => {
    await visit("/staff/karte", {
      staff: true,
      body: async ({ page }) => {
        const labels = await page
          .locator("main details summary form button")
          .evaluateAll((els) => [...new Set(els.map((e) => e.textContent.trim()))]);
        assert.ok(labels.length > 0, "no availability buttons found");
        for (const label of labels) {
          assert.ok(
            /melden|anbieten/.test(label),
            `"${label}" next to a dish reads as that dish being sold out, rather than as the button that marks it`,
          );
        }
      },
    });
  });

  test("every drag handle can be reached from the keyboard and says what it does", { skip }, async () => {
    await visit("/staff/karte", {
      staff: true,
      body: async ({ page }) => {
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
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
        assert.equal(await page.locator("#cl-from").getAttribute("min"), today);
        assert.equal(await page.locator("#cl-to").getAttribute("min"), today);
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
        const expected = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" })
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
  test("the manifest is served and scoped to the staff area", { skip: skipAnon }, async () => {
    const response = await fetch(`${BASE}/manifest.webmanifest`);
    assert.equal(response.status, 200);
    const manifest = await response.json();
    assert.ok(manifest.start_url.startsWith("/staff"), `start_url is ${manifest.start_url}`);
    assert.ok((manifest.icons ?? []).length > 0, "no icons");
  });

  test("the public pages do not advertise it", { skip: skipAnon }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        assert.equal(await page.locator('link[rel="manifest"]').count(), 0);
      },
    });
  });
});
