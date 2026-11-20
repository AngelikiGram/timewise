"use client";

import Link from "next/link";
import type { StoryCard as Story } from "@/lib/stories";
import { useProgress } from "@/lib/progress";
import { GeometrySketch } from "./visuals";

/** A story at a glance: where, when, how long, how hard, how far you've got, and the question it answers. */
export function StoryCard({ story, large = false }: { story: Story; large?: boolean }) {
  const p = useProgress();
  const saved = p.stories[story.id];
  const pct = saved ? (saved.finished ? 100 : Math.round((Math.min(saved.done ?? saved.step, story.steps) / story.steps) * 100)) : 0;
  const href = saved && !saved.finished && story.kind === "journey" ? `${story.href}?chapter=${saved.chapterId}&step=${saved.step}` : story.href;
  return (
    <Link href={href} className={`card group flex h-full flex-col overflow-hidden ${large ? "lg:flex-row" : ""}`} data-testid="story-card">
      <div className={`relative shrink-0 overflow-hidden bg-paper-3 ${large ? "lg:w-1/2" : ""}`}>
        {story.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={story.image.url} alt={story.image.alt} loading="lazy" className="aspect-[16/9] h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
        ) : (
          <div className="aspect-[16/9] p-6"><GeometrySketch id="m-ringstrasse" label="Today's Ringstrasse in Vienna, drawn from OpenStreetMap" className="[&_figcaption]:hidden [&_svg]:border-0 [&_svg]:bg-transparent" /></div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-paper-2/95 px-2.5 py-1 text-xs font-semibold text-ink shadow-sm">{story.kind === "case" ? "Detective case" : "Guided story"}</span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-medium text-ink-2">
          <span>{story.place}</span> · <span>{story.period}</span> · <span>{story.minutes} min</span> · <span>{story.difficulty}</span>
        </p>
        <h3 className={`mt-2 font-serif leading-tight group-hover:text-bronze ${large ? "text-3xl" : "text-2xl"}`}>{story.title}</h3>
        <p className="mt-2 leading-relaxed text-ink-2"><span className="font-semibold text-ink">The question: </span>{story.question}</p>
        {large && <p className="mt-2 text-sm text-ink-2">{story.chapters.length} chapters: {story.chapters.slice(0, 3).map((c) => c.title).join(" · ")}{story.chapters.length > 3 ? " …" : ""}</p>}
        <div className="mt-auto pt-4">
          {saved ? (
            <div>
              <div className="flex justify-between text-xs text-ink-2"><span>{saved.finished ? "Finished" : "In progress"}</span><span className="tabular-nums">{pct}%</span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
                <div className="h-full rounded-full bg-bronze" style={{ width: `${pct}%` }} />
              </div>
              <span className="mt-3 inline-flex font-semibold text-bronze">{saved.finished ? "Read again" : "Continue"}</span>
            </div>
          ) : (
            <span className="inline-flex font-semibold text-bronze">{story.kind === "case" ? "Open the case" : "Start the story"}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
