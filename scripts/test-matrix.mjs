/**
 * Runs the browser suite once per browser and device (issue #104).
 *
 *   npm run dev                          # one terminal
 *   npm run test:matrix                  # every project that can run here
 *   npm run test:matrix -- iphone webkit # just those
 *   npm run test:matrix -- --list        # what the projects are
 *
 * Not part of `npm run check`: it opens eight browser configurations and takes several minutes.
 * `check` stays lint + typecheck + unit tests; this is what to run before a change that touches
 * layout, scripts that run in the browser, or anything with a date in it.
 *
 * Unlike `npm run test:e2e` it refuses to run without a server instead of skipping, because a
 * matrix that goes green by skipping everything proves nothing.
 *
 * Browsers are installed once per machine: `npx playwright install chromium firefox webkit`.
 * Microsoft Edge is never downloaded. It is a project only where it is already installed, and is
 * reported as unavailable everywhere else.
 */
import { spawn } from "node:child_process";
import { chromium, firefox, webkit } from "playwright";

const BASE = process.env.E2E_BASE ?? process.env.SHOTS_BASE ?? "http://localhost:3000";
const ENGINES = { chromium, firefox, webkit };

// Mirrors PROJECTS in tests/e2e/harness.mjs (that file is the source of truth for devices).
// `layout` projects also run the width-by-width layout and guest-flow files; the phones skip them
// because their viewport is their one width. `wide` adds the timezone and language tests, which
// are about the engine's Intl and clock and gain nothing from a different screen size.
const PROJECTS = [
  { name: "chromium", engine: "chromium", layout: true, wide: true },
  { name: "firefox", engine: "firefox", layout: true, wide: true },
  { name: "webkit", engine: "webkit", layout: true, wide: true },
  { name: "edge", engine: "chromium", channel: "msedge", layout: true, wide: true },
  { name: "iphone", engine: "webkit" },
  { name: "ipad", engine: "webkit" },
  { name: "pixel", engine: "chromium" },
  { name: "galaxy", engine: "chromium" },
];

const BASE_FILES = ["tests/e2e/matrix.test.mjs", "tests/e2e/pwa.test.mjs"];
const WIDE_FILES = ["tests/e2e/timezone.test.mjs"];
const LAYOUT_FILES = ["tests/e2e/layout.test.mjs", "tests/e2e/public.test.mjs"];

const args = process.argv.slice(2);
if (args.includes("--list")) {
  for (const p of PROJECTS) console.log(`${p.name.padEnd(9)} ${p.engine}${p.channel ? ` (${p.channel})` : ""}`);
  process.exit(0);
}
const wanted = args.filter((a) => !a.startsWith("-"));
const unknown = wanted.filter((w) => !PROJECTS.some((p) => p.name === w));
if (unknown.length) {
  console.error(`unknown project: ${unknown.join(", ")}. Try --list.`);
  process.exit(2);
}

try {
  const response = await fetch(BASE, { signal: AbortSignal.timeout(90_000) });
  if (!response.ok) throw new Error(`answered ${response.status}`);
} catch (error) {
  console.error(`no site at ${BASE} (${error.message}). Start \`npm run dev\` first, or set E2E_BASE.`);
  process.exit(2);
}

/** Whether the engine (or Edge) can actually start here. */
async function available({ engine, channel }) {
  try {
    const browser = await ENGINES[engine].launch(channel ? { channel } : {});
    await browser.close();
    return null;
  } catch {
    return channel
      ? `${channel} is not installed`
      : `${engine} is not installed (npx playwright install ${engine})`;
  }
}

const run = (project, files) =>
  new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ["--test", "--test-concurrency=2", "--test-reporter=spec", ...files],
      { env: { ...process.env, E2E_PROJECT: project.name, E2E_BASE: BASE }, stdio: ["ignore", "pipe", "pipe"] },
    );
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.on("close", (code) => resolve({ code, output }));
  });

const results = [];
for (const project of PROJECTS.filter((p) => wanted.length === 0 || wanted.includes(p.name))) {
  const why = await available(project);
  if (why) {
    console.log(`-  ${project.name.padEnd(9)} unavailable: ${why}`);
    results.push({ project, status: "unavailable", why });
    continue;
  }
  const files = [...BASE_FILES, ...(project.wide ? WIDE_FILES : []), ...(project.layout ? LAYOUT_FILES : [])];
  const started = Date.now();
  const { code, output } = await run(project, files);
  const seconds = Math.round((Date.now() - started) / 1000);
  const count = (label) => Number(output.match(new RegExp(`ℹ ${label} (\\d+)`))?.[1] ?? 0);
  const summary = `${count("pass")} passed, ${count("fail")} failed, ${count("skipped")} skipped in ${seconds}s`;
  console.log(`${code === 0 ? "ok" : "FAIL"} ${project.name.padEnd(9)} ${summary}`);
  if (code !== 0) console.log(output.split("\n").filter((l) => /✖|Error|expected|actual|AssertionError/.test(l)).slice(0, 40).join("\n"));
  results.push({ project, status: code === 0 ? "pass" : "fail" });
}

const failed = results.filter((r) => r.status === "fail");
const missing = results.filter((r) => r.status === "unavailable");
console.log(
  `\n${results.length - failed.length - missing.length} projects passed, ${failed.length} failed, ${missing.length} unavailable.` +
    (missing.length ? " Unavailable projects are not a pass: they were not tested." : ""),
);
// A matrix that ran nothing proves nothing, so it must not exit 0: no browsers installed, or the one
// project asked for by name cannot start here. Without names, a missing project (Edge, usually) is
// tolerated as long as something ran; with names, every named project was asked for and must have run.
const ran = results.length - missing.length;
const missingRequested = wanted.length > 0 && missing.length > 0;
if (ran === 0 || missingRequested) {
  console.error(ran === 0 ? "Nothing ran: no requested project could start here." : "A project you asked for could not start here.");
}
process.exit(failed.length || ran === 0 || missingRequested ? 1 : 0);
