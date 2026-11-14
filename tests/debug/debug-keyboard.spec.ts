import { expect, test } from "@playwright/test";

test("debug keyboard", async ({ page }) => {
  const logs: string[] = [];
  page.on("console", (msg) => logs.push(`${msg.type()}: ${msg.text()}`));
  
  await page.goto("/explore");
  await expect(page.getByTestId("timeline-year")).toHaveText("1844");
  await page.getByRole("slider").first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("timeline-year")).toHaveText("1848");
  await page.keyboard.press("End");
  await page.waitForTimeout(1000);
  console.log("LOGS:", logs.join("\n"));
  await expect(page.getByTestId("timeline-year")).toHaveText("1921");
});
