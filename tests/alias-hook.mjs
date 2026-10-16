/**
 * Lets `node --test` load the app's own modules.
 *
 * Two things stand between Node and `src/lib/*.ts`: the `@/` alias, which only Next and tsc know
 * about, and the extensionless imports that go with it. Node 23+ strips the types by itself, so a
 * resolver hook is the whole of what is missing — no bundler, no transpile step, no extra
 * dependency. `server-only` is mapped to nothing so a module that imports it can still be loaded
 * here; nothing under tests/unit calls into Next itself.
 *
 * Registered with `node --import ./tests/alias-hook.mjs`.
 */
import { registerHooks } from "node:module";
import { statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = new URL("../src/", import.meta.url);
const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

const isFile = (url) => {
  try {
    return statSync(fileURLToPath(url)).isFile();
  } catch {
    return false;
  }
};

/** `@/lib/dates` -> the first of `dates.ts`, `dates.tsx`, `dates/index.ts` … that is a file.
 *  A directory must not win: `@/lib/dictionaries` is one, and Node cannot import a directory. */
function resolveAlias(specifier) {
  const base = new URL(specifier.slice(2), SRC);
  for (const ext of EXTENSIONS) {
    const candidate = new URL(base.href + ext);
    if (isFile(candidate)) return candidate.href;
  }
  throw new Error(`alias-hook: nothing on disk for "${specifier}"`);
}

const EMPTY = pathToFileURL(fileURLToPath(new URL("./empty-module.mjs", import.meta.url))).href;
const NEXT_CACHE = pathToFileURL(fileURLToPath(new URL("./next-cache-stub.mjs", import.meta.url))).href;

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return next(EMPTY, context);
    // `cacheLife`/`cacheTag` annotate a "use cache" function and return nothing, so no-ops let the
    // body of a cached data function be tested without a Next render around it. See
    // tests/next-cache-stub.mjs for why updateTag is recorded rather than dropped.
    if (specifier === "next/cache") return next(NEXT_CACHE, context);
    if (specifier.startsWith("@/")) return next(resolveAlias(specifier), context);
    return next(specifier, context);
  },
});
