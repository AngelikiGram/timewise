"use client";

import { useState, useCallback } from "react";
import { LearningActivity, PerspectiveTakingAnswer, HistoricalEvent } from "@timewise/historical-schemas";
import { eventById, formatWhen, placeLabel } from "@/lib/collection";

interface PerspectiveTakingProps {
  activity: LearningActivity;
  currentAnswer?: PerspectiveTakingAnswer;
  onSubmit: (answer: PerspectiveTakingAnswer, timeSpentSeconds: number) => void;
  completed: boolean;
  lang: "en" | "de";
}

const t = (text: { en: string; de?: string }, lang: "en" | "de") => lang === "de" && text.de ? text.de : text.en;

export function PerspectiveTaking({ activity, currentAnswer, onSubmit, completed, lang }: PerspectiveTakingProps) {
  const events = activity.eventIds.map(id => eventById.get(id)).filter(Boolean) as HistoricalEvent[];
  const [comparisons, setComparisons] = useState<PerspectiveTakingAnswer["comparisons"]>(
    currentAnswer?.comparisons ?? events.map(e => ({
      eventId: e.id,
      contemporaryView: "",
      retrospectiveView: "",
      keyDifference: "",
    }))
  );
  const [startTime] = useState(Date.now());

  const updateComparison = useCallback((index: number, field: keyof PerspectiveTakingAnswer["comparisons"][0], value: string) => {
    if (completed) return;
    const newComparisons = [...comparisons];
    newComparisons[index] = { ...newComparisons[index], [field]: value };
    setComparisons(newComparisons);
  }, [completed, comparisons]);

  const handleSubmit = useCallback(() => {
    if (completed) return;
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const answer: PerspectiveTakingAnswer = {
      type: "perspective_taking",
      comparisons: comparisons.filter(c => c.contemporaryView || c.retrospectiveView || c.keyDifference),
    };
    onSubmit(answer, timeSpent);
  }, [completed, comparisons, startTime, onSubmit]);

  const correctComparisons = (activity.correctAnswer as PerspectiveTakingAnswer).comparisons;

  // Check if user covered the key differences mentioned in correct answer
  const isCorrect = comparisons.length === correctComparisons.length &&
    comparisons.every((userComp, i) => {
      const correct = correctComparisons[i];
      // Check that key difference captures the main point
      return userComp.keyDifference.toLowerCase().includes(correct.keyDifference.toLowerCase().split(" ")[0]) ||
             userComp.contemporaryView.length > 20 && userComp.retrospectiveView.length > 20;
    });

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-2">
        {lang === "de"
          ? "Vergleichen Sie, was Zeitgenossen wussten, mit dem heutigen Historikerwissen. Dies ist der Hindsight Mode von TIMEWISE."
          : "Compare what contemporaries knew with modern historical knowledge. This is TIMEWISE's Hindsight Mode."
        }
      </div>

      {/* Hindsight Mode Explanation */}
      <div className="p-3 rounded-sm border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
        <div className="flex items-center gap-2 mb-2">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" className="text-amber-600" aria-hidden>
            <path d="M9 1.5a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0v-3.75A.75.75 0 0 1 9 1.5ZM12.36 3.86a.75.75 0 0 1 1.06 0l2.12 2.12a.75.75 0 0 1-1.06 1.06l-2.12-2.12a.75.75 0 0 1 0-1.06ZM16.5 9a.75.75 0 0 1 .75.75h3.75a.75.75 0 0 1 0 1.5h-3.75A.75.75 0 0 1 16.5 9ZM3.86 12.36a.75.75 0 0 1 0-1.06l2.12-2.12a.75.75 0 0 1 1.06 1.06l-2.12 2.12a.75.75 0 0 1-1.06 0ZM9 15.75a.75.75 0 0 1 .75.75h.008v.008a.75.75 0 0 1-1.5 0v-.008h-.008A.75.75 0 0 1 9 15.75ZM1.5 9a.75.75 0 0 1 .75-.75h3.75a.75.75 0 0 1 0 1.5h-3.75A.75.75 0 0 1 1.5 9ZM3.86 3.86a.75.75 0 0 1 1.06 0l2.12 2.12a.75.75 0 0 1-1.06 1.06l-2.12-2.12a.75.75 0 0 1 0-1.06ZM9 3.75a5.25 5.25 0 1 0 0 10.5 5.25 5.25 0 0 0 0-10.5Z"/>
          </svg>
          <span className="font-medium text-amber-800 dark:text-amber-200">
            {lang === "de" ? "Hindsight Mode: Zeitgenössisch vs. Retrospektiv" : "Hindsight Mode: Contemporary vs. Retrospective"}
          </span>
        </div>
        <p className="text-sm text-amber-700 dark:text-amber-300">
          {lang === "de"
            ? "Zeitgenössischer Modus: Was war zu diesem Zeitpunkt wissbar? Retrospektiver Modus: Was wissen Historiker heute? Der Unterschied zeigt historische Kontingenz."
            : "Contemporary mode: What was knowable at the time? Retrospective mode: What do historians know now? The difference reveals historical contingency."
          }
        </p>
      </div>

      {/* Comparisons */}
      <div className="space-y-6">
        {events.map((event, eventIndex) => {
          const comp = comparisons[eventIndex];
          const correct = correctComparisons.find(c => c.eventId === event.id);
          const eventCorrect = correct && comp.keyDifference.toLowerCase().includes(correct.keyDifference.toLowerCase().split(" ")[0]);

          return (
            <div
              key={event.id}
              className={`p-4 rounded-sm border transition-colors ${
                completed
                  ? (eventCorrect
                      ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
                      : "border-oxblood-300 bg-oxblood-50 dark:border-oxblood-700 dark:bg-oxblood-900/20")
                  : "border-line bg-paper"
              }`}
            >
              <div className="flex items-start gap-3 mb-4">
                <span className="shrink-0 w-10 h-10 rounded-full bg-paper-3 border border-line flex items-center justify-center text-xl">
                  🕐
                </span>
                <div>
                  <p className="font-serif text-base leading-snug">{t(event.title, lang)}</p>
                  <p className="text-xs text-ink-2 mt-0.5">{formatWhen(event.when)} · {placeLabel(event)}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Contemporary View */}
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden></span>
                    {lang === "de" ? "Zeitgenössische Sicht (damals bekannt)" : "Contemporary View (known then)"}
                  </label>
                  <textarea
                    value={comp.contemporaryView}
                    onChange={e => updateComparison(eventIndex, "contemporaryView", e.target.value)}
                    disabled={completed}
                    placeholder={lang === "de"
                      ? "Was wussten Zeitgenossen zu diesem Zeitpunkt? Welche Informationen waren verfügbar?"
                      : "What did contemporaries know at this time? What information was available?"
                    }
                    className="w-full p-3 text-sm border border-line bg-paper rounded-sm resize-none"
                    rows={4}
                  />
                </div>

                {/* Retrospective View */}
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-navy" aria-hidden></span>
                    {lang === "de" ? "Retrospektive Sicht (heutiges Wissen)" : "Retrospective View (modern knowledge)"}
                  </label>
                  <textarea
                    value={comp.retrospectiveView}
                    onChange={e => updateComparison(eventIndex, "retrospectiveView", e.target.value)}
                    disabled={completed}
                    placeholder={lang === "de"
                      ? "Was wissen Historiker heute darüber? Welche Zusammenhänge sind jetzt klar?"
                      : "What do historians know now? What connections are clear in retrospect?"
                    }
                    className="w-full p-3 text-sm border border-line bg-paper rounded-sm resize-none"
                    rows={4}
                  />
                </div>
              </div>

              {/* Key Difference */}
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">
                  {lang === "de" ? "Der entscheidende Unterschied (Key Difference)" : "The Key Difference"}
                </label>
                <textarea
                  value={comp.keyDifference}
                  onChange={e => updateComparison(eventIndex, "keyDifference", e.target.value)}
                  disabled={completed}
                  placeholder={lang === "de"
                    ? "Was ist der wichtigste Unterschied zwischen dem, was damals bekannt war, und dem, was wir heute wissen?"
                    : "What is the most important difference between what was known then and what we know now?"
                  }
                  className="w-full p-3 text-sm border border-line bg-paper rounded-sm resize-none"
                  rows={3}
                />
                {completed && correct && !eventCorrect && (
                  <p className="mt-2 text-xs text-oxblood-600 dark:text-oxblood-400">
                    {lang === "de" ? "Erwarteter Kernunterschied: " : "Expected key difference: "}{correct.keyDifference}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!completed && (
        <div className="flex gap-3 pt-2 justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-sm bg-navy px-4 py-2.5 text-sm font-medium text-on-accent hover:opacity-90 transition-opacity"
            disabled={comparisons.some(c => !c.contemporaryView || !c.retrospectiveView || !c.keyDifference)}
          >
            {lang === "de" ? "Prüfen" : "Check Answer"}
          </button>
        </div>
      )}

      {completed && (
        <div className={`p-3 rounded-sm ${isCorrect ? "bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800" : "bg-oxblood-50 border border-oxblood-200 dark:bg-oxblood-900/20 dark:border-oxblood-800"}`}>
          <p className="font-medium">{isCorrect ? (lang === "de" ? "Alle Perspektiven korrekt erfasst!" : "All perspectives correctly captured!") : (lang === "de" ? "Einige Vergleiche fehlen den Kernunterschied." : "Some comparisons miss the key difference.")}</p>
          <p className="text-sm text-ink-2 mt-1">
            {lang === "de"
              ? "Historische Kontingenz: Zeitgenossen konnten die Zukunft nicht kennen. Hindsight verzerrt unser Verständnis."
              : "Historical contingency: Contemporaries couldn't know the future. Hindsight distorts our understanding."
            }
          </p>
        </div>
      )}
    </div>
  );
}