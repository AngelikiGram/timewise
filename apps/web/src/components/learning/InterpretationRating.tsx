"use client";

import { useState, useCallback } from "react";
import type { LearningActivity, InterpretationRatingAnswer, SupportStatus, Claim } from "@timewise/historical-schemas";
import { claimById } from "@/lib/collection";

interface InterpretationRatingProps {
  activity: LearningActivity;
  currentAnswer?: InterpretationRatingAnswer;
  onSubmit: (answer: InterpretationRatingAnswer, timeSpentSeconds: number) => void;
  completed: boolean;
  lang: "en" | "de";
}

const t = (text: { en: string; de?: string }, lang: "en" | "de") => lang === "de" && text.de ? text.de : text.en;

const SUPPORT_OPTIONS: { value: SupportStatus; label: { en: string; de: string }; help: { en: string; de: string } }[] = [
  { value: "documented", label: { en: "Documented", de: "Dokumentiert" }, help: { en: "A primary historical record is linked directly", de: "Ein primärer historischer Beleg ist direkt verknüpft" }},
  { value: "corroborated", label: { en: "Corroborated", de: "Korrobiert" }, help: { en: "More than one independent source agrees", de: "Mehrere unabhängige Quellen stimmen überein" }},
  { value: "reference", label: { en: "Reference work", de: "Nachschlagewerk" }, help: { en: "Stated by a reference work; primary record not yet linked", de: "In einem Nachschlagewerk angegeben; Primärbeleg noch nicht verknüpft" }},
  { value: "interpretation", label: { en: "Interpretation", de: "Interpretation" }, help: { en: "A judgement about the past, not a recorded fact", de: "Ein Urteil über die Vergangenheit, keine aufgezeichnete Tatsache" }},
  { value: "disputed", label: { en: "Disputed", de: "Umstritten" }, help: { en: "Accounts or assessments of this conflict", de: "Darstellungen oder Bewertungen widersprechen sich" }},
  { value: "inferred", label: { en: "Inferred", de: "Geschlussfolgert" }, help: { en: "Plausible but not directly verified", de: "Plausibel, aber nicht direkt verifiziert" }},
  { value: "missing", label: { en: "Missing", de: "Fehlend" }, help: { en: "No adequate evidence has been found", de: "Keine hinreichende Evidenz gefunden" }},
];

export function InterpretationRating({ activity, currentAnswer, onSubmit, completed, lang }: InterpretationRatingProps) {
  const claims = activity.claimIds.map(id => claimById.get(id)).filter(Boolean) as Claim[];

  // Also include custom statements from the answer key
  const customStatements = (activity.correctAnswer as InterpretationRatingAnswer).ratings
    .filter(r => !activity.claimIds.includes(r.statementId))
    .map(r => r.statementId);

  const allItems = [
    ...claims.map(c => ({ id: c.id, statement: t(c.statement, lang), isClaim: true, actualSupport: c.support })),
    ...customStatements.map(id => ({ id, statement: id, isClaim: false, actualSupport: null as SupportStatus | null })),
  ];

  const [ratings, setRatings] = useState<Map<string, SupportStatus>>(
    currentAnswer ? new Map(currentAnswer.ratings.map(r => [r.statementId, r.rating])) : new Map()
  );
  const [startTime] = useState(Date.now());

  const handleRating = useCallback((statementId: string, rating: SupportStatus) => {
    if (completed) return;
    const newRatings = new Map(ratings);
    newRatings.set(statementId, rating);
    setRatings(newRatings);
  }, [completed, ratings]);

  const handleSubmit = useCallback(() => {
    if (completed) return;
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const answer: InterpretationRatingAnswer = {
      type: "interpretation_rating",
      ratings: [...ratings.entries()].map(([statementId, rating]) => ({ statementId, rating })),
    };
    onSubmit(answer, timeSpent);
  }, [completed, ratings, startTime, onSubmit]);

  const correctRatings = new Map((activity.correctAnswer as InterpretationRatingAnswer).ratings.map(r => [r.statementId, r.rating]));
  const isFullyRated = allItems.every(item => ratings.has(item.id));
  const isCorrect = isFullyRated && [...ratings.entries()].every(([k, v]) => correctRatings.get(k) === v);

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-2">
        {lang === "de"
          ? "Bewerten Sie jede Aussage nach ihrem Evidenzstatus. Wählen Sie die passende Kategorie."
          : "Rate each statement by its evidentiary status. Select the appropriate category."
        }
      </div>

      <div className="space-y-4">
        {allItems.map(item => {
          const selectedRating = ratings.get(item.id);
          const correctRating = correctRatings.get(item.id);
          const isCorrectlyRated = selectedRating === correctRating;

          return (
            <div
              key={item.id}
              className={`p-4 rounded-sm border transition-colors ${
                completed
                  ? (isCorrectlyRated
                      ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
                      : "border-oxblood-300 bg-oxblood-50 dark:border-oxblood-700 dark:bg-oxblood-900/20")
                  : (selectedRating ? "border-bronze bg-bronze-50 dark:border-bronze-700 dark:bg-bronze-900/20" : "border-line bg-paper hover:border-bronze")
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                <span className="shrink-0 w-8 text-center font-mono text-sm text-ink-2">
                  {item.isClaim ? "📄" : "💭"}
                </span>
                <p className="flex-1 font-serif text-base leading-snug text-ink">{item.statement}</p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {SUPPORT_OPTIONS.map(opt => {
                  const isSelected = selectedRating === opt.value;
                  const isCorrectOpt = correctRating === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={completed}
                      onClick={() => handleRating(item.id, opt.value)}
                      className={`relative p-3 rounded-sm text-left text-xs transition-all ${
                        completed
                          ? (isCorrectOpt
                              ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
                              : isSelected
                              ? "border-oxblood-300 bg-oxblood-50 dark:border-oxblood-700 dark:bg-oxblood-900/20"
                              : "border-line bg-paper opacity-60")
                          : (isSelected
                              ? "border-bronze bg-bronze-100 dark:border-bronze-600 dark:bg-bronze-900/30"
                              : "border-line bg-paper hover:border-bronze hover:bg-bronze-50")
                      }`}
                      title={t(opt.help, lang)}
                    >
                      <div className="font-medium">{t(opt.label, lang)}</div>
                      {completed && isCorrectOpt && (
                        <span className="absolute top-1 right-1 text-emerald-600">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
                            <path d="M12.5 3.5a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06 0L2 8.56a.75.75 0 0 1 1.06-1.06L5.44 10.5 11.44 4.5a.75.75 0 0 1 1.06 0Z"/>
                          </svg>
                        </span>
                      )}
                      {completed && isSelected && !isCorrectOpt && (
                        <span className="absolute top-1 right-1 text-oxblood-600">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
                            <path d="M4.5 4.5a.75.75 0 0 1 1.06 0L7 5.94l1.44-1.44a.75.75 0 1 1 1.06 1.06L8.06 7l1.44 1.44a.75.75 0 1 1-1.06 1.06L7 8.06l-1.44 1.44a.75.75 0 1 1-1.06-1.06L5.94 7 4.5 5.56a.75.75 0 0 1 0-1.06Z"/>
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {completed && selectedRating !== correctRating && (
                <p className="mt-2 text-xs text-oxblood-600 dark:text-oxblood-400">
                  {lang === "de"
                    ? `Richtig: ${t(SUPPORT_OPTIONS.find(o => o.value === correctRating)!.label, lang)}`
                    : `Correct: ${t(SUPPORT_OPTIONS.find(o => o.value === correctRating)!.label, lang)}`
                  }
                </p>
              )}
            </div>
          );
        })}
      </div>

      {!completed && (
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 rounded-sm bg-navy px-4 py-2.5 text-sm font-medium text-on-accent hover:opacity-90 transition-opacity"
            disabled={!isFullyRated}
          >
            {lang === "de" ? "Prüfen" : "Check Answer"}
          </button>
          <button
            type="button"
            onClick={() => setRatings(new Map())}
            className="rounded-sm border border-line px-4 py-2.5 text-sm hover:border-bronze hover:text-bronze"
          >
            {lang === "de" ? "Zurücksetzen" : "Reset"}
          </button>
        </div>
      )}

      {completed && (
        <div className={`p-3 rounded-sm ${isCorrect ? "bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800" : "bg-oxblood-50 border border-oxblood-200 dark:bg-oxblood-900/20 dark:border-oxblood-800"}`}>
          <p className="font-medium">{isCorrect ? (lang === "de" ? "Alle richtig!" : "All correct!") : (lang === "de" ? "Einige Bewertungen sind falsch." : "Some ratings are incorrect.")}</p>
        </div>
      )}
    </div>
  );
}