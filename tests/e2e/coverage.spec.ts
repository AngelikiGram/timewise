import { expect, test, type Page } from "@playwright/test";

type MapWindow = Window & { __coverageMap?: { project: (lngLat: [number, number]) => { x: number; y: number } } };

/** Screen position of a longitude/latitude on the coverage map. */
async function pointOf(page: Page, lngLat: [number, number]) {
  const box = (await page.getByTestId("coverage-map").boundingBox())!;
  const p = await page.evaluate((ll) => (window as MapWindow).__coverageMap!.project(ll), lngLat);
  return { x: box.x + p.x, y: box.y + p.y };
}

test("the world map shows coverage, explains a country on hover, and opens its atlas", async ({ page, isMobile }) => {
  await page.goto("/atlas/countries");
  await expect(page.getByTestId("coverage-map")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  expect((await page.getByTestId("coverage-map").boundingBox())!.height).toBeGreaterThan(200);
  await expect(page.getByTestId("coverage-legend")).toContainText("None yet");
  await expect(page.getByText(/not how much history happened there/)).toBeVisible();
  test.skip(isMobile, "hover needs a mouse; the table below covers touch");
  const us = await pointOf(page, [-100, 40]);
  await page.mouse.move(us.x, us.y);
  await expect(page.getByRole("tooltip")).toContainText("United States");
  await expect(page.getByRole("tooltip")).toContainText("imported events");
  await page.mouse.click(us.x, us.y);
  await expect(page).toHaveURL(/\/atlas\/united_states$/);
});

test("territories that aren't in the country list are drawn and say so", async ({ page, isMobile }) => {
  test.skip(isMobile, "hover needs a mouse");
  await page.goto("/atlas/countries");
  await expect(page.getByTestId("coverage-map")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  const greenland = await pointOf(page, [-42, 72]);
  await page.mouse.move(greenland.x, greenland.y);
  await expect(page.getByRole("tooltip")).toContainText("Greenland");
  await expect(page.getByRole("tooltip")).toContainText("Not one of the 197 sovereign states");
});

test("the table lists the same countries and links to their atlas", async ({ page }) => {
  await page.goto("/atlas/countries");
  const table = page.getByTestId("coverage-table");
  await expect(table.getByRole("row").nth(1)).toBeVisible({ timeout: 15000 });
  await page.getByPlaceholder("Find a country").fill("austr");
  await expect(table.getByRole("link", { name: /Austria/ })).toHaveAttribute("href", "/atlas/austria");
  await expect(table).toContainText("Hand-checked records and imports");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the header's World Map link opens the world map", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main" }).filter({ visible: true }).getByRole("link", { name: "World Map" }).click();
  await expect(page).toHaveURL(/\/atlas$/);
  await expect(page.getByTestId("history-map")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await expect(page.getByRole("link", { name: "World Map" }).filter({ visible: true })).toHaveAttribute("aria-current", "page");
});

test("a country's atlas opens on that country, with its present-day border", async ({ page }) => {
  await page.goto("/atlas/united_states");
  await expect(page.getByTestId("history-map")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await expect(page.getByTestId("atlas-legend")).toContainText("Outside it");
  await expect.poll(async () => page.evaluate(() => {
    const m = (window as unknown as { __historyMap: { getCenter: () => { lng: number; lat: number }; getSource: (id: string) => { _data?: unknown } } }).__historyMap;
    const c = m.getCenter();
    return c.lng > -125 && c.lng < -66 && c.lat > 25 && c.lat < 50;
  }), { timeout: 15000 }).toBe(true);
});
