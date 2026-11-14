// Debug helper: screenshots of a running build (default port 3001) for visual checks. Not part of the test suite.
import { chromium } from "@playwright/test";
const [out, base = "http://localhost:3001"] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.goto(base + "/atlas/austria?event=Q178510", { waitUntil: "networkidle" }).catch(() => {});
await p.waitForTimeout(6000);
await p.screenshot({ path: `${out}/event.png` });
await p.locator('[data-testid="atlas-detail"]').evaluate((el) => el.scrollBy(0, 700));
await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/event-2.png` });
const m = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
await m.goto(base + "/history/asia", { waitUntil: "networkidle" });
await m.screenshot({ path: `${out}/mobile-asia.png` });
await m.goto(base + "/atlas/europe", { waitUntil: "networkidle" });
await m.waitForTimeout(5000);
await m.screenshot({ path: `${out}/mobile-europe.png` });
await b.close();
