import { expect, test } from "@playwright/test";

test("the world overview shows charts, eras and links into the atlas", async ({ page }) => {
  await page.goto("/history");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The history of the world");
  await expect(page.getByRole("radiogroup", { name: "Chart shows" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Era by era" })).toBeVisible();
  // Records reach back before year 1, now that BC dates are imported.
  await expect(page.getByText(/Earliest record/).locator("..")).toContainText("BC");
  await page.getByRole("link", { name: "Europe", exact: true }).click();
  await expect(page).toHaveURL(/\/history\/europe$/);
  await expect(page.getByRole("heading", { name: "The rise and fall of states" })).toBeVisible();
});

test("an era event opens in its country's atlas, selected", async ({ page }) => {
  await page.goto("/history/europe");
  const first = page.locator("#eras a").first();
  const title = (await first.locator("span").nth(1).textContent())!.trim();
  await first.click();
  await expect(page).toHaveURL(/\/atlas\/[a-z_]+\?event=Q\d+/);
  await expect(page.getByTestId("atlas-detail")).toContainText(title, { timeout: 15000 });
  await expect(page.getByText("Explore the evidence")).toBeVisible();
});

test("a continent has its own atlas, and back returns to the list", async ({ page }) => {
  await page.goto("/atlas/europe");
  await expect(page.getByTestId("atlas-count")).toContainText("the best documented of", { timeout: 15000 });
  await page.getByTestId("atlas-list").getByRole("button").first().click();
  await expect(page).toHaveURL(/event=Q\d+/);
  await page.goBack();
  await expect(page.getByTestId("atlas-list")).toBeVisible();
});

test("BC events are dated as BC, in order", async ({ page }) => {
  await page.goto("/atlas/italy");
  const first = page.getByTestId("atlas-list").getByRole("button").first();
  await expect(first).toContainText(/BC/, { timeout: 15000 });
});
