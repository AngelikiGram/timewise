import { expect, test } from "@playwright/test";

const URL = "/journeys/austria-1848-1921";

test("starts from the homepage and opens on a question", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("link", { name: "Follow a story" }).click();
  await expect(page.getByTestId("journey-question")).toHaveText("What could a revolution change in two days?");
  await expect(page.getByTestId("journey-year")).toHaveText("1848");
  expect(errors).toEqual([]);
});

test("next moves map, time, event and URL together", async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByTestId("atlas-map")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByTestId("journey-event")).toContainText("The October Uprising");
  await page.getByRole("button", { name: "Next chapter" }).click();
  await expect(page.getByTestId("journey-question")).toHaveText("How did a railway cross a mountain range?");
  await expect(page).toHaveURL(/chapter=rails/);
  await expect(page.getByTestId("journey-year")).toHaveText("1844", { timeout: 5000 });
  await expect
    .poll(() => page.evaluate(() => (window as any).__timewiseMap.queryRenderedFeatures({ layers: ["tw-geo-solid"] }).map((f: any) => f.properties.id)), { timeout: 15000 })
    .toContain("s-graz");
});

test("a shape appears only once time reaches it", async ({ page }) => {
  await page.goto(`${URL}?chapter=divided&step=2`);
  await expect(page.getByTestId("atlas-map")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await expect(page.getByTestId("journey-year")).toHaveText("1867");
  const filterHasDate = () => page.evaluate(() => JSON.stringify((window as any).__timewiseMap.getFilter("tw-geo-schematic")));
  await expect.poll(filterHasDate).toContain("18670529");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect.poll(filterHasDate, { timeout: 5000 }).toContain("18670824");
});

test("any statement opens its evidence", async ({ page }) => {
  await page.goto(URL);
  await page.getByText(/^Inspect evidence/).first().click();
  await expect(page.getByTestId("claim").first()).toContainText("March Revolution");
  await expect(page.getByRole("link", { name: /Revolution 1848 ↗/ })).toHaveAttribute("href", /geschichtewiki/);
});

test("a shared link opens at the same place, and arrow keys move", async ({ page }) => {
  await page.goto(`${URL}?chapter=borders&step=3`);
  await expect(page.getByTestId("journey-event")).toContainText("The Carinthian plebiscite");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("journey-event")).toContainText("Settling the Burgenland border");
  await expect(page.getByTestId("journey-event")).toContainText("no single location", { ignoreCase: true });
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByTestId("journey-event")).toContainText("The Carinthian plebiscite");
});

test("real archival material appears in the story", async ({ page }) => {
  await page.goto(`${URL}?chapter=revolution&step=2`);
  await expect(page.getByTestId("archival-material")).toContainText("Vom St. Stephansthurme");
});

test("the end says what the journey can't tell you", async ({ page }) => {
  await page.goto(`${URL}?chapter=culture`);
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByTestId("journey-closing")).toContainText("no historian has reviewed it");
  await page.getByRole("button", { name: "Start again" }).click();
  await expect(page.getByTestId("journey-question")).toHaveText("What could a revolution change in two days?");
});

test("the layout fits and the map has real size", async ({ page }) => {
  await page.goto(URL);
  const box = await page.getByTestId("atlas-map").boundingBox();
  expect(box!.height).toBeGreaterThan(150);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeInViewport();
});
