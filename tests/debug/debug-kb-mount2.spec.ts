import { expect, test } from "@playwright/test";

test("debug kb mount 2", async ({ page }) => {
  await page.goto("/explore");
  await page.waitForTimeout(2000);
  // Check the status line text
  const status = await page.locator('div[role="status"]').last().textContent();
  console.log("Status:", status);
  
  // Try to find the kb-mounted element
  const kbEl = await page.locator('[data-testid="kb-mounted"]').count();
  console.log("KB element count:", kbEl);
  
  if (kbEl > 0) {
    const text = await page.locator('[data-testid="kb-mounted"]').textContent();
    console.log("KB text:", text);
  }
});
