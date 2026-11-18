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

test("tabs open on what you're looking at, and Back returns to the last page", async ({ page }) => {
  await page.goto("/explore/life?id=Q84287");
  const bar = page.getByTestId("mode-bar");
  // From Otto Wagner, the thing tab opens Art Nouveau rather than a fixed start.
  await expect(bar.getByRole("link", { name: /Follow a thing/ })).toHaveAttribute("href", /id=art-nouveau/);
  await bar.getByRole("link", { name: /Explore a year/ }).click();
  await expect(page).toHaveURL(/explore\/year\?y=\d{4}/);
  await expect(page.getByTestId("trail")).toContainText("Otto Wagner");
  await page.getByTestId("trail-back").click();
  await expect(page).toHaveURL(/explore\/life\?id=Q84287/);
  // Year steps are history entries: the browser's Back returns to the previous year.
  await page.goto("/explore/year?y=1900");
  await page.getByRole("button", { name: "Next year" }).click();
  await expect(page.getByTestId("year-title")).toHaveText("1901");
  await page.goBack();
  await expect(page.getByTestId("year-title")).toHaveText("1900");
});

test("interest buttons in a list are just the name", async ({ page }) => {
  await page.goto("/explore/interests");
  const first = page.getByTestId("save-interest").first();
  await expect(first).not.toContainText("to your interests");
  await first.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(first).toContainText("✓");
});

test("the map has layers, a base map choice, and a card on click", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "map interaction on wide screens");
  await page.goto("/explore/life?id=Q84287");
  const map = page.getByTestId("explore-map");
  await expect(map).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await expect(page.getByTestId("map-layers")).toContainText("Works");
  await page.getByTestId("map-base").selectOption("detailed");
  await expect(map).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  // Choosing a work in the list opens its card on the map.
  await page.getByTestId("life-works").getByRole("button", { name: "on the map" }).first().click();
  await expect(page.getByTestId("map-card")).toBeVisible();
  await expect(page.getByTestId("map-card").getByRole("link").first()).toBeVisible();
});
