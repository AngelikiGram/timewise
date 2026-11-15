// Debug helper: screenshots of the redesigned pages on desktop and phone. Not part of the test suite.
//   node tests/debug/redesign-shots.mjs <out-dir> [base-url]
import { chromium } from "@playwright/test";
const [out, base = "http://127.0.0.1:3002/timewise"] = process.argv.slice(2);
const b = await chromium.launch();
const errors = [];
const shoot = async (page, name, path, wait = 2500, full = false) => {
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(base + path, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: full });
};
const d = await b.newPage({ viewport: { width: 1440, height: 900 } });
await shoot(d, "home", "/", 3000, true);
await shoot(d, "world", "/atlas", 7000);
await shoot(d, "world-event", "/atlas?event=Q362", 7000);
await shoot(d, "country-event", "/atlas/austria?event=Q178510", 7000);
await shoot(d, "challenges", "/challenges", 3000, true);
await shoot(d, "case", "/challenges/case/ringstrasse", 2000);
await shoot(d, "story", "/journeys/austria-1848-1921", 6000);
await shoot(d, "collection", "/collection", 1500, true);
await shoot(d, "plans", "/plans", 1500, true);
await shoot(d, "stories", "/stories", 2000, true);
const m = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await shoot(m, "m-home", "/", 3000);
await shoot(m, "m-world", "/atlas/europe", 7000);
await shoot(m, "m-event", "/atlas/europe?event=Q6534", 7000);
await shoot(m, "m-challenge", "/challenges/order-rails", 2000);
console.log(errors.length ? errors.join("\n") : "no page errors");
await b.close();
