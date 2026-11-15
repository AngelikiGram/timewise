import type { Page } from "@playwright/test";

/** On phones the atlas list and filters live in a drawer: open it when it's closed. */
export async function openList(page: Page) {
  const button = page.getByRole("button", { name: /List & filters/ });
  if (await button.isVisible()) await button.click();
}

/** The search box in the page body (the header has a compact one too). */
export const mainSearch = (page: Page) => page.getByRole("main").getByRole("combobox", { name: /Search events/ });
