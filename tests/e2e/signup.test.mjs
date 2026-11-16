import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { BASE, closeBrowser, serverIsUp, visit } from "./harness.mjs";
import { admin, skip as noDatabase } from "../integration/harness.mjs";

const up = await serverIsUp();
const skip = up ? false : `no site at ${BASE}`;
after(closeBrowser);

test("/staff/signup rejects a visitor without an invite", { skip }, async () => {
  await visit("/staff/signup", {
    body: async ({ page }) => {
      await page.getByText(/could not be found|nicht gefunden/i).first().waitFor();
      assert.equal(await page.getByRole("button", { name: "Crear acceso" }).count(), 0);
    },
  });
});

test("/staff/signup rejects a well-formed token that was never issued", { skip }, async () => {
  await visit(`/staff/signup?key=${randomBytes(32).toString("base64url")}`, {
    body: async ({ page }) => {
      await page.getByText(/could not be found|nicht gefunden/i).first().waitFor();
      assert.equal(await page.getByRole("button", { name: "Crear acceso" }).count(), 0);
    },
  });
});

test("a live invite shows a name and password form", { skip: skip || noDatabase }, async () => {
  const token = randomBytes(32).toString("base64url");
  const token_hash = createHash("sha256").update(token).digest("hex");
  const { error } = await admin()
    .from("staff_invites")
    .insert({ token_hash, expires_at: new Date(Date.now() + 3_600_000).toISOString() });
  assert.equal(error, null, error?.message);
  try {
    await visit(`/staff/signup?key=${token}`, {
      body: async ({ page, response }) => {
        assert.equal(response.status(), 200);
        assert.equal(await page.locator(".staff").getAttribute("lang"), "es-AR");
        await page.getByLabel("Nombre de usuario").waitFor();
        await page.getByLabel("Contraseña").waitFor();
        await page.getByRole("button", { name: "Crear acceso" }).waitFor();
      },
    });
  } finally {
    await admin().from("staff_invites").delete().eq("token_hash", token_hash);
  }
});

test("an expired invite is refused like an unknown one", { skip: skip || noDatabase }, async () => {
  const token = randomBytes(32).toString("base64url");
  const token_hash = createHash("sha256").update(token).digest("hex");
  await admin().from("staff_invites").insert({ token_hash, expires_at: new Date(Date.now() - 1000).toISOString() });
  try {
    await visit(`/staff/signup?key=${token}`, {
      body: async ({ page }) => {
        await page.getByText(/could not be found|nicht gefunden/i).first().waitFor();
        assert.equal(await page.getByRole("button", { name: "Crear acceso" }).count(), 0);
      },
    });
  } finally {
    await admin().from("staff_invites").delete().eq("token_hash", token_hash);
  }
});
