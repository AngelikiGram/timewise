"use client";

import { useState, useCallback } from "react";
import { LearningActivity, SourceMatchingAnswer, Claim } from "@timewise/historical-schemas";
import { claimById, sourceById } from "@/lib/collection";

interface SourceMatchingProps {
  activity: LearningActivity;
  currentAnswer?: SourceMatchingAnswer;
  onSubmit: (answer: SourceMatchingAnswer, timeSpentSeconds: number) => void;
  completed: boolean;
  lang: "en" | "de";
}

const t = (text: { en: string; de?: string }, lang: "en" | "de") => lang === "de" && text.de ? text.de : text.en;

export function SourceMatching({ activity, currentAnswer, onSubmit, completed, lang }: SourceMatchingProps) {
  const claims = activity.claimIds.map(id => claimById.get(id)).filter(Boolean) as Claim[];
  const [matches, setMatches] = useState<Map<string, string>>(
    currentAnswer ? new Map(currentAnswer.matches.map(m => [m.claimId, m.sourceId])) : new Map()
  );
  const [startTime] = useState(Date.now());

  const allSources = new Set(claims.flatMap(c => c.evidence.map(e => e.sourceId)));
  const sourceList = [...allSources].map(id => sourceById.get(id)!).filter(Boolean);

  const handleMatch = useCallback((claimId: string, sourceId: string) => {
    if (completed) return;
    const newMatches = new Map(matches);
    newMatches.set(claimId, sourceId);
    setMatches(newMatches);
  }, [completed, matches]);

  const handleSubmit = useCallback(() => {
    if (completed) return;
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const answer: SourceMatchingAnswer = {
      type: "source_matching",
      matches: [...matches.entries()].map(([claimId, sourceId]) => {
        const claim = claimById.get(claimId)!;
        const evidence = claim.evidence.find(e => e.sourceId === sourceId);
        return {
          claimId,
          sourceId,
          locator: evidence?.locator ?? "",
        };
      }),
    };
    onSubmit(answer, timeSpent);
  }, [completed, matches, startTime, onSubmit]);

  const correctMatches = new Map((activity.correctAnswer as SourceMatchingAnswer).matches.map(m => [m.claimId, m.sourceId]));
  const isFullyMatched = claims.every(c => matches.has(c.id));
  const isCorrect = isFullyMatched && [...matches.entries()].every(([k, v]) => correctMatches.get(k) === v);

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-2">
        {lang === "de"
          ? "Ordnen Sie jeder Behauptung die passende Quelle zu. Ziehen oder klicken Sie."
          : "Match each claim to its supporting source. Drag or click to connect."
        }
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Claims Column */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-ink-2">
            {lang === "de" ? "Behauptungen" : "Claims"}
          </h4>
          {claims.map(claim => {
            const matchedSourceId = matches.get(claim.id);
            const isMatched = !!matchedSourceId;
            const isCorrectMatch = isMatched && correctMatches.get(claim.id) === matchedSourceId;
            const source = matchedSourceId ? sourceById.get(matchedSourceId) : null;

            return (
              <div
                key={claim.id}
                className={`p-3 rounded-sm border transition-colors ${
                  completed
                    ? (isCorrectMatch
                        ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
                        : "border-oxblood-300 bg-oxblood-50 dark:border-oxblood-700 dark:bg-oxblood-900/20")
                    : (isMatched ? "border-bronze bg-bronze-50 dark:border-bronze-700 dark:bg-bronze-900/20" : "border-line bg-paper hover:border-bronze")
                }`}
              >
                <p className="font-serif text-sm leading-snug mb-2">{t(claim.statement, lang)}</p>
                <div className="flex items-center gap-2 text-xs">
                  <SupportBadge status={claim.support} />
                  {isMatched && source && (
                    <span className="text-ink-2 flex-1 truncate">
                      → {source.title} ({source.provider})
                    </span>
                  )}
                  {!isMatched && !completed && (
                    <span className="text-ink-2 italic">{lang === "de" ? "Ziehen Sie eine Quelle hierher" : "Drag a source here"}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sources Column */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-ink-2">
            {lang === "de" ? "Quellen" : "Sources"}
          </h4>
          {sourceList.map(source => {
            const isUsed = [...matches.values()].includes(source.id);
            const matchedClaimId = [...matches.entries()].find(([, v]) => v === source.id)?.[0];
            const isCorrectlyMatched = matchedClaimId && correctMatches.get(matchedClaimId) === source.id;

            return (
              <div
                key={source.id}
                className={`p-3 rounded-sm border transition-colors cursor-grab active:cursor-grabbing ${
                  completed
                    ? (isCorrectlyMatched
                        ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
                        : isUsed
                        ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
                        : "border-line bg-paper opacity-60")
                    : (isUsed ? "border-bronze bg-bronze-50 dark:border-bronze-700 dark:bg-bronze-900/20" : "border-line bg-paper hover:border-bronze")
                }`}
                draggable={!completed}
                onDragStart={e => {
                  if (!completed) e.dataTransfer.setData("sourceId", source.id);
                }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  if (!completed) {
                    const sourceId = e.dataTransfer.getData("sourceId");
                    // Find which claim this is being dropped on - handled by claim drop zone
                  }
                }}
                onClick={() => {
                  // Click to select, then click claim to match
                  if (!completed && !isUsed) {
                    (window as any).__pendingSource = source.id;
                  }
                }}
              >
                <p className="font-medium text-sm">{source.title}</p>
                <p className="text-xs text-ink-2">{source.provider}, {source.language}</p>
                <p className="text-xs text-ink-2 mt-1">Rights: {source.rights}</p>
                {completed && matchedClaimId && (
                  <span className={`inline-block mt-1 text-xs ${isCorrectlyMatched ? "text-emerald-600" : "text-oxblood-600"}`}>
                    {isCorrectlyMatched ? "✓ Correct" : "✗ Incorrect match"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!completed && (
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 rounded-sm bg-navy px-4 py-2.5 text-sm font-medium text-on-accent hover:opacity-90 transition-opacity"
            disabled={matches.size !== claims.length}
          >
            {lang === "de" ? "Prüfen" : "Check Answer"}
          </button>
          <button
            type="button"
            onClick={() => setMatches(new Map())}
            className="rounded-sm border border-line px-4 py-2.5 text-sm hover:border-bronze hover:text-bronze"
          >
            {lang === "de" ? "Zurücksetzen" : "Reset"}
          </button>
        </div>
      )}

      {completed && (
        <div className={`p-3 rounded-sm ${isCorrect ? "bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800" : "bg-oxblood-50 border border-oxblood-200 dark:bg-oxblood-900/20 dark:border-oxblood-800"}`}>
          <p className="font-medium">{isCorrect ? (lang === "de" ? "Alle richtig!" : "All correct!") : (lang === "de" ? "Einige Zuordnungen sind falsch." : "Some matches are incorrect.")}</p>
          <p className="text-sm text-ink-2 mt-1">
            {lang === "de"
              ? "Überprüfen Sie die farbigen Markierungen oben."
              : "Check the colored markers above."
            }
          </p>
        </div>
      )}
    </div>
  );
}

function SupportBadge({ status }: { status: Claim["support"] }) {
  const labels: Record<Claim["support"], { en: string; de: string }> = {
    documented: { en: "Documented", de: "Dokumentiert" },
    corroborated: { en: "Corroborated", de: "Korrobiert" },
    reference: { en: "Reference", de: "Nachschlagewerk" },
    interpretation: { en: "Interpretation", de: "Interpretation" },
    disputed: { en: "Disputed", de: "Umstritten" },
    inferred: { en: "Inferred", de: "Geschlussfolgert" },
    missing: { en: "Missing", de: "Fehlend" },
  };
  const label = labels[status];
  return (
    <span className="inline-block border px-1.5 py-0.5 text-xs font-semibold border-navy text-navy dark:border-bronze dark:text-bronze">
      {label.en}
    </span>
  );
}