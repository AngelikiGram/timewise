import { expect, test } from "@playwright/test";

test("complete user flow: event → timeline → map → evidence → place DNA → inspector", async ({ page }, info) => {
  // The phone layout shows one panel at a time behind tabs, so "all panels visible" only applies on desktop.
  test.skip(info.project.name === "mobile", "checks several panels visible at once");
  // Start on explore page with a specific event
  await page.goto("/explore?event=vienna-march-1848");
  await expect(page.getByTestId("event-list")).toBeVisible();
  await expect(page.getByTestId("atlas-map")).toBeVisible();
  await expect(page.getByTestId("evidence-panel")).toBeVisible();
  await expect(page.getByTestId("evidence-inspector")).toBeVisible();

  // Verify URL updated with event
  const url1 = new URL(page.url());
  expect(url1.searchParams.get("event")).toBe("vienna-march-1848");

  // 1. Click on timeline event to navigate to a different event
  await page.locator('[data-event="sarajevo-1914"]').click();
  await page.waitForURL(/event=sarajevo-1914/);

  const url2 = new URL(page.url());
  expect(url2.searchParams.get("event")).toBe("sarajevo-1914");

  // 2. On desktop, map is already visible. Click a map marker.
  await page.mouse.click(400, 300); // Click somewhere on map
  await page.waitForTimeout(500);

  // 3. Verify all panels are visible (they're all rendered on desktop)
  await expect(page.getByTestId("evidence-panel")).toBeVisible();
  await expect(page.getByTestId("evidence-inspector")).toBeVisible();

  // 4. Place DNA is only visible when a place is selected via URL
  // Load with place param
  await page.goto("/explore?event=sarajevo-1914&place=vienna");
  await expect(page.getByTestId("place-dna")).toBeVisible();
  await expect(page.getByTestId("evidence-panel")).toBeVisible();
  await expect(page.getByTestId("evidence-inspector")).toBeVisible();

  // 5. Verify URL persistence after refresh
  const finalUrl = new URL(page.url());
  await page.reload();
  await expect(page.getByTestId("event-list")).toBeVisible();

  const reloadedUrl = new URL(page.url());
  // Key state params should persist
  expect(reloadedUrl.searchParams.get("event")).toBe(finalUrl.searchParams.get("event"));
  expect(reloadedUrl.searchParams.get("place")).toBe(finalUrl.searchParams.get("place"));
});

test("URL state persistence for all params", async ({ page }, info) => {
  // The phone layout shows one panel at a time behind tabs, so "all panels visible" only applies on desktop.
  test.skip(info.project.name === "mobile", "checks several panels visible at once");
  // Load with multiple URL params - use correct IDs from collection
  await page.goto("/explore?event=sarajevo-1914&theme=politics&mode=split&compare=1918-11-11&evidence=inferred&place=vienna");
  await expect(page.getByTestId("event-list")).toBeVisible();
  await page.waitForTimeout(1000);

  const url = new URL(page.url());
  expect(url.searchParams.get("event")).toBe("sarajevo-1914");
  expect(url.searchParams.get("theme")).toBe("politics");
  expect(url.searchParams.get("mode")).toBe("split");
  expect(url.searchParams.get("compare")).toBe("1918-11-11");
  expect(url.searchParams.get("evidence")).toBe("inferred");
  expect(url.searchParams.get("place")).toBe("vienna");

  // Reload and verify persistence
  await page.reload();
  await expect(page.getByTestId("event-list")).toBeVisible();
  await page.waitForTimeout(1000);

  const reloadedUrl = new URL(page.url());
  expect(reloadedUrl.searchParams.get("event")).toBe("sarajevo-1914");
  expect(reloadedUrl.searchParams.get("theme")).toBe("politics");
  expect(reloadedUrl.searchParams.get("mode")).toBe("split");
  expect(reloadedUrl.searchParams.get("compare")).toBe("1918-11-11");
  expect(reloadedUrl.searchParams.get("evidence")).toBe("inferred");
  expect(reloadedUrl.searchParams.get("place")).toBe("vienna");
});