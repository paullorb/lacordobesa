import { spawnSync } from "node:child_process";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const status = spawnSync("supabase", ["status", "--output", "env"], { encoding: "utf8" });
if (status.status !== 0) {
  process.stderr.write(status.stderr || "Start the local Supabase stack with `supabase start` first.\n");
  process.exit(status.status ?? 1);
}

const values = Object.fromEntries(
  status.stdout.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*(?:export\s+)?([A-Z_]+)=(?:"(.*)"|'(.*)'|(.*))\s*$/);
    return match ? [[match[1], match[2] ?? match[3] ?? match[4]]] : [];
  }),
);
const url = values.API_URL;
const publishable = values.ANON_KEY;
const secret = values.SERVICE_ROLE_KEY;
const dbUrl = values.DB_URL;
if (!url || !publishable || !secret || !dbUrl || !["127.0.0.1", "localhost"].includes(new URL(url).hostname)) {
  throw new Error("Local Supabase status did not return loopback API, keys, and database URL.");
}

const email = "paul@staff.lacordobesa.local";
const password = "local-test-password-only";
const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (createError && !/already.*registered|already exists/i.test(createError.message)) throw createError;
let userId = created.user?.id;
if (!userId) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  userId = data.users.find((user) => user.email?.toLowerCase() === email)?.id;
}
if (!userId) throw new Error("Could not find the local staff test user.");
const { error: passwordError } = await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
if (passwordError) throw passwordError;
const { error: staffError } = await admin.from("staff").upsert({ user_id: userId, role: "admin" });
if (staffError) throw staffError;

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishable,
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  SUPABASE_SECRET_KEY: secret,
  SUPABASE_DB_URL: dbUrl,
  STAFF_USER: "paul",
  STAFF_PASS: password,
};
const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("Pass a command after `--`.");
const child = spawn(command, args, { stdio: "inherit", env, shell: process.platform === "win32" });
child.on("exit", (code, signal) => process.exit(signal ? 1 : code ?? 1));
