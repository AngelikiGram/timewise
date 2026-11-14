import { expect, test } from "@playwright/test";

test("debug investigation", async ({ page }) => {
  const logs: string[] = [];
  page.on("console", (msg) => logs.push(`${msg.type()}: ${msg.text()}`));

  await page.goto("/explore");
  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    // @ts-ignore
    const collection = window.__TIMEWISE_COLLECTION__;
    console.log('COLLECTION:', collection);
  });

  console.log("LOGS:", logs.join("\n"));
});