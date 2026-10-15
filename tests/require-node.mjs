/**
 * Fails `npm run test:unit` (and so `npm run check`) with a readable reason on a Node that cannot
 * run it.
 *
 * Next, Playwright and oxlint all start at Node 20, but the unit tests are TypeScript files that
 * Node loads itself, and that needs two things Node 20 does not have: type stripping on by
 * default (22.18, 23.6) and `module.registerHooks` for tests/alias-hook.mjs (22.15, 23.5). Left
 * alone, the failure is an `registerHooks is not exported` SyntaxError that never mentions a
 * version. This file uses nothing newer than Node 18, so it can still say so.
 *
 * It is a guard on the test command rather than an `engines` entry on purpose: `engines.node` in
 * package.json also picks the Node version Vercel builds the site with.
 */
const [major, minor] = process.versions.node.split(".").map(Number);
const ok = major >= 24 || (major === 23 && minor >= 6) || (major === 22 && minor >= 18);

if (!ok) {
  console.error(
    `The unit tests need Node 22.18 or newer (this is ${process.versions.node}): they run TypeScript ` +
      "through Node's own type stripping and module.registerHooks.",
  );
  process.exit(1);
}
