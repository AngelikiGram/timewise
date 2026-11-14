import { expect, test } from "@playwright/test";

const isMobile = (name: string) => name === "mobile";

test("search leads to an event with map, timeline and source in step", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await page.getByRole("combobox").fill("Ödenburg");
  await page.getByRole("option").first().click();
  await expect(page).toHaveURL(/event=sopron-1921/);
  await expect(page.getByTestId("timeline-year")).toHaveText("1921");
  if (isMobile(info.project.name)) await page.getByRole("tab", { name: "Evidence" }).click();
  await expect(page.getByTestId("evidence-panel")).toContainText("Sopron votes for Hungary");
  await expect(page.getByTestId("claim").getByText("Disputed")).toBeVisible();
  await expect(page.getByRole("link", { name: /^Sopron ↗/ })).toHaveAttribute("href", /wikipedia\.org\/wiki\/Sopron#:~:text=/);
  expect(errors).toEqual([]);
});

test("clicking a timeline event updates evidence, URL and map camera", async ({ page }, info) => {
  await page.goto("/explore");
  await expect(page.getByTestId("atlas-map")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  if (isMobile(info.project.name)) await page.getByRole("tab", { name: "Map" }).click();
  const box = await page.getByTestId("atlas-map").boundingBox();
  expect(box!.height, "map must occupy real space").toBeGreaterThan(150);
  await page.getByTestId("event-list").getByRole("button", { name: "Treaty of Saint-Germain, 1919" }).dispatchEvent("click");
  await expect(page).toHaveURL(/event=saint-germain-1919/);
  await expect(page.getByTestId("timeline-year")).toHaveText("1919");
  if (isMobile(info.project.name)) await page.getByRole("tab", { name: "Evidence" }).click();
  await expect(page.getByTestId("evidence-panel")).toContainText("Château de Saint-Germain-en-Laye");
  await expect
    .poll(() => page.evaluate(() => (window as any).__timewiseMap.getCenter().lng), { timeout: 8000 })
    .toBeLessThan(12); // framed between Saint-Germain and Austria, west of the 14.2 starting view
});

test("timeline marks encode the type of date, and rows are labelled", async ({ page }, info) => {
  test.skip(isMobile(info.project.name), "desktop checks the unclustered marks");
  await page.goto("/explore");
  await expect(page.locator('[data-event="brenner-1867"]')).toHaveAttribute("data-form", "exact");
  await expect(page.locator('[data-event="semmering-construction"]')).toHaveAttribute("data-form", "process");
  await expect(page.locator('[data-event="linz-program-1882"]')).toHaveAttribute("data-form", "approximate");
  for (const id of ["politics", "railways", "city", "war", "culture"]) await expect(page.locator(`[data-track-label="${id}"]`)).toBeVisible();
  await page.locator('[data-event="brenner-1867"]').click();
  await expect(page).toHaveURL(/event=brenner-1867/);
  await expect(page.getByTestId("timeline-selected")).toHaveText("Rail over the Brenner");
});

test("clicking a group zooms in and separates its records", async ({ page }) => {
  await page.goto("/explore?theme=politics");
  const cluster = page.locator("[data-cluster]").first();
  await expect(cluster).toBeVisible();
  await cluster.click();
  await expect(page.locator('[data-event="vienna-october-1848"]')).toHaveAttribute("data-form", "range");
  await expect(page.locator('[data-event="vienna-march-1848"]')).toBeVisible();
});

test("keyboard moves between records", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByTestId("timeline-year")).toHaveText("1844");
  await page.getByRole("slider").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("timeline-year")).toHaveText("1848");
  await page.keyboard.press("End");
  await expect(page.getByTestId("timeline-year")).toHaveText("1921");
  await page.keyboard.press("Home");
  await expect(page.getByTestId("timeline-year")).toHaveText("1844");
});

test("the Brenner line is a labelled route, not only a point", async ({ page }, info) => {
  await page.goto("/explore?event=brenner-1867");
  await expect(page.getByTestId("atlas-map")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  if (isMobile(info.project.name)) await page.getByRole("tab", { name: "Evidence" }).click();
  // Today's track from OpenStreetMap, labelled as a present-day shape, not a historical survey.
  await expect(page.getByTestId("geography")).toContainText("Modern reference");
  await expect(page.getByTestId("geography")).toContainText("OpenStreetMap");
  // The selection pulse repaints constantly, so the map never reports "idle". Poll instead.
  await expect
    .poll(() => page.evaluate(() => (window as any).__timewiseMap.queryRenderedFeatures({ layers: ["tw-geo-solid"] }).map((f: any) => f.properties.id)), { timeout: 15000 })
    .toContain("s-brenner");
});

test("a date with no boundary data says so and draws none", async ({ page }) => {
  await page.goto("/explore?event=vienna-march-1848");
  await page.getByRole("tab", { name: "Map" }).click({ timeout: 1000 }).catch(() => {});
  await expect(page.getByTestId("coverage-note")).toContainText("No political boundary data");
  await page.getByTestId("event-list").getByRole("button", { name: "Assassination at Sarajevo, 1914" }).dispatchEvent("click");
  await expect(page.getByTestId("coverage-note")).toContainText("community-digitized");
});

test("a record without a location isn't given a marker", async ({ page }, info) => {
  await page.goto("/explore?event=burgenland-adjustments");
  if (isMobile(info.project.name)) await page.getByRole("tab", { name: "Evidence" }).click();
  await expect(page.getByTestId("evidence-panel")).toContainText("No single location");
});

test("clicking a map marker selects that event everywhere", async ({ page }, info) => {
  test.skip(isMobile(info.project.name), "the same handler runs on mobile; coordinates are checked on desktop");
  await page.goto("/explore?event=vienna-march-1848");
  await expect(page.getByTestId("atlas-map")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  // Linz is close enough to be on screen at the Vienna camera position.
  await page.waitForFunction(() => {
    const m = (window as any).__timewiseMap;
    return !m.isMoving() && m.queryRenderedFeatures({ layers: ["tw-points"] }).some((f: any) => f.properties.id === "linz-program-1882");
  });
  const point = await page.evaluate(() => {
    const { x, y } = (window as any).__timewiseMap.project([14.2864, 48.3058]);
    return { x, y };
  });
  await page.getByTestId("atlas-map").click({ position: point });
  await expect(page).toHaveURL(/event=linz-program-1882/);
  await expect(page.getByTestId("timeline-year")).toHaveText("1882");
  await expect(page.getByTestId("evidence-panel")).toContainText("The Linz Program");
  await expect(page.getByTestId("event-list").getByRole("button", { name: "The Linz Program, 1882" })).toHaveAttribute("aria-pressed", "true");
});

test("theme filter narrows events on the timeline", async ({ page }) => {
  await page.goto("/explore?theme=railways");
  await expect(page.getByTestId("event-list").getByRole("button")).toHaveCount(4);
  await expect(page.getByTestId("event-list").getByRole("button", { name: "Rail over the Brenner, 1867" })).toHaveCount(1);
});

test("the hidden map doesn't show through other mobile tabs", async ({ page }, info) => {
  test.skip(!isMobile(info.project.name), "tabs only exist on mobile");
  await page.goto("/explore?event=carinthia-1920");
  await expect(page.getByTestId("atlas-map")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await expect(page.locator(".maplibregl-ctrl-attrib")).toBeHidden();
  await page.getByRole("tab", { name: "Map" }).click();
  await expect(page.locator(".maplibregl-ctrl-attrib")).toBeVisible();
});

test("playback advances through events",async ({ page }) => {
  await page.goto("/explore");
  await page.getByRole("button", { name: "Play through events" }).click();
  await expect(page.getByTestId("timeline-year")).not.toHaveText("1844", { timeout: 12000 });
  await page.getByRole("button", { name: "Pause playback" }).click();
});

test("appearance toggle persists", async ({ page }) => {
  await page.goto("/");
  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.getByRole("button", { name: /Switch to/ }).click();
  const after = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(after).not.toBe(before);
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(after);
});

test("no horizontal page scroll", async ({ page }) => {
  for (const path of ["/", "/explore"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
