import { expect, test } from "@playwright/test";

test("screenshot explore page", async ({ page }) => {
  await page.goto("/explore");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "explore-full.png", fullPage: true });

  // Check the timeline
  await page.locator('[data-testid="timeline-year"]').screenshot({ path: "timeline.png" });
  await page.locator('[data-testid="time-microscope"]').screenshot({ path: "time-microscope.png" });
  await page.locator('[data-testid="atlas-map"]').screenshot({ path: "atlas-map.png" });

  console.log("Screenshots saved");
});