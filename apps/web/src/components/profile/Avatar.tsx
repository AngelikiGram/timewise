"use client";

import type { ArchetypeId } from "@/lib/explorer";

/**
 * An explorer's emblem: a coloured disc with the character's tool drawn in it, and a ring that turns
 * bronze, silver and gold as the level rises. Drawn here, so it works offline and in dark mode.
 */
const EMBLEM: Record<ArchetypeId, React.ReactNode> = {
  // A compass rose.
  cartographer: <g><path d="M0-19 4.5-4.5 19 0 4.5 4.5 0 19-4.5 4.5-19 0-4.5-4.5Z" /><path d="M0-11 2.5-2.5 11 0 2.5 2.5 0 11-2.5 2.5-11 0-2.5-2.5Z" transform="rotate(45)" opacity=".55" /><circle r="2.6" fill="var(--av-bg)" /></g>,
  // An open book.
  archivist: <g><path d="M-18-11c6-2 12-1 17 3v20c-5-4-11-5-17-3Z" /><path d="M18-11c-6-2-12-1-17 3v20c5-4 11-5 17-3Z" opacity=".75" /></g>,
  // A sealed letter.
  courier: <g><rect x="-17" y="-11" width="34" height="23" rx="2.5" /><path d="M-17-9 0 4 17-9" fill="none" stroke="var(--av-bg)" strokeWidth="2.6" strokeLinejoin="round" /><circle cx="0" cy="6" r="5" fill="var(--av-bg)" /><circle cx="0" cy="6" r="3" /></g>,
  // A ship's wheel.
  navigator: <g fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"><circle r="11" /><circle r="3.5" fill="currentColor" />{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <line key={a} x1="0" y1="-3.5" x2="0" y2="-19" transform={`rotate(${a})`} />)}</g>,
  // A quill.
  scribe: <g><path d="M15-18C3-14-7-4-10 10l3 1C-3 0 5-9 15-18Z" /><path d="M15-18C9-6 2 3-7 11" fill="none" stroke="var(--av-bg)" strokeWidth="1.6" /><path d="M-12 12-15 19" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></g>,
  // A star over a crescent.
  stargazer: <g><path d="M-6 3a13 13 0 1 0 20 10 11 11 0 0 1-20-10Z" transform="translate(-2 -2)" /><path d="M2-18 4.4-11.4 11-11 5.8-6.8 7.6-.4 2-4.2-3.6-.4-1.8-6.8-7-11-.4-11.4Z" /></g>,
};

export function Avatar({ archetype, color, level = 1, size = 56, label }: { archetype: ArchetypeId; color: string; level?: number; size?: number; label?: string }) {
  const ring = level >= 6 ? "#c9a227" : level >= 4 ? "#8a94a3" : level >= 2 ? "#a8743a" : "var(--line)";
  return (
    <svg viewBox="-32 -32 64 64" width={size} height={size} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className="shrink-0" style={{ ["--av-bg" as string]: color }}>
      <circle r="30" fill="var(--paper-2)" stroke={ring} strokeWidth="3" />
      <circle r="25" fill={color} />
      <g fill="#f8faf5" color="#f8faf5">{EMBLEM[archetype]}</g>
    </svg>
  );
}
