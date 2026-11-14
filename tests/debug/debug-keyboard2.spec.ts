import { expect, test } from "@playwright/test";

test("debug keyboard 2", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByTestId("timeline-year")).toHaveText("1844");
  
  // Check which slider is focused
  const focused = await page.evaluate(() => document.activeElement?.outerHTML);
  console.log("Initially focused:", focused);
  
  await page.getByRole("slider").first().focus();
  const focused2 = await page.evaluate(() => document.activeElement?.outerHTML);
  console.log("After focus:", focused2);
  
  // Add a global keydown listener
  await page.evaluate(() => {
    window.addEventListener('keydown', (e) => {
      console.log('[GLOBAL] Key pressed:', e.key, 'target:', e.target.tagName, e.target.getAttribute?.('role'));
    }, true);
  });
  
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(100);
  await page.keyboard.press("End");
  await page.waitForTimeout(1000);
  
  const year = await page.getByTestId("timeline-year").textContent();
  console.log("Final year:", year);
});
