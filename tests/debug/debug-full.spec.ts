import { expect, test } from "@playwright/test";

test("capture full page HTML", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox").fill("Ödenburg");
  await page.getByRole("option").first().click();

  await page.waitForURL(/event=sopron-1921/);
  await page.waitForTimeout(3000);

  // Get full page content
  const html = await page.content();
  console.log("=== FULL HTML ===");
  console.log(html.slice(0, 50000));
  
  // Check for timeline-year
  const hasTimelineYear = await page.locator('[data-testid="timeline-year"]').count();
  console.log("Timeline year count:", hasTimelineYear);
  
  // Check for Workspace
  const hasWorkspace = await page.locator('[role="tablist"]').count();
  console.log("Workspace tabs count:", hasWorkspace);
  
  // Check for TimeMicroscope
  const hasMicroscope = await page.locator('text="Time Microscope"').count();
  console.log("Time Microscope count:", hasMicroscope);
  
  // Check for timeline elements
  const hasTimeline = await page.locator('[aria-label="Timeline"]').count();
  console.log("Timeline aria count:", hasTimeline);
  
  // Check for output element
  const outputs = await page.locator('output').all();
  console.log("Output elements:", outputs.length);
  for (const o of outputs) {
    const tid = await o.getAttribute('data-testid');
    const text = await o.textContent();
    console.log(`  output data-testid="${tid}" text="${text}"`);
  }
});
