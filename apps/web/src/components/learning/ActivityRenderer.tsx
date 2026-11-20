"use client";

import { ActivityType, LearningActivity, ActivityAnswer } from "@timewise/historical-schemas";
import { TimelineOrdering } from "./TimelineOrdering";
import { MapPlacement } from "./MapPlacement";
import { SourceMatching } from "./SourceMatching";
import { InterpretationRating } from "./InterpretationRating";
import { ChangeDetection } from "./ChangeDetection";
import { EvidenceGapFinding } from "./EvidenceGapFinding";
import { CausalReasoning } from "./CausalReasoning";
import { PerspectiveTaking } from "./PerspectiveTaking";

interface ActivityRendererProps {
  activity: LearningActivity;
  /** User's current answer (for persistence across renders) */
  currentAnswer?: ActivityAnswer;
  /** Called when user submits an answer */
  onSubmit: (answer: ActivityAnswer, timeSpentSeconds: number) => void;
  /** Called when user wants to see explanation without submitting */
  onShowExplanation?: () => void;
  /** Whether the activity has been completed (score = 1.0) */
  completed?: boolean;
  /** Best score so far (0-1) */
  bestScore?: number;
  /** Number of attempts so far */
  attempts?: number;
  /** Language for localized text */
  lang?: "en" | "de";
}

const componentMap: Record<ActivityType, React.ComponentType<any>> = {
  timeline_ordering: TimelineOrdering,
  map_placement: MapPlacement,
  source_matching: SourceMatching,
  interpretation_rating: InterpretationRating,
  change_detection: ChangeDetection,
  evidence_gap_finding: EvidenceGapFinding,
  causal_reasoning: CausalReasoning,
  perspective_taking: PerspectiveTaking,
};

export function ActivityRenderer({
  activity,
  currentAnswer,
  onSubmit,
  onShowExplanation,
  completed = false,
  bestScore = 0,
  attempts = 0,
  lang = "en",
}: ActivityRendererProps) {
  const Component = componentMap[activity.type];
  const t = (text: { en: string; de?: string }) => lang === "de" && text.de ? text.de : text.en;

  if (!Component) {
    return (
      <div className="border border-line bg-paper-2 p-4" role="alert">
        <p className="text-sm text-ink-2">
          Activity type "{activity.type}" not yet implemented.
        </p>
      </div>
    );
  }

  return (
    <article className="border border-line bg-paper-2 rounded-sm overflow-hidden" data-testid={`activity-${activity.type}`}>
      {/* Activity Header */}
      <header className="border-b border-line bg-paper-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="inline-block border px-2 py-0.5 text-xs font-semibold border-navy text-navy dark:border-bronze dark:text-bronze">
            {t(activity.prompt).split(".")[0]} {/* First sentence as label */}
          </span>
          <span className="text-xs text-ink-2">
            {activity.difficulty === "intro" && "🟢 Intro"}
            {activity.difficulty === "core" && "🟡 Core"}
            {activity.difficulty === "advanced" && "🔴 Advanced"}
          </span>
          <span className="text-xs text-ink-2 ml-auto">~{activity.estimatedMinutes} min, +{activity.xpReward} XP</span>
        </div>
        <p className="text-sm leading-relaxed text-ink">{t(activity.prompt)}</p>
      </header>

      {/* Activity Body */}
      <div className="p-4">
        <Component
          activity={activity}
          currentAnswer={currentAnswer}
          onSubmit={onSubmit}
          completed={completed}
          lang={lang}
        />
      </div>

      {/* Progress / Completion Footer */}
      {(completed || attempts > 0) && (
        <footer className="border-t border-line bg-paper-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {completed && (
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                  <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
                </svg>
                Completed! Score: {Math.round(bestScore * 100)}%
              </span>
            )}
            {attempts > 0 && !completed && (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                Attempt {attempts}, Best: {Math.round(bestScore * 100)}%
              </span>
            )}
            {onShowExplanation && !completed && (
              <button
                type="button"
                onClick={onShowExplanation}
                className="text-xs font-medium text-bronze underline-offset-2 hover:underline"
              >
                Show explanation
              </button>
            )}
          </div>
        </footer>
      )}

      {/* Explanation (shown after completion or on demand) */}
      {completed && (
        <div className="border-t border-line bg-paper p-4" data-testid="activity-explanation">
          <h4 className="font-semibold text-sm text-ink-2 mb-2">Why this answer?</h4>
          <p className="text-sm leading-relaxed text-ink">{t(activity.explanation)}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-2">
            <span className="border border-line px-2 py-0.5 rounded-full">Grounded in {activity.claimIds.length} claim(s)</span>
            {activity.eventIds.length > 0 && (
              <span className="border border-line px-2 py-0.5 rounded-full">References {activity.eventIds.length} event(s)</span>
            )}
            <span className="border border-line px-2 py-0.5 rounded-full">Skill: {activity.skillTags.join(", ")}</span>
          </div>
        </div>
      )}
    </article>
  );
}