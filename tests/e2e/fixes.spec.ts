import { expect, test } from "@playwright/test";
import { mainSearch, openList } from "./helpers";

test.describe.configure({ timeout: 90000 });

test("a checked event and its Wikidata record appear once, with both sources kept", async ({ page }) => {
  await page.goto("/atlas/austria?scope=here,associated,multi,unlocated");
  await openList(page);
  await page.getByLabel("Search events").fill("Königgrätz");
  await expect(page.getByTestId("atlas-list").getByRole("button", { name: /Battle of Königgrätz/ })).toHaveCount(1, { timeout: 20000 });
  await page.getByTestId("atlas-list").getByRole("button", { name: /Battle of Königgrätz/ }).click();
  await page.getByTestId("evidence-details").locator("summary").click();
  await expect(page.getByTestId("merged-records")).toContainText("Q154942");
});

test("a country map shows what happened inside it by default, and labels the rest", async ({ page }) => {
  await page.goto("/atlas/austria");
  await openList(page);
  const scope = page.getByTestId("scope-filter");
  await expect(page.getByTestId("country-mode").getByRole("radio", { name: "In Austria" })).toHaveAttribute("aria-checked", "true");
  await scope.getByText("Fine-tune what’s included").click();
  await expect(scope).toContainText("Happened here");
  await expect(scope.getByRole("checkbox", { name: /Happened here/ })).toBeChecked();
  await expect(scope.getByRole("checkbox", { name: /located elsewhere/ })).not.toBeChecked();
  await expect(page.getByTestId("atlas-list")).not.toContainText("outside today’s Austria", { timeout: 20000 });
  await scope.getByRole("checkbox", { name: /located elsewhere/ }).check();
  await expect(page).toHaveURL(/scope=here%2Cassociated|scope=here,associated/);
  await page.getByLabel("Search events").fill("Lake Constance");
  await expect(page.getByTestId("atlas-list")).toContainText("outside today’s Austria");
});

test("timeline bars respond to keyboard, and records under them open", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "the timeline is compact on phones; checked on desktop");
  await page.goto("/atlas/austria");
  await expect(page.getByTestId("atlas-count")).toContainText("on the map", { timeout: 20000 });
  const bar = page.getByTestId("atlas-timeline").locator('button[data-century="1800"]');
  await expect(bar).toHaveAttribute("aria-label", /records? in this dataset/, { timeout: 20000 });
  await bar.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/from=\d+&to=\d+/);
  // The chosen century is now drawn year by year; a year bar lists its records when chosen with Space.
  await expect(page.getByTestId("atlas-timeline").getByRole("group").first()).toHaveAttribute("aria-label", /per year/);
  const year = page.getByTestId("atlas-timeline").locator("button[data-bucket]").first();
  const y = await year.getAttribute("data-bucket");
  await year.press("Space");
  await expect(page).toHaveURL(new RegExp(`from=${y}&to=${y}`));
  await page.getByRole("button", { name: "Reset" }).first().click();
  await page.getByTestId("atlas-timeline").locator('button[data-century="1800"]').click();
  const mark = page.getByTestId("timeline-records").getByRole("button").first();
  await expect(mark).toBeVisible();
  await mark.press("Enter");
  await expect(page.getByTestId("atlas-detail")).toBeVisible();
  await expect(page).toHaveURL(/event=/);
});

test("search: Enter opens the first result, and the scope says what it covers", async ({ page }) => {
  await page.goto("/");
  await mainSearch(page).fill("Waterloo");
  await expect(page.getByRole("main").getByTestId("search-status")).toContainText("indexed records", { timeout: 15000 });
  await expect(page.getByRole("main").getByTestId("search-results")).toContainText("Battle of Waterloo");
  await mainSearch(page).press("Enter");
  await expect(page).toHaveURL(/event=Q48314/);
});

test("search on a country map offers that map as a scope and keeps its filters", async ({ page }) => {
  await page.goto("/atlas/austria?cat=war");
  const header = page.getByRole("banner");
  const scope = header.getByTestId("search-scope").filter({ visible: true });
  test.skip(!(await scope.count()), "header search is collapsed on phones");
  await scope.selectOption("region");
  await header.getByRole("combobox", { name: /^Search history in This map/ }).fill("Vienna");
  await expect(header.getByTestId("search-results")).toBeVisible({ timeout: 20000 });
  await header.getByTestId("search-results").getByRole("option").first().click();
  await expect(page).toHaveURL(/\/atlas\/austria\?.*cat=war.*event=|\/atlas\/austria\?.*event=.*cat=war/);
});

test("a search result can be chosen by touch", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "touch");
  await page.goto("/");
  await mainSearch(page).fill("Ödenburg");
  await page.getByTestId("search-results").getByRole("option").first().tap();
  await expect(page).toHaveURL(/event=sopron-1921/);
});

test("journeys can be browsed by question, topic, period, region and place", async ({ page }) => {
  await page.goto("/stories");
  const catalog = page.getByTestId("journey-catalog");
  expect(await catalog.getByTestId("path-card").count()).toBeGreaterThan(150);
  await catalog.getByRole("radio", { name: /By place/ }).click();
  await expect(catalog.getByTestId("path-card").first()).not.toContainText("Checked by hand");
  await catalog.getByPlaceholder(/Filter by name/).fill("Japan");
  await catalog.getByTestId("path-card").first().click();
  await expect(page).toHaveURL(/path=place-japan/);
  await expect(page.getByTestId("path-map")).toContainText("Japan:");
});

test("a generated journey says how it chose its records and shows them on a map and timeline", async ({ page }) => {
  await page.goto("/learn/lesson?id=p-japan-long-19th&path=place-japan");
  const intro = page.getByTestId("lesson-intro");
  await expect(intro).toContainText("Assembled automatically", { timeout: 40000 });
  await expect(intro).toContainText("not checked by hand");
  await expect(page.getByTestId("lesson-overview").locator("li")).toHaveCount(4);
});

test("the home workspace: a record in focus, its links on a map, and a timeline that changes the focus", async ({ page }) => {
  await page.goto("/");
  const record = page.getByTestId("workspace-record");
  await expect(record.getByRole("heading", { level: 2 })).toBeVisible({ timeout: 30000 });
  const first = await record.getByRole("heading", { level: 2 }).textContent();
  await expect(page.getByTestId("workspace-map")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  const marker = page.getByTestId("workspace-timeline").getByRole("button", { pressed: false }).nth(2);
  await marker.press("Enter");
  await expect(record.getByRole("heading", { level: 2 })).not.toHaveText(first!);
  await expect(record.getByRole("link", { name: /Connections/ })).toHaveAttribute("href", /\/connections\?id=Q\d+/);
  await page.getByTestId("period").selectOption({ label: "1914–1945" });
  await expect(record).toContainText(/19(1[4-9]|[23]\d|4[0-5])/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test("stories follow documented links, and every step shows the statement it rests on", async ({ page }) => {
  await page.goto("/stories");
  const list = page.getByTestId("generated-stories");
  await expect(list).toContainText(/of \d{3} stories/, { timeout: 15000 });
  await list.getByRole("combobox", { name: "Kind of story" }).selectOption("chain");
  await list.getByTestId("generated-story").first().click();
  await expect(page).toHaveURL(/stories\/read\?id=chain-Q\d+/);
  await expect(page.getByTestId("story-intro")).toContainText("Chain of documented links");
  await expect(page.getByTestId("story-intro")).toContainText("documented links lead from");
  await page.getByTestId("story-start").click();
  const first = await page.getByTestId("story-title").textContent();
  await page.getByTestId("story-next").click();
  await expect(page.getByTestId("story-title")).not.toHaveText(first!);
  await expect(page.getByTestId("story-link")).toContainText(first!);
  await expect(page.getByTestId("story-link").getByRole("link")).toHaveAttribute("href", /wikidata\.org\/wiki\/Q\d+#P\d+/);
  await page.getByTestId("story-strip").getByRole("button").last().click();
  await page.getByTestId("story-next").click();
  await expect(page.getByTestId("story-end")).toContainText("Story complete");
});

test("the home timeline can be narrowed by typing years, and says which year is selected", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("focus-year")).toBeVisible({ timeout: 30000 });
  const range = page.getByTestId("workspace-range");
  await range.getByLabel("From year").fill("1848");
  await range.getByLabel("To year").fill("1870");
  await range.getByRole("button", { name: "Show" }).click();
  await expect(range).toContainText("1848–1870");
  const year = Number(await page.getByTestId("focus-year").textContent());
  expect(year).toBeGreaterThanOrEqual(1848);
  expect(year).toBeLessThanOrEqual(1870);
});

test("the navigation rail stays fixed at the left on wide screens", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "wide screens");
  await page.goto("/journeys/austria-1848-1921");
  const rail = page.getByRole("navigation", { name: "Main" }).filter({ visible: true });
  const box = await rail.boundingBox();
  expect(box!.x).toBe(0);
  expect(box!.y).toBe(0);
  await expect(rail.getByRole("link", { name: "TIMEWISE home" })).toBeVisible();
});

test("changing the search scope says at once what it covers", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "header search is collapsed on phones");
  await page.goto("/atlas");
  const header = page.getByRole("banner");
  const scope = header.getByTestId("search-scope");
  await expect(scope.locator("option")).toContainText(["Indexed records", "Checked only", "This map: the world", "Wikidata (live)"]);
  await scope.selectOption("wikidata");
  await expect(header.getByTestId("search-hint")).toContainText("Wikidata (live)");
  await scope.selectOption("checked");
  await expect(header.getByTestId("search-hint")).toContainText("hand-checked Austria collection");
});

test("dragging across the timeline bars chooses a span", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "mouse drag on desktop");
  await page.goto("/atlas/austria");
  await expect(page.getByTestId("atlas-count")).toContainText("on the map", { timeout: 20000 });
  const bars = (await page.getByTestId("timeline-bars").boundingBox())!;
  await page.mouse.move(bars.x + bars.width * 0.55, bars.y + bars.height - 4);
  await page.mouse.down();
  await page.mouse.move(bars.x + bars.width * 0.8, bars.y + bars.height - 4, { steps: 8 });
  await page.mouse.up();
  await expect(page).toHaveURL(/from=\d+&to=\d+/);
});
