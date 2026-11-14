import { expect, test } from "@playwright/test";

test("debug store", async ({ page }) => {
  const logs: string[] = [];
  page.on("console", (msg) => logs.push(`${msg.type()}: ${msg.text()}`));

  await page.goto("/explore");
  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    // @ts-ignore
    const store = window.useAtlas?.getState?.();
    console.log('STORE:', store);
  });

  console.log("LOGS:", logs.join("\n"));
});