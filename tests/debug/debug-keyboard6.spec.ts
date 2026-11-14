import { expect, test } from "@playwright/test";

test("debug keyboard 6", async ({ page }) => {
  const logs: string[] = [];
  page.on("console", (msg) => logs.push(`${msg.type()}: ${msg.text()}`));
  
  await page.goto("/explore");
  await expect(page.getByTestId("timeline-year")).toHaveText("1844");
  
  // Add a keydown listener to the slider
  await page.evaluate(() => {
    const slider = document.querySelector('div[role="slider"][aria-label="Time Microscope year"]');
    if (slider) {
      slider.addEventListener('keydown', (e) => {
        console.log('[SLIDER KEYDOWN]', e.key);
      });
    }
  });
  
  await page.getByRole("slider").focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(100);
  await page.keyboard.press("End");
  await page.waitForTimeout(100);
  await page.keyboard.press("Home");
  await page.waitForTimeout(100);
  
  console.log("LOGS:", logs.join("\n"));
  const year = await page.getByTestId("timeline-year").textContent();
  console.log("Final year:", year);
});
