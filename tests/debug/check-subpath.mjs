// Debug helper: opens the main pages of a static build served under a sub-path (as on GitHub Pages)
// and reports missing files, failed requests and page errors. Usage: node tests/debug/check-subpath.mjs <base> <shots dir>
import { chromium } from "@playwright/test";
const [base, out] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
const problems = [];
p.on("response", (r) => { const u = r.url(); if (r.status() >= 400 && u.startsWith(base.split("/timewise")[0])) problems.push(`${r.status()} ${u}`); });
p.on("pageerror", (e) => problems.push(`error: ${e.message}`));
for (const [path, name] of [["/", "home"], ["/history/europe", "europe"], ["/atlas", "atlas"], ["/atlas/austria?event=Q178510", "event"], ["/explore", "explore"], ["/learn", "learn"], ["/admin", "admin"], ["/journeys/austria-1848-1921", "journey"]]) {
  await p.goto(base + path, { waitUntil: "networkidle" }).catch((e) => problems.push(`nav ${path}: ${e.message}`));
  await p.waitForTimeout(name === "event" || name === "atlas" ? 5000 : 1500);
  await p.screenshot({ path: `${out}/live-${name}.png` });
  console.log(path, "->", (await p.title()));
}
// Client-side navigation: a header link must keep the sub-path.
await p.goto(base + "/");
await p.getByRole("link", { name: "History", exact: true }).first().click();
await p.waitForLoadState("networkidle");
console.log("header link ->", p.url());
console.log(problems.length ? problems.join("\n") : "no failed requests or page errors");
await b.close();
