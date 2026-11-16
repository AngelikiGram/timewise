import { expect, test } from "@playwright/test";

// The explorer reads Wikidata live, so these tests need a connection and allow for its latency.
test.describe.configure({ timeout: 90000 });

test("the explorer starts from search, checked places and guided paths", async ({ page }) => {
  await page.goto("/connections");
  await expect(page.getByTestId("network-start")).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore", exact: true }).filter({ visible: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "Graz" })).toBeVisible();
  await expect(page.getByText("Guided paths")).toBeVisible();
});

test("a place from the checked collection links to its sourced events, labelled as checked", async ({ page }) => {
  await page.goto("/connections?id=Q13298"); // Graz
  await expect(page.getByTestId("record-card")).toContainText("Graz", { timeout: 30000 });
  await expect(page.getByTestId("network-filters")).toContainText("Checked TIMEWISE events here");
  await expect(page.getByTestId("network-coverage")).toContainText("none of it is complete");
});

test("every link says why, and branching builds a shareable path", async ({ page }) => {
  await page.goto("/connections?id=Q2269&view=cards"); // Industrial Revolution
  await expect(page.getByTestId("record-card")).toContainText("Industrial Revolution", { timeout: 30000 });
  const documented = page.locator('[data-testid="connection-cards"] [data-card][data-documented="true"]').first();
  await expect(documented).toBeVisible();
  await documented.getByRole("button", { name: /^Why is/ }).click();
  const detail = page.getByTestId("link-detail");
  await expect(detail).toContainText("Why they’re connected");
  await expect(detail).toContainText("Documented");
  await expect(detail.getByRole("link", { name: /See the statement on Wikidata/ })).toHaveAttribute("href", /wikidata\.org\/wiki\/Q\d+#P\d+/);
  const name = (await detail.getByRole("heading", { level: 2 }).textContent())!;
  await detail.getByTestId("open-link").click();
  await expect(page).toHaveURL(/path=Q2269%2CQ\d+/);
  await expect(page.getByTestId("record-card")).toContainText(name, { timeout: 30000 });
  await expect(page.getByTestId("network-path")).toContainText("Industrial Revolution");
  await expect(page.getByRole("button", { name: "Share path" })).toBeVisible();
});

test("contextual links are drawn and explained differently from documented ones", async ({ page }) => {
  await page.goto("/connections?id=Q2269&view=cards");
  const contextual = page.locator('[data-testid="connection-cards"] [data-card][data-documented="false"]').first();
  await expect(contextual).toBeVisible({ timeout: 30000 });
  await contextual.getByRole("button", { name: /^Why is/ }).click();
  await expect(page.getByTestId("link-detail")).toContainText("Contextual");
  await expect(page.getByTestId("link-detail")).toContainText("No relationship between them is documented");
  await page.getByLabel("Contextual links").uncheck();
  await expect(page.locator('[data-testid="connection-cards"] [data-card][data-documented="false"]')).toHaveCount(0);
});

test("the time graph places links at their dates, and brushing zooms it", async ({ page }, info) => {
  await page.goto("/connections?id=Q2269");
  const graph = page.getByTestId("time-graph");
  await expect(graph.locator("[data-node]").first()).toBeVisible({ timeout: 40000 });
  const before = await graph.locator("[data-node]").count();
  if (info.project.name !== "mobile") {
    const box = (await page.getByTestId("time-brush").boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.95, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByTestId("brush")).toBeVisible();
    expect(await graph.locator("[data-node]").count()).toBeLessThanOrEqual(before);
    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(page.getByTestId("brush")).toHaveCount(0);
  }
  await page.getByRole("tab", { name: "Map" }).click();
  await expect(page).toHaveURL(/view=map/);
  await expect(page.getByTestId("map-view")).toContainText("Today’s borders, not historical ones");
});

test("without Wikidata, the explorer says so and offers to retry", async ({ page, context }) => {
  await context.route(/wikidata\.org|wikipedia\.org|wikimedia\.org/, (route) => route.abort());
  await page.goto("/connections?id=Q2269");
  await expect(page.getByText(/Wikidata couldn’t be reached/)).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("an imported event leads into the explorer", async ({ page }) => {
  await page.goto("/atlas/austria?event=Q178510");
  await expect(page.getByTestId("explore-connections")).toHaveAttribute("href", /\/connections\?id=Q178510/, { timeout: 20000 });
});

test("choosing a card steps to it, and Back returns one step", async ({ page }) => {
  await page.goto("/connections?id=Q2269&view=cards");
  const card = page.locator('[data-testid="connection-cards"] [data-card][data-documented="true"]').first();
  await expect(card).toBeVisible({ timeout: 30000 });
  const target = await card.getAttribute("data-card");
  await card.locator("button").first().click();
  await expect(page).toHaveURL(new RegExp(`id=${target}`));
  await expect(page.getByTestId("focus-card")).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Back one step" }).click();
  await expect(page).toHaveURL(/id=Q2269/);
  await expect(page.getByTestId("focus-card")).toContainText("Industrial Revolution", { timeout: 30000 });
});

test("cards don't overflow or clip on a phone", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "phone layout");
  await page.goto("/connections?id=Q2269&view=cards");
  await expect(page.getByTestId("focus-card")).toBeVisible({ timeout: 30000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  const clipped = await page.locator("[data-card]").evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
  expect(clipped).toBe(0);
});
