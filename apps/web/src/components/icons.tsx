// TIMEWISE's own icons: simple line drawings on a 24-unit grid, drawn for this project from basic shapes.
// They use currentColor, so they follow the text colour and both themes. Decorative by default
// (aria-hidden); pass `label` when an icon carries meaning on its own, and pair unfamiliar ones with text.
import type { SVGProps } from "react";

const PATHS = {
  // Kinds of record
  event: "M6 21V4M6 4h10l-2 3.5L16 11H6",
  person: "M12 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5",
  place: "M12 21s-6-6.2-6-11a6 6 0 1 1 12 0c0 4.8-6 11-6 11ZM12 12.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z",
  invention: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1",
  idea: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z",
  // Kinds of link
  cause: "M3 12h5M8 9l3 3-3 3M13 12h5M18 9l3 3-3 3",
  sequence: "M4 7h11M12 4l3 3-3 3M20 17H9M12 14l-3 3 3 3",
  parts: "M3.5 3.5h17v17h-17zM8 8h8v8H8z",
  people: "M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 19c.6-3 2.7-4.6 5.5-4.6S13.4 16 14 19M16 11a2.5 2.5 0 1 0 0-5M17.5 14.6c1.8.4 3 1.9 3.5 4.4",
  checked: "M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6l-7-3ZM8.5 12l2.5 2.5 4.5-5",
  period: "M7 3h10M7 21h10M8 3c0 4 8 5 8 9s-8 5-8 9M16 3c0 4-8 5-8 9",
  country: "M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2zM9 4v14M15 6v14",
  // Categories
  war: "M5 19 19 5M15 5h4v4M5 5l14 14M5 15v4h4",
  politics: "M3 20h18M5 20V10M9.5 20V10M14.5 20V10M19 20V10M2.5 10 12 4l9.5 6Z",
  state: "M5 20V8l7-4 7 4v12M9 20v-5h6v5M3 20h18",
  culture: "M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z",
  health: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10ZM9 11h6M12 8v6",
  disaster: "M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0M12 3l-2.5 5.5h5L12 13",
  railways: "M7 3h10v11H7zM7 9h10M9 14l-3 7M15 14l3 7M7.5 18h9",
  city: "M3 21h18M5 21V9l5-3v15M10 21V4l9 4v13M13 10h3M13 14h3M13 18h3",
  // Interface
  network: "M12 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM5.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM18.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM10.8 8.8 6.8 15M13.2 8.8l4 6.2M8 17.5h8",
  timeline: "M3 12h18M6 9v6M11 7v10M16 10v4M20 8v8",
  map: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14",
  source: "M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6",
  back: "M15 5l-7 7 7 7",
  reset: "M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4",
  forward: "M9 5l7 7-7 7",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v6M12 7.5v.5",
  book: "M4 5c3-1.3 5.5-1.3 8 0v15c-2.5-1.3-5-1.3-8 0zM12 5c2.5-1.3 5-1.3 8 0v15c-3-1.3-5.5-1.3-8 0",
  bookmark: "M6 3h12v18l-6-4-6 4z",
  compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM15.5 8.5l-2 5-5 2 2-5z",
  search: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM15.5 15.5 21 21",
} as const;

export type IconName = keyof typeof PATHS;
/** The raw path, for icons drawn outside React (map markers). */
export const iconPath = (name: IconName) => PATHS[name];

export function Icon({ name, label, size = 20, ...rest }: { name: IconName; label?: string; size?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** The icon for a map category, with a neutral fallback. */
export const categoryIcon = (category: string): IconName => (category in PATHS ? (category as IconName) : "event");
