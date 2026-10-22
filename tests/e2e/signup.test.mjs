import { test, after } from "node:test";
import assert from "node:assert/strict";
import { BASE, closeBrowser, serverIsUp, visit } from "./harness.mjs";

const up = await serverIsUp();
const skip = up ? false : `no site at ${BASE}`;
after(closeBrowser);

test("/staff/signup rejects a visitor without the shared link", { skip }, async () => {
  await visit("/staff/signup", {
    body: async ({ page }) => {
      await page.getByText(/could not be found|nicht gefunden/i).first().waitFor();
      assert.equal(await page.getByRole("button", { name: "Crear acceso" }).count(), 0);
    },
  });
});

test("the shared signup link shows a name and password form", { skip: skip || !process.env.STAFF_SIGNUP_TOKEN }, async () => {
  await visit(`/staff/signup?key=${encodeURIComponent(process.env.STAFF_SIGNUP_TOKEN)}`, {
    body: async ({ page, response }) => {
      assert.equal(response.status(), 200);
      assert.equal(await page.locator(".staff").getAttribute("lang"), "es-AR");
      await page.getByLabel("Nombre de usuario").waitFor();
      await page.getByLabel("Contraseña").waitFor();
      await page.getByRole("button", { name: "Crear acceso" }).waitFor();
    },
  });
});
