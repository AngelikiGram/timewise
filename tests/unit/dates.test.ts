import { describe, expect, it } from "vitest";
import { byDate, centuryLabel, centuryOf, formatImportedDate, yearOf } from "../../apps/web/src/lib/dates";

describe("dates with BC years", () => {
  it("reads signed years", () => {
    expect(yearOf("-0490-09-07")).toBe(-490);
    expect(yearOf("1866-07-03")).toBe(1866);
  });

  it("sorts BC before AD, and earlier BC years first", () => {
    const items = [{ start: "0070-01-01" }, { start: "-0480-01-01" }, { start: "-0490-09-07" }, { start: "-0490-01-01" }];
    expect(items.sort(byDate).map((i) => i.start)).toEqual(["-0490-01-01", "-0490-09-07", "-0480-01-01", "0070-01-01"]);
  });

  it("buckets and names centuries on both sides of year 1", () => {
    expect(centuryOf(-480)).toBe(-500);
    expect(centuryOf(-401)).toBe(-500);
    expect(centuryOf(70)).toBe(0);
    expect(centuryLabel(-500)).toBe("5th century BC");
    expect(centuryLabel(0)).toBe("1st century");
    expect(centuryLabel(1800)).toBe("19th century");
  });

  it("never claims more precision than the source", () => {
    expect(formatImportedDate("-0490-09-07", undefined, "day")).toBe("7 September 490 BC");
    expect(formatImportedDate("-0740-01-01", undefined, "decade")).toBe("740s BC");
    expect(formatImportedDate("-0753-01-01", "0476-01-01", "year")).toBe("753 BC – 476");
    expect(formatImportedDate("1230-01-01", undefined, "decade")).toBe("1230s");
  });
});
