// Dates from the imports are ISO strings with historical year numbering: "-0490-09-07" is 490 BC.
// There is no year 0, so string order isn't date order: compare with sortKey.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export type Precision = "day" | "month" | "year" | "decade" | "century";

/** Signed year: -490 for 490 BC. */
export function yearOf(iso: string): number {
  return iso.startsWith("-") ? -Number(iso.slice(1, 5)) : Number(iso.slice(0, 4));
}

export function sortKey(iso: string): number {
  const [m, d] = iso.replace(/^-/, "").split("-").slice(1).map(Number);
  // BC years count down, so 490 BC sorts before 480 BC; month and day still count up within a year.
  const y = yearOf(iso);
  return (y < 0 ? y + 1 : y) * 10000 + (m || 1) * 100 + (d || 1);
}

export const byDate = <T extends { start: string }>(a: T, b: T) => sortKey(a.start) - sortKey(b.start);

export function formatYear(y: number): string {
  return y < 0 ? `${-y} BC` : String(y);
}

/** Buckets years by century: -500 holds 500 BC to 401 BC, 1800 holds 1800 to 1899. */
export function centuryOf(y: number): number {
  return y < 0 ? -Math.ceil(-y / 100) * 100 : Math.floor(y / 100) * 100;
}

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${s}`;
}

/** "5th century BC", "19th century". */
export function centuryLabel(c: number, short = false): string {
  const word = short ? "c." : "century";
  return c < 0 ? `${ordinal(-c / 100)} ${word} BC` : `${ordinal(c / 100 + 1)} ${word}`;
}

/** Never shows more precision than the source gave. */
export function formatImportedDate(start: string, end: string | undefined, precision: Precision): string {
  const year = yearOf(start);
  const [m, d] = start.replace(/^-/, "").split("-").slice(1).map(Number);
  const y = formatYear(year);
  const first =
    precision === "day" ? `${d} ${MONTHS[m - 1]} ${y}`
    : precision === "month" ? `${MONTHS[m - 1]} ${y}`
    : precision === "year" ? y
    : precision === "decade" ? (year < 0 ? `${Math.floor(-year / 10) * 10}s BC` : `${Math.floor(year / 10) * 10}s`)
    : centuryLabel(centuryOf(year));
  if (end && yearOf(end) !== year) return `${first} – ${formatYear(yearOf(end))}`;
  return first;
}
