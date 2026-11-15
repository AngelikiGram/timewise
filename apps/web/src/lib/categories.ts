import type { Appearance } from "@/components/ThemeToggle";

export const CATEGORY_LABELS: Record<string, string> = {
  war: "Wars & battles",
  politics: "Politics",
  state: "States & empires",
  culture: "Culture & institutions",
  health: "Epidemics",
  disaster: "Disasters",
  railways: "Railways",
  city: "Urban change",
};

/**
 * One colour per category, for the parchment and the night theme. The map paints these directly;
 * the same values are CSS variables (--cat-*) in globals.css for charts. Keep the two in step.
 * Avoids red-green combination for accessibility.
 */
export const CATEGORY_COLORS: Record<Appearance, Record<string, string>> = {
  light: { war: "#a3322a", politics: "#2f5d9a", state: "#7a4a9a", culture: "#b07510", health: "#0f7b80", disaster: "#8a6027", railways: "#4f6475", city: "#9a4f6b" },
  dark: { war: "#ff7a66", politics: "#7fa8ec", state: "#c9a0f0", culture: "#f2c14e", health: "#5fd0d4", disaster: "#d6ad66", railways: "#a9bccb", city: "#f09ac0" },
};

/** Order used in charts and legends: conflict first, then states and politics, then the rest. */
export const CATEGORY_ORDER = ["war", "state", "politics", "culture", "health", "disaster", "railways", "city"];

export const categoryVar = (c: string) => `var(--cat-${CATEGORY_ORDER.includes(c) ? c : "other"})`;

/** A letter for each category, drawn inside map points and beside legend swatches, so colour is never the only cue. */
export const CATEGORY_GLYPH: Record<string, string> = {
  war: "W", politics: "P", state: "S", culture: "C", health: "H", disaster: "D", railways: "R", city: "U",
};
