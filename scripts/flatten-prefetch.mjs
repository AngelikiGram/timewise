// After `next build` with output: "export". The export writes link-prefetch data as nested files
// (atlas/__next.atlas/__PAGE__.txt), but the browser asks for the dotted name
// (atlas/__next.atlas.__PAGE__.txt). A plain static host such as GitHub Pages answers that with a 404,
// so every prefetch falls back to a full page load. This adds a copy under the requested name.
//
//   node scripts/flatten-prefetch.mjs apps/web/out
import { copyFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] ?? "apps/web/out";
let copied = 0;

/** Copies dir/__next.a/b/c.txt to dir/__next.a.b.c.txt, at any depth. */
function flatten(dir, prefix, target) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) flatten(path, `${prefix}.${name}`, target);
    else {
      copyFileSync(path, join(target, `${prefix}.${name}`));
      copied++;
    }
  }
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (!statSync(path).isDirectory()) continue;
    if (name.startsWith("__next.")) flatten(path, name, dir);
    else walk(path);
  }
}

walk(root);
console.log(`prefetch files copied to their requested names: ${copied}`);
