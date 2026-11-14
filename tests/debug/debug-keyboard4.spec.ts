import { expect, test } from "@playwright/test";

test("debug keyboard 4", async ({ page }) => {
  const logs: string[] = [];
  page.on("console", (msg) => logs.push(`${msg.type()}: ${msg.text()}`));
  
  await page.goto("/explore");
  await expect(page.getByTestId("timeline-year")).toHaveText("1844");
  
  // Focus the slider
  await page.getByRole("slider").focus();
  let focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  console.log("Focused after focus():", focused);
  
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(100);
  focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  console.log("Focused after ArrowRight:", focused);
  
  await page.keyboard.press("End");
  await page.waitForTimeout(100);
  focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  console.log("Focused after End:", focused);
  
  await page.waitForTimeout(1000);
  console.log("LOGS:", logs.join("\n"));
  const year = await page.getByTestId("timeline-year").textContent();
  console.log("Final year:", year);
});
