import { expect, test } from "@playwright/test";

test("debug timeline error from search", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", msg => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", err => errors.push(err.message));

  await page.goto("/");
  await page.getByRole("combobox").fill("Ödenburg");
  await page.getByRole("option").first().click();

  await page.waitForURL(/event=sopron-1921/);
  await page.waitForTimeout(3000);

  console.log("Console errors:", errors);
  
  // Check if timeline-year exists
  const hasTimelineYear = await page.locator('[data-testid="timeline-year"]').count();
  console.log("Timeline year count:", hasTimelineYear);
  
  // Check for timeline elements
  const hasTimeline = await page.locator('[aria-label="Timeline"]').count();
  console.log("Timeline aria count:", hasTimeline);
  
  // Get full body text
  const body = await page.textContent("body");
  console.log("Body text (first 2000):", body?.slice(0, 2000));
});
