"use client";

import { useEffect, useRef, useState } from "react";
import { GROUPS, KIND_LABEL, type Group, type Link, type NodeFacts, type RecordData } from "@/lib/record";
import { formatYear } from "@/lib/dates";

export const GROUP_ORDER: Group[] = ["cause", "sequence", "parts", "people", "places", "ideas", "checked", "period", "country"];
const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Split a title into at most three lines of about `width` characters. */
function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if ((line + " " + word).trim().length > width && line) {
      lines.push(line);
      line = word;
    } else line = `${line} ${word}`.trim();
  }
  if (line) lines.push(line);
  return lines.length > 3 ? [...lines.slice(0, 2), short(lines.slice(2).join(" "), width)] : lines;
}

/**
 * The record in the middle, its links around it, grouped by why they're connected. Documented links are
 * solid lines; contextual ones are dashed and amber. Every line carries its relation as text, so neither
 * colour nor dash is the only cue.
 */
export function NetworkGraph({ record, links, facts, selected, onSelect, onOpen }: {
  record: RecordData;
  links: Link[];
  facts: Record<string, NodeFacts>;
  selected?: string;
  onSelect: (target: string) => void;
  onOpen: (link: Link) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(320, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const narrow = width < 640;
  const W = width;
  const H = narrow ? 600 : 600;
  const cx = W / 2;
  const cy = H / 2;
  const rx = Math.max(48, W / 2 - (narrow ? 100 : 175));
  const ry = H / 2 - 56;
  const labelChars = narrow ? 11 : 26;

  // Angles: nodes sorted by group, with a gap between groups so each group reads as a sector.
  const groups = GROUP_ORDER.filter((g) => links.some((l) => l.group === g));
  const slots = links.length + groups.length;
  const step = (Math.PI * 2) / Math.max(slots, 1);
  let slot = 0;
  const placed = groups.flatMap((g) => {
    const members = links.filter((l) => l.group === g);
    const out = members.map((l, i) => {
      const a = -Math.PI / 2 + (slot + i) * step;
      const ring = links.length > 14 && i % 2 === 1 ? 0.72 : 1;
      return { link: l, a, ring, x: cx + Math.cos(a) * rx * ring, y: cy + Math.sin(a) * ry * ring };
    });
    slot += members.length + 1;
    return out;
  });

  const centerLines = wrap(record.label, narrow ? 14 : 18);

  return (
    <div ref={box} className="relative w-full min-w-0 overflow-hidden" data-testid="network-graph">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full select-none" role="group" aria-label={`${record.label} and ${links.length} connected records`}>
        {/* Lines first, so nodes and labels sit on top. */}
        {placed.map(({ link, x, y }) => {
          const on = link.target === selected;
          return (
            <line
              key={`l-${link.target}`}
              x1={cx} y1={cy} x2={x} y2={y}
              stroke={link.documented ? "var(--navy)" : "var(--bronze)"}
              strokeOpacity={selected && !on ? 0.25 : 0.7}
              strokeWidth={on ? 2.5 : 1.25}
              strokeDasharray={link.documented ? undefined : "5 5"}
            />
          );
        })}
        {placed.map(({ link, x, y, a, ring }) => {
          const on = link.target === selected;
          const t = 0.58;
          const mx = cx + (x - cx) * t;
          const my = cy + (y - cy) * t;
          const cos = Math.cos(a);
          // Inner-ring labels go sideways, so they never sit on top of an outer neighbour's label.
          const anchor = cos > 0.25 || (ring < 1 && cos >= 0) ? "start" : cos < -0.25 || ring < 1 ? "end" : "middle";
          const dx = anchor === "start" ? 13 : anchor === "end" ? -13 : 0;
          const dy = anchor === "middle" ? (Math.sin(a) > 0 ? 24 : -16) : 5;
          const year = facts[link.target]?.year;
          return (
            <g
              key={`n-${link.target}`}
              role="button"
              tabIndex={0}
              aria-pressed={on}
              aria-label={`${link.label}: ${link.relation}, ${link.documented ? "documented" : "contextual, not a documented relationship"}`}
              data-node={link.target}
              data-documented={link.documented}
              onClick={() => onSelect(link.target)}
              onDoubleClick={() => onOpen(link)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (on) onOpen(link);
                  else onSelect(link.target);
                }
              }}
              className="tw-pop cursor-pointer outline-none [&:focus-visible_circle]:stroke-[var(--bronze)] [&:focus-visible_circle]:stroke-[4]"
            >
              {(!narrow || on) && (
                <text x={mx} y={my} textAnchor="middle" className="fill-ink-2 text-[11px]" paintOrder="stroke" stroke="var(--paper)" strokeWidth={4} strokeLinejoin="round" opacity={selected && !on ? 0.4 : 1}>
                  {link.relation.length > 30 ? short(link.relation, 30) : link.relation}
                </text>
              )}
              <circle cx={x} cy={y} r={on ? 11 : 8} fill={link.documented ? "var(--navy)" : "var(--paper-2)"} stroke={link.documented ? "var(--paper-2)" : "var(--bronze)"} strokeWidth={link.documented ? 2 : 2.5} />
              {link.group === "checked" && <circle cx={x} cy={y} r={15} fill="none" stroke="var(--navy)" strokeWidth={1.25} />}
              <circle cx={x} cy={y} r={22} fill="transparent" />
              <text x={x + dx} y={y + dy} textAnchor={anchor} className={`${narrow ? "text-[12px]" : "text-[13px]"} ${on ? "fill-ink font-semibold" : "fill-ink"}`} paintOrder="stroke" stroke="var(--paper)" strokeWidth={4} strokeLinejoin="round">
                {short(link.label, anchor === "middle" ? Math.min(labelChars, 18) : labelChars)}
                {year !== undefined && !narrow && <tspan className="fill-ink-2 text-[11px]"> {formatYear(year)}</tspan>}
              </text>
            </g>
          );
        })}
        <g data-node="center">
          <circle cx={cx} cy={cy} r={narrow ? 54 : 66} fill="var(--paper-2)" stroke="var(--bronze)" strokeWidth={3} />
          <circle cx={cx} cy={cy} r={narrow ? 61 : 74} fill="none" stroke="var(--bronze)" strokeOpacity={0.35} strokeWidth={1} />
          {centerLines.map((line, i) => (
            <text key={i} x={cx} y={cy - (centerLines.length - 1) * 9 + i * 18 - 6} textAnchor="middle" className={`fill-ink font-serif ${narrow ? "text-[14px]" : "text-[16px]"} font-semibold`}>{line}</text>
          ))}
          <text x={cx} y={cy + (centerLines.length - 1) * 9 + 18} textAnchor="middle" className="fill-ink-2 text-[11px]">
            {record.when.text ? short(record.when.text, narrow ? 18 : 26) : KIND_LABEL[record.kind]}
          </text>
        </g>
      </svg>
      {!links.length && (
        <p className="absolute inset-x-0 bottom-6 text-center text-sm text-ink-2">No links match these filters.</p>
      )}
      <p className="sr-only">Groups shown: {groups.map((g) => GROUPS[g].label).join(", ")}.</p>
    </div>
  );
}
