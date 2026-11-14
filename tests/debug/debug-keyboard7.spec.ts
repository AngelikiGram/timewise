import { expect, test } from "@playwright/test";

test("debug keyboard 7", async ({ page }) => {
  const logs: string[] = [];
  page.on("console", (msg) => logs.push(`${msg.type()}: ${msg.text()}`));
  
  await page.goto("/explore");
  await expect(page.getByTestId("timeline-year")).toHaveText("1844");
  
  // Call selectEvent directly via the store
  await page.evaluate(() => {
    // @ts-ignore
    const store = window.useAtlas?.getState?.();
    console.log('Store:', store);
  });
  
  await page.getByRole("slider").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("timeline-year")).toHaveText("1848");
  
  // Try calling selectEvent for the last event
  await page.evaluate(() => {
    // @ts-ignore
    const { selectEvent, allEvents, themes, visibleEvents } = window.useAtlas?.getState?.();
    if (selectEvent && allEvents) {
      const list = visibleEvents(allEvents, themes).filter((e: any) => e.when.start).sort((a: any, b: any) => a.when.start.localeCompare(b.when.start));
      console.log('List length:', list.length, 'last:', list[list.length - 1]?.id);
      if (list.length) selectEvent(list[list.length - 1].id);
    }
  });
  await page.waitForTimeout(500);
  
  const year = await page.getByTestId("timeline-year").textContent();
  console.log("Final year:", year);
  console.log("LOGS:", logs.join("\n"));
});
