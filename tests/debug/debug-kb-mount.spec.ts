import { expect, test } from "@playwright/test";

test("debug kb mount", async ({ page }) => {
  await page.goto("/explore");
  await page.waitForTimeout(1000);
  const kbMounted = await page.getByTestId("kb-mounted").textContent();
  console.log("KB Mounted:", kbMounted);
});
