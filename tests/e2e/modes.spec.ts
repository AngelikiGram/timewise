import { expect, test } from "@playwright/test";

test("four ways in, and moving naturally between them", async ({ page }) => {
  await page.goto("/explore/begin");
  await expect(page.getByTestId("begin-card")).toHaveCount(4);

  // A year: who was alive, then follow one of those lives.
  await page.goto("/explore/year?y=1900");
  await expect(page.getByTestId("year-title")).toHaveText("1900");
  await page.getByTestId("year-alive").getByRole("link", { name: /Otto Wagner, 59/ }).click();
  await expect(page).toHaveURL(/explore\/life\?id=Q84287/);
  await expect(page.getByTestId("life-works")).toContainText("Kirche am Steinhof");
  await expect(page.getByTestId("life-people")).toContainText("Josef Hoffmann");

  // From the life to the style it belongs to, then save it as an interest.
  await page.getByTestId("next-steps").getByRole("link", { name: /Follow art nouveau/ }).click();
  await expect(page.getByTestId("thing")).toContainText("Art Nouveau");
  await page.getByTestId("save-interest").first().click();
  await expect(page.getByTestId("save-interest").first()).toHaveAttribute("aria-pressed", "true");

  // Interests now suggest a thing, a life and a year.
  await page.goto("/explore/interests");
  const s = page.getByTestId("suggestions");
  await expect(s).toContainText("Follow a thing");
  await expect(s).toContainText("Follow a life");
  await expect(s).toContainText("Explore a year");
});

test("a thing's decade bars narrow the list", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "bars are thin on phones");
  await page.goto("/explore/thing?id=art-nouveau");
  const items = page.getByTestId("thing-items").locator("li");
  const before = await items.count();
  await page.getByTestId("thing-decades").getByRole("button", { name: /^1890s/ }).click();
  await expect(page.getByTestId("thing-items")).not.toContainText(/^19[1-9]\d/);
  expect(await items.count()).toBeLessThanOrEqual(before);
});
