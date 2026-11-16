import { expect, test, type Page } from "@playwright/test";

/** Click "Continue"/"Next"/"Start" until a question appears, or the summary. */
async function toNextQuestion(page: Page) {
  for (let i = 0; i < 12; i++) {
    if (await page.getByTestId("activity").isVisible() || await page.getByTestId("lesson-summary").isVisible()) return;
    await page.getByTestId("continue").last().click();
  }
}

/** Answer the current question: the first option, or the order as shuffled. Returns whether it was right. */
async function answer(page: Page) {
  const a = page.getByTestId("activity");
  if ((await a.getAttribute("data-kind")) === "order") await a.getByRole("button", { name: "Check my order" }).click();
  else {
    await a.getByRole("radio").first().click();
    await a.getByRole("button", { name: "Check" }).click();
  }
  await expect(page.getByTestId("feedback")).toBeVisible();
  return (await page.getByTestId("feedback").textContent())!.startsWith("Correct");
}

test("the learn page makes the first step obvious and shows the path", async ({ page }) => {
  await page.goto("/learn");
  await expect(page.getByRole("link", { name: "Learn", exact: true }).filter({ visible: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("continue-learning")).toContainText("Start here", { timeout: 20000 });
  await expect(page.getByTestId("path-map").locator("[data-state]")).toHaveCount(6);
  await expect(page.getByTestId("path-map").locator('[data-state="next"]')).toHaveCount(1);
  await expect(page.getByTestId("path-card").first()).toContainText("Checked");
  await expect(page.getByTestId("path-card").filter({ hasText: "Europe" }).first()).toContainText("Generated, unreviewed");
});

test("a checked lesson: read, answer, see why with sources, finish and move on", async ({ page }) => {
  await page.goto("/learn/lesson?id=austria-rails&path=austria");
  await expect(page.getByTestId("lesson-intro")).toContainText("Iron across the Alps", { timeout: 20000 });
  await expect(page.getByTestId("lesson-intro")).toContainText("Source-checked");
  await page.getByTestId("continue").click();
  const card = page.getByTestId("learn-card");
  await expect(card).toContainText("Reference work");
  await expect(card.getByRole("link").first()).toHaveAttribute("href", /^https:\/\//);
  let asked = 0;
  for (;;) {
    await toNextQuestion(page);
    if (await page.getByTestId("lesson-summary").isVisible()) break;
    await answer(page);
    await expect(page.getByTestId("feedback")).toContainText("Sources");
    asked++;
    await page.getByTestId("feedback").getByTestId("continue").click();
  }
  expect(asked).toBeGreaterThanOrEqual(3);
  const summary = page.getByTestId("lesson-summary");
  await expect(summary).toContainText("What you learned");
  await expect(summary).toContainText("causes and effects");
  await expect(summary).toContainText(/\d+ XP|XP earned/);
  await expect(page.getByTestId("next-lesson")).toContainText("The year of revolution");
  await page.goto("/learn");
  await expect(page.getByTestId("path-map").locator('[data-state="done"]')).toHaveCount(1);
  await expect(page.getByTestId("skills")).not.toContainText(/Chronology\s*not started/);
  await expect(page.getByTestId("learning-days")).toContainText("Learned on 1 of the last 7 days");
});

test("a lesson remembers where you stopped", async ({ page }) => {
  await page.goto("/learn/lesson?id=austria-1848&path=austria");
  await page.getByTestId("continue").click();
  await page.getByTestId("continue").click();
  await expect(page.getByText("3/")).toBeVisible();
  await page.goto("/learn");
  await expect(page.getByTestId("continue-learning")).toContainText("Continue where you stopped");
  await page.getByTestId("continue-learning").getByRole("link").click();
  await expect(page.getByText("3/")).toBeVisible();
  await page.goto("/");
  await expect(page.getByTestId("learn-cta")).toContainText("Continue: The year of revolution");
});

test("a missed question comes back in review, with its explanation", async ({ page }) => {
  await page.goto("/learn/lesson?id=austria-borders&path=austria");
  let missed = false;
  for (let i = 0; i < 6 && !missed; i++) {
    await toNextQuestion(page);
    if (await page.getByTestId("lesson-summary").isVisible()) break;
    missed = !(await answer(page));
    if (!missed) await page.getByTestId("feedback").getByTestId("continue").click();
  }
  test.skip(!missed, "every first option happened to be right");
  await page.goto("/learn/review");
  await expect(page.getByTestId("activity")).toBeVisible();
  await answer(page);
  await expect(page.getByTestId("feedback")).toContainText("Sources");
});

test("an imported lesson is labelled unreviewed and cites Wikidata", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto("/learn/lesson?id=w-europe-18&path=region-europe");
  await expect(page.getByTestId("lesson-intro")).toContainText("Imported", { timeout: 40000 });
  await expect(page.getByTestId("lesson-intro")).toContainText("not checked by hand");
  await page.getByTestId("continue").click();
  await expect(page.getByTestId("learn-card")).toContainText("Wikidata");
  await expect(page.getByTestId("learn-card").getByRole("link", { name: /Wikidata Q\d+/ })).toBeVisible();
});

test("lesson pages fit a phone", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "phone layout");
  for (const path of ["/learn", "/learn/lesson?id=austria-dual&path=austria", "/learn/review"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
