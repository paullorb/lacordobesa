/**
 * Fails a CI job whose test suite reported success without running anything.
 *
 * `node --test` exits 0 when every test skips, and three of this project's suites skip by design:
 * the browser tests when no server is listening, and the database tests when there are no staging
 * credentials. That is the right behaviour on a laptop and the wrong signal in CI, where "all green"
 * then means "nothing was checked". It is also how the browser suite came to have twelve failing
 * tests nobody had seen for three commits.
 *
 * So the workflow asserts a floor instead of trusting the exit code. The floors are deliberately
 * round numbers well under the real counts: they are there to catch a suite that collapsed to zero
 * or to a handful, not to track the exact total, which would mean editing this on every new test.
 *
 *   node .github/assert-ran.mjs <log file> <minimum passing tests>
 */
import { readFileSync } from "node:fs";

const [file, floorText] = process.argv.slice(2);
const floor = Number(floorText);

if (!file || !Number.isFinite(floor)) {
  console.error("usage: node .github/assert-ran.mjs <log file> <minimum passing tests>");
  process.exit(2);
}

let log;
try {
  log = readFileSync(file, "utf8");
} catch (error) {
  console.error(`::error::${file} was not written, so the suite did not get as far as reporting.`);
  console.error(String(error));
  process.exit(1);
}

/** The last occurrence of a summary counter, because the runner prints one per file and then a total. */
function counter(name) {
  const matches = [...log.matchAll(new RegExp(`^\\s*(?:ℹ|#)\\s*${name}\\s+(\\d+)\\s*$`, "gm"))];
  return matches.length > 0 ? Number(matches.at(-1)[1]) : null;
}

const pass = counter("pass");
const fail = counter("fail");
const skipped = counter("skipped");

if (pass === null || fail === null) {
  console.error(`::error::no test summary found in ${file}. The runner did not finish.`);
  process.exit(1);
}

console.log(`${file}: ${pass} passed, ${fail} failed, ${skipped ?? 0} skipped (floor ${floor})`);

if (fail > 0) {
  // The test command's own exit code should already have failed the step; this is belt and braces
  // for a pipeline where `tee` swallowed it.
  console.error(`::error::${fail} tests failed.`);
  process.exit(1);
}

if (pass < floor) {
  console.error(
    `::error::only ${pass} tests passed, expected at least ${floor}. A suite that skips is reported ` +
      `as a pass by node --test, so this is treated as a failure rather than as a green build.`,
  );
  process.exit(1);
}
