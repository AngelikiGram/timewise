import { expect, test } from "@playwright/test";

test("debug keyboard 5", async ({ page }) => {
  const logs: string[] = [];
  page.on("console", (msg) => logs.push(`${msg.type()}: ${msg.text()}`));
  
  await page.goto("/explore");
  await page.waitForTimeout(500);
  await page.evaluate(() => console.log('TEST FROM EVALUATE'));
  await page.waitForTimeout(100);
  console.log("LOGS:", logs.join("\n"));
});
