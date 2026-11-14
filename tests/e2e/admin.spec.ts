import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const adminKey = readFileSync(".env", "utf8").match(/^ADMIN_TOKEN=(.+)$/m)?.[1].trim() ?? "";
const fixture = (action: string) => execFileSync(".venv/Scripts/python", ["tests/e2e/fixture_record.py", action]);

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/admin");
  await page.getByLabel("Admin key").fill(adminKey);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Record review" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "To review" })).toBeVisible();
}

test("a wrong key is refused and shows no records", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("Admin key").fill("wrong-key");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("That key isn't right.")).toBeVisible();
  await expect(page.getByTestId("review-record")).toHaveCount(0);
});

test("real imported records are listed for review", async ({ page }) => {
  await signIn(page);
  await expect(page.getByTestId("review-record").first()).toBeVisible();
  await page.getByLabel("Filter records").fill("Semmeringbahn");
  await expect(page.getByRole("heading", { name: /Semmering/ }).first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test.describe.serial("review decisions", () => {
  // These write to the database, so only one project runs them. Otherwise it could remove the other's fixture.
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "runs once, on desktop"));
  test.beforeAll(({}, info) => {
    if (info.project.name === "desktop") fixture("create");
  });
  test.afterAll(({}, info) => {
    if (info.project.name === "desktop") fixture("remove");
  });

  test("linking puts a record on the site, and removing it takes it off", async ({ page }) => {
    await signIn(page);
    await page.getByLabel("Filter records").fill("E2E fixture");
    const card = page.getByTestId("review-record").filter({ hasText: "E2E fixture record" });
    await card.getByRole("button", { name: "Link to a claim" }).click();
    const save = card.getByRole("button", { name: "Save link" });
    await expect(save).toBeDisabled();
    await card.getByLabel("Event", { exact: true }).selectOption("semmering-1854");
    await card.getByLabel("Claim", { exact: true }).selectOption("c-sem-1");
    await card.getByLabel(/Context/).check();
    await card.getByLabel(/Why\?/).fill("Automated test link, removed straight afterwards.");
    await save.click();
    await expect(card).toHaveCount(0);

    await page.goto("/explore?event=semmering-1854");
    const item = page.getByTestId("archival-material").locator("li").filter({ hasText: "E2E fixture record" });
    await expect(item).toContainText("isn’t shown here because of its rights");
    await expect(item.locator("img")).toHaveCount(0);

    await page.goto("/admin");
    await page.getByRole("tab", { name: "Linked" }).click();
    await page.getByLabel("Filter records").fill("E2E fixture");
    await page.getByRole("button", { name: "Remove link" }).click();
    await expect(page.getByTestId("review-record")).toHaveCount(0);

    await page.goto("/explore?event=semmering-1854");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("E2E fixture record")).toHaveCount(0);
  });

  test("rejecting removes a record from the queue, and it can be reopened", async ({ page }) => {
    await signIn(page);
    await page.getByLabel("Filter records").fill("E2E fixture");
    await page.getByRole("button", { name: "Reject" }).click();
    await expect(page.getByTestId("review-record")).toHaveCount(0);
    await page.getByRole("tab", { name: "Rejected" }).click();
    await page.getByRole("button", { name: "Reopen" }).click();
    await expect(page.getByTestId("review-record")).toHaveCount(0);
    await page.getByRole("tab", { name: "To review" }).click();
    await expect(page.getByTestId("review-record")).toHaveCount(1);
  });
});
