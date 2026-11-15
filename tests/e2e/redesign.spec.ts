import { expect, test } from "@playwright/test";
import { mainSearch, openList } from "./helpers";

test("the five sections are reachable, and the current one is marked", async ({ page }) => {
  for (const [label, path] of [["Stories", "/stories"], ["Challenges", "/challenges"], ["My Collection", "/collection"]] as const) {
    await page.goto(path);
    await expect(page.getByRole("link", { name: label, exact: true }).filter({ visible: true })).toHaveAttribute("aria-current", "page");
  }
  await page.goto("/history/europe");
  await expect(page.getByRole("link", { name: "World Map", exact: true }).filter({ visible: true })).toHaveAttribute("aria-current", "page");
});

test("search says where it looks, and finds world records", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("main").getByTestId("search-scope")).toHaveValue("all");
  await mainSearch(page).fill("Waterloo");
  await expect(page.getByRole("main").getByTestId("search-results")).toContainText("Battle of Waterloo", { timeout: 15000 });
  await page.getByRole("main").getByTestId("search-scope").selectOption("checked");
  await expect(page.getByRole("main").getByText(/Nothing in the checked collection matches/)).toBeVisible();
});

test("a multi-country war is labelled as multiple regions, not one country", async ({ page }) => {
  await page.goto("/atlas?event=Q362");
  await expect(page.getByTestId("atlas-detail")).toContainText("Multiple regions (69 countries)", { timeout: 20000 });
  await expect(page.getByTestId("atlas-detail")).not.toContainText("Afghanistan");
});

test("filters are in the URL, so a view can be shared", async ({ page }) => {
  await page.goto("/atlas/austria?from=1800&to=1899&cat=war");
  await openList(page);
  await expect(page.getByRole("button", { name: /Wars & battles/ })).toHaveAttribute("aria-pressed", "true", { timeout: 15000 });
  const dates = await page.getByTestId("atlas-list").getByRole("button").evaluateAll((els) => els.slice(0, 10).map((e) => e.textContent ?? ""));
  expect(dates.length).toBeGreaterThan(0);
  for (const d of dates) {
    const years = (d.match(/\d{3,4}(?! BC)/g) ?? []).map(Number);
    expect(Math.min(...years), d).toBeLessThanOrEqual(1899);
    expect(Math.max(...years), d).toBeGreaterThanOrEqual(1800);
  }
});

test("an event shows meanwhile, elsewhere, and can be compared with another continent", async ({ page }) => {
  await page.goto("/atlas/austria?event=Q178510");
  const meanwhile = page.getByTestId("meanwhile");
  await expect(meanwhile).toContainText("coincidence in time", { timeout: 20000 });
  await expect(meanwhile.getByRole("link").first()).toBeVisible({ timeout: 15000 });
  await page.getByTestId("meanwhile-compare").selectOption("asia");
  await expect(page.getByTestId("meanwhile-lanes")).toBeVisible();
});

test("an ordering challenge hides dates, explains the answer, and pays XP once", async ({ page }) => {
  await page.goto("/challenges/order-rails", { waitUntil: "networkidle" });
  const challenge = page.getByTestId("challenge");
  await expect(challenge).not.toContainText("1844");
  // Sort it with the keyboard-friendly buttons, using the known dates.
  const order = ["The Southern Railway reaches Graz", "The Semmering railway opens", "Rail over the Brenner"];
  for (let target = 0; target < order.length; target++) {
    for (let guard = 0; guard < 4; guard++) {
      const items = await challenge.getByRole("listitem").allTextContents();
      const at = items.findIndex((t) => t.includes(order[target]));
      if (at === target) break;
      await challenge.getByRole("button", { name: `Move ${order[target]} ${at > target ? "earlier" : "later"}` }).click();
      await expect.poll(async () => (await challenge.getByRole("listitem").allTextContents()).findIndex((t) => t.includes(order[target]))).not.toBe(at);
    }
  }
  await challenge.getByRole("button", { name: "Check my order" }).click();
  await expect(page.getByTestId("challenge-result")).toContainText("all correct");
  await expect(page.getByTestId("challenge-result")).toContainText("+10 XP");
  await expect(page.getByTestId("challenge-result")).toContainText("1844");
  await page.getByRole("button", { name: "Try again" }).click();
  await challenge.getByRole("button", { name: "Check my order" }).click();
  await expect(page.getByTestId("challenge-result")).not.toContainText("XP:");
  await expect(page.getByTestId("challenge-result")).toContainText(/No XP|already earned/);
});

test("the detective case allows 'it can't be settled' and explains every answer", async ({ page }) => {
  await page.goto("/challenges/case/ringstrasse");
  await page.getByRole("button", { name: "Examine the evidence" }).click();
  await page.getByText("Exhibit B: the opening").click();
  await expect(page.getByText(/1 May 1865/).first()).toBeVisible();
  await page.getByRole("button", { name: /seen the evidence|Continue/ }).click();
  await page.getByText(/no single answer/).click();
  await page.getByRole("button", { name: "Give my verdict" }).click();
  await expect(page.getByTestId("case-explanation")).toContainText("Case closed");
  await expect(page.getByTestId("case-explanation")).toContainText("Not supported");
});

test("a saved event appears in My Collection, and can be grouped and shared", async ({ page }) => {
  await page.goto("/atlas/austria?event=Q178510");
  await page.getByTestId("save-button").click();
  await expect(page.getByTestId("save-button")).toHaveAttribute("aria-pressed", "true");
  await page.goto("/collection");
  await expect(page.getByTestId("bookmarks")).toContainText("Battle of Mohács");
  await page.getByLabel("New collection name").fill("Battles");
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByLabel(/Add Battle of Mohács to a collection/).selectOption({ label: "Battles" });
  await expect(page.getByTestId("collection")).toContainText("Battle of Mohács");
});

test("a story remembers where you stopped", async ({ page }) => {
  await page.goto("/journeys/austria-1848-1921");
  await expect(page.getByTestId("atlas-map")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByTestId("journey-event")).toContainText("The October Uprising");
  await page.getByRole("button", { name: "Next chapter" }).click();
  await expect(page.getByTestId("journey-question")).toHaveText("How did a railway cross a mountain range?");
  await page.goto("/journeys/austria-1848-1921");
  await expect(page.getByTestId("resume")).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByTestId("journey-question")).toHaveText("How did a railway cross a mountain range?");
  await page.goto("/stories");
  await expect(page.getByTestId("story-card").first()).toContainText("Continue");
});

test("the plans page sells nothing", async ({ page }) => {
  await page.goto("/plans");
  await expect(page.getByText("Nothing is for sale.")).toBeVisible();
  await expect(page.getByRole("button", { name: /buy|subscribe|checkout/i })).toHaveCount(0);
});
