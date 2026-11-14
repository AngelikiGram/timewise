// Recently opened events, kept in this browser only (no accounts yet). Readers must cope with it being empty.
export type Recent = { id: string; title: string; href: string; context: string; start: string };
const KEY = "tw-recent";

export function recent(): Recent[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Recent[];
  } catch {
    return [];
  }
}

export function remember(item: Recent) {
  try {
    localStorage.setItem(KEY, JSON.stringify([item, ...recent().filter((r) => r.id !== item.id)].slice(0, 8)));
  } catch {
    // Private windows and blocked storage: nothing to remember, nothing breaks.
  }
}
