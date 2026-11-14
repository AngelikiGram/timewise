import { expect, test } from "@playwright/test";

test("debug timeline error", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", msg => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", err => errors.push(err.message));

  await page.goto("/explore");
  await page.waitForTimeout(3000);

  console.log("Console errors:", errors);
  
  // Check if timeline-year exists
  const hasTimelineYear = await page.locator('[data-testid="timeline-year"]').count();
  console.log("Timeline year count:", hasTimelineYear);
  
  // Check for timeline elements
  const hasTimeline = await page.locator('[aria-label="Timeline"]').count();
  console.log("Timeline aria count:", hasTimeline);
});
