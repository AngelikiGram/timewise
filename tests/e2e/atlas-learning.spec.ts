import { expect, test, type Page } from "@playwright/test";
import { openList } from "./helpers";

test.describe.configure({ timeout: 120000 });

async function toNextQuestion(page: Page) {
  for (let i = 0; i < 14; i++) {
    if (await page.getByTestId("activity").isVisible() || await page.getByTestId("lesson-summary").isVisible()) return;
    await page.getByTestId("continue").last().click();
  }
}
async function answer(page: Page) {
  const a = page.getByTestId("activity").first();
  const kind = await a.getAttribute("data-kind");
  if (kind === "order") await a.getByRole("button", { name: "Check my order" }).click();
  else { await a.getByRole("radio").first().click(); await a.getByRole("button", { name: "Check" }).click(); }
  await expect(page.getByTestId("feedback").first()).toBeVisible();
}
async function finishLesson(page: Page, id: string) {
  await page.goto(`/learn/lesson?id=${id}&path=austria`);
  await expect(page.getByTestId("lesson-intro")).toBeVisible({ timeout: 20000 });
  for (;;) {
    await toNextQuestion(page);
    if (await page.getByTestId("lesson-summary").isVisible()) break;
    await answer(page);
    await page.getByTestId("feedback").getByTestId("continue").click();
  }
}

test("open a name in a lesson, see its sourced relationships, save it, and find it in the atlas after a refresh", async ({ page }) => {
  await page.goto("/learn/lesson?id=austria-dual&path=austria");
  await expect(page.getByTestId("lesson-intro")).toBeVisible({ timeout: 30000 });
  await page.getByTestId("continue").click();
  const card = page.getByTestId("learn-card");
  await card.locator("[data-entity]").first().click();
  const panel = page.getByTestId("entity-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("entity-relations")).toContainText(/took place in|is named in the record of/);
  await expect(panel.getByTestId("entity-relations").getByRole("link").first()).toHaveAttribute("href", /^https:\/\//);
  const name = (await panel.getByRole("heading", { level: 2 }).textContent())!;
  await panel.getByTestId("save-entity").click();
  await expect(panel.getByTestId("save-entity")).toHaveText("Saved ✓");
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page.getByTestId("learn-card")).toBeVisible(); // still in the lesson, at the same card
  await page.goto("/my-atlas");
  await page.reload();
  await expect(page.getByTestId("atlas-list-alt")).toContainText(name);
  await page.getByTestId("atlas-list-alt").getByRole("button", { name: name, exact: true }).or(page.getByTestId("atlas-list-alt").getByRole("button", { name: `${name} saved`, exact: true })).first().click();
  await expect(page.getByTestId("atlas-states")).toContainText("Saved");
  await expect(page.getByTestId("atlas-states")).toContainText("Explored");
});

test("finishing a lesson grows the atlas, and a person met again is linked, not duplicated", async ({ page }) => {
  await finishLesson(page, "austria-ring");
  await expect(page.getByTestId("atlas-growth")).toContainText("Your atlas grew");
  await page.goto("/learn/lesson?id=austria-dual&path=austria");
  await page.getByTestId("continue").click();
  // Find the Compromise card, which names Franz Joseph I again.
  for (let i = 0; i < 4 && !(await page.getByTestId("learn-card").textContent())!.includes("Compromise"); i++) await page.getByTestId("continue").last().click();
  await expect(page.getByTestId("seen-before")).toContainText("Franz Joseph I");
  await page.getByTestId("card-people").getByRole("button", { name: /Franz Joseph I/ }).click();
  await expect(page.getByTestId("met-before")).toContainText("A capital without walls");
  await page.goto("/my-atlas");
  await expect(page.getByTestId("atlas-list-alt").getByRole("button", { name: /^Franz Joseph I/ })).toHaveCount(1);
});

test("the atlas graph shows a focus, labelled sourced links, and a way back to the lesson", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "graph on wide screens; phones get cards");
  await finishLesson(page, "austria-rails");
  await page.goto(`/my-atlas?back=${encodeURIComponent("/learn/lesson?id=austria-rails&path=austria")}`);
  const graph = page.getByTestId("atlas-graph");
  await expect(graph.locator("[data-atlas-focus]")).toBeVisible();
  await expect(graph.locator("[data-atlas-node]").first()).toBeVisible();
  expect(await graph.locator("[data-atlas-node]").count()).toBeLessThanOrEqual(6);
  await expect(page.getByTestId("back-to-lesson")).toHaveAttribute("href", /austria-rails/);
});

test("a lesson asks where an event belongs on the timeline", async ({ page }) => {
  await page.goto("/learn/lesson?id=austria-rails&path=austria");
  await expect(page.getByTestId("lesson-intro")).toBeVisible({ timeout: 20000 });
  for (let i = 0; i < 12 && !(await page.locator('[data-kind="timeline"]').count()); i++) {
    await toNextQuestion(page);
    if (await page.getByTestId("lesson-summary").isVisible()) break;
    if (await page.locator('[data-kind="timeline"]').count()) break;
    await answer(page);
    await page.getByTestId("feedback").getByTestId("continue").click();
  }
  const q = page.locator('[data-kind="timeline"]');
  await expect(q).toBeVisible();
  await q.getByRole("radio").first().click();
  await q.getByRole("button", { name: "Check" }).click();
  await expect(page.getByTestId("feedback")).toContainText("Sources");
});

test("every country with enough records has a staged path", async ({ page }) => {
  await page.goto("/learn/lesson?id=p-japan-long-19th&path=place-japan");
  await expect(page.getByTestId("lesson-intro")).toContainText("Japan, 1800–1914", { timeout: 40000 });
  await page.goto("/learn?path=place-france");
  await expect(page.getByTestId("path-map")).toContainText("Stage 1");
});

test("a country map says plainly which events it shows, and switches between map, timeline and stories", async ({ page }) => {
  await page.goto("/atlas/austria");
  await openList(page);
  const mode = page.getByTestId("country-mode");
  await expect(mode.getByRole("radio", { name: "In Austria" })).toHaveAttribute("aria-checked", "true");
  await mode.getByRole("radio", { name: "Involving Austria" }).click();
  await expect(page).toHaveURL(/scope=here%2Cassociated%2Cmulti|scope=here,associated,multi/);
  await page.getByRole("button", { name: "Show map" }).click({ timeout: 2000 }).catch(() => {});
  await page.getByTestId("atlas-view").getByRole("tab", { name: "Timeline" }).click();
  await expect(page.getByTestId("atlas-timeline-view")).toBeVisible();
  await page.getByTestId("atlas-view").getByRole("tab", { name: "Stories" }).click();
  await expect(page.getByTestId("atlas-stories-view")).toContainText("Learn Austria step by step");
});

test("an event card separates what it was from records about it", async ({ page }) => {
  await page.goto("/atlas/austria?event=Q178510");
  const tabs = page.getByTestId("event-tabs");
  await expect(tabs).toBeVisible({ timeout: 20000 });
  await tabs.getByRole("tab", { name: "What came before" }).click();
  await expect(page.getByTestId("panel-before")).toBeVisible();
  await tabs.getByRole("tab", { name: "Records from the time" }).click();
  await expect(page.getByTestId("evidence-objects")).toContainText("evidence, not the event");
});

test("the profile is private by default, has a learning map, a goal and interests", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.getByRole("radio", { name: "Private" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("share-profile")).toHaveCount(0);
  await expect(page.getByTestId("learning-map").locator("path").first()).toBeVisible({ timeout: 20000 });
  await page.getByTestId("interests").getByRole("button", { name: "Europe" }).click();
  await expect(page.getByTestId("interests").getByRole("button", { name: "Europe" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("radio", { name: "Shareable" }).click();
  await expect(page.getByTestId("share-profile")).toBeVisible();
  await page.goto("/learn");
  await page.getByTestId("goal").selectOption("2");
  await expect(page.getByTestId("today")).toContainText("0/2");
});
