import { expect, test } from "@playwright/test";
import { openList } from "./helpers";

test("shows history well beyond the checked period, labelled as unreviewed", async ({ page }) => {
  await page.goto("/atlas/austria");
  await expect(page.getByTestId("atlas-count")).toContainText("on the map", { timeout: 15000 });
  await expect(page.locator('[data-century="1000"]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator("[data-century]").first()).toBeVisible();
  const earliest = Number(await page.locator("[data-century]").first().getAttribute("data-century"));
  expect(earliest).toBeLessThan(1500);
  await openList(page);
  const item = page.getByTestId("atlas-list").getByRole("button").first();
  await item.click();
  await expect(page.getByTestId("atlas-detail")).toContainText(/Imported|Source-checked/);
});

test("a century narrows the list and map", async ({ page }) => {
  await page.goto("/atlas/austria");
  await expect(page.locator('[data-century="1000"]')).toBeVisible({ timeout: 15000 });
  await page.locator('[data-century="1800"]').click();
  await openList(page);
  const dates = await page.getByTestId("atlas-list").getByRole("button").evaluateAll((els) => els.slice(0, 20).map((e) => e.textContent ?? ""));
  // A century keeps everything that overlaps it, so a longer process may start earlier.
  for (const d of dates) {
    const years = (d.match(/\d{3,4}(?! BC)/g) ?? []).map(Number);
    expect(Math.min(...years), d).toBeLessThanOrEqual(1899);
    expect(Math.max(...years), d).toBeGreaterThanOrEqual(1800);
  }
});

test("hand-checked events stay marked, and lead to their evidence", async ({ page }) => {
  await page.goto("/atlas/austria");
  await expect(page.locator('[data-century="1000"]')).toBeVisible({ timeout: 15000 });
  await openList(page);
  await page.getByRole("button", { name: "Hand-checked only" }).click();
  await expect(page.getByTestId("atlas-count")).toContainText("16 of");
  await page.getByRole("button", { name: /The Southern Railway reaches Graz/ }).click();
  await expect(page.getByTestId("atlas-detail")).toContainText("Source-checked");
  await expect(page.getByRole("link", { name: /See its evidence/ })).toHaveAttribute("href", /event=graz-railway-1844/);
});

test("search finds events, and no match says so", async ({ page }) => {
  await page.goto("/atlas/austria");
  await expect(page.locator("[data-century]").first()).toBeVisible({ timeout: 15000 });
  await openList(page);
  await page.getByLabel("Search events", { exact: true }).fill("zzzzqqq");
  await expect(page.getByText("Nothing matches these filters.")).toBeVisible();
});

test("the map has real size and the page doesn't overflow", async ({ page }) => {
  await page.goto("/atlas/austria");
  await expect(page.getByTestId("history-map")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  expect((await page.getByTestId("history-map").boundingBox())!.height).toBeGreaterThan(150);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("a country's old explore address opens its atlas, with events coloured by category", async ({ page }) => {
  await page.goto("/explore/germany");
  await expect(page).toHaveURL(/\/atlas\/germany$/);
  await expect(page.getByTestId("history-map")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await expect(page.getByTestId("atlas-legend")).toContainText("War");
  // The imported events carry coordinates (QLever's upper-case WKT once dropped them all).
  await expect(page.getByTestId("atlas-count")).toHaveText(/, [1-9][0-9,]* on the map$/);
});

test("picking an event shows its context", async ({ page }) => {
  await page.goto("/atlas/austria");
  await openList(page);
  await page.getByLabel("Order").selectOption("notable");
  await page.getByTestId("atlas-list").getByRole("button").first().click();
  await expect(page.getByTestId("atlas-detail")).toContainText("Around the same time");
});
