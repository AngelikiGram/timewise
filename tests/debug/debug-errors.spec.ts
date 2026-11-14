import { expect, test } from "@playwright/test";

test("debug errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  
  await page.goto("/explore");
  await page.waitForTimeout(1000);
  console.log("ERRORS:", errors.join("\n"));
  
  // Check if TimeMicroscope is in the DOM
  const tm = await page.locator('div[aria-label="Time Microscope"]').count();
  console.log("TimeMicroscope count:", tm);
  
  const slider = await page.locator('div[role="slider"][aria-label="Time Microscope year"]').count();
  console.log("Slider count:", slider);
});
