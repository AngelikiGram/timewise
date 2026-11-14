"use client";

import { useState, useCallback } from "react";
import type { LearningActivity, EvidenceGapFindingAnswer, Claim, SupportStatus } from "@timewise/historical-schemas";
import { claimById, sourceById } from "@/lib/collection";

interface EvidenceGapFindingProps {
  activity: LearningActivity;
  currentAnswer?: EvidenceGapFindingAnswer;
  onSubmit: (answer: EvidenceGapFindingAnswer, timeSpentSeconds: number) => void;
  completed: boolean;
  lang: "en" | "de";
}

const t = (text: { en: string; de?: string }, lang: "en" | "de") => lang === "de" && text.de ? text.de : text.en;

const GAP_TYPES = [
  { value: "primary_source", label: { en: "Missing primary source", de: "Fehlende Primärquelle" }, help: { en: "No original document, artifact, or contemporary record directly supports this", de: "Kein originales Dokument, Artefakt oder zeitgenössischer Beleg stützt dies direkt" }},
  { value: "corroboration", label: { en: "Missing corroboration", de: "Fehlende Korroboration" }, help: { en: "Only one source supports this; independent confirmation needed", de: "Nur eine Quelle stützt dies; unabhängige Bestätigung nötig" }},
  { value: "contemporary_account", label: { en: "Missing contemporary account", de: "Fehlender zeitgenössischer Bericht" }, help: { en: "No account from the time period itself; only later descriptions exist", de: "Kein Bericht aus der Zeit selbst; nur spätere Beschreibungen existieren" }},
  { value: "precise_date", label: { en: "Imprecise date", de: "Ungenaues Datum" }, help: { en: "The date is known only to year or decade, not day/month", de: "Das Datum ist nur auf Jahr oder Jahrzehnt bekannt, nicht Tag/Monat" }},
  { value: "precise_location", label: { en: "Imprecise location", de: "Ungenaue Lage" }, help: { en: "The location is approximate, schematic, or inferred", de: "Die Lage ist nur approximativ, schematisch oder geschlussfolgert" }},
] as const;

export function EvidenceGapFinding({ activity, currentAnswer, onSubmit, completed, lang }: EvidenceGapFindingProps) {
  const claims = activity.claimIds.map(id => claimById.get(id)).filter(Boolean) as Claim[];
  const [gaps, setGaps] = useState<Map<string, EvidenceGapFindingAnswer["gaps"][0][]>>(
    currentAnswer ? new Map(currentAnswer.gaps.reduce((acc, g) => {
      const arr = acc.get(g.claimId) ?? [];
      arr.push(g);
      acc.set(g.claimId, arr);
      return acc;
    }, new Map<string, EvidenceGapFindingAnswer["gaps"][0][]>())) : new Map()
  );
  const [startTime] = useState(Date.now());

  const handleGapToggle = useCallback((claimId: string, gapType: string) => {
    if (completed) return;
    const newGaps = new Map(gaps);
    const current = newGaps.get(claimId) ?? [];
    const exists = current.find(g => g.missingEvidenceType === gapType);
    if (exists) {
      newGaps.set(claimId, current.filter(g => g.missingEvidenceType !== gapType));
    } else {
      newGaps.set(claimId, [...current, { claimId, missingEvidenceType: gapType as any }]);
    }
    setGaps(newGaps);
  }, [completed, gaps]);

  const handleSubmit = useCallback(() => {
    if (completed) return;
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const answer: EvidenceGapFindingAnswer = {
      type: "evidence_gap_finding",
      gaps: [...gaps.values()].flat(),
    };
    onSubmit(answer, timeSpent);
  }, [completed, gaps, startTime, onSubmit]);

  const correctGaps = new Map<string, EvidenceGapFindingAnswer["gaps"][0][]>(
    (activity.correctAnswer as EvidenceGapFindingAnswer).gaps.reduce((acc, g) => {
      const arr = acc.get(g.claimId) ?? [];
      arr.push(g);
      acc.set(g.claimId, arr);
      return acc;
    }, new Map<string, EvidenceGapFindingAnswer["gaps"][0][]>())
  );

  const isCorrect = claims.every(claim => {
    const userGaps = gaps.get(claim.id) ?? [];
    const correctClaimGaps = correctGaps.get(claim.id) ?? [];
    return userGaps.length === correctClaimGaps.length &&
      userGaps.every(ug => correctClaimGaps.some(cg => cg.missingEvidenceType === ug.missingEvidenceType));
  });

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-2">
        {lang === "de"
          ? "Für jede Behauptung identifizieren Sie, welche Art von Evidenz fehlt. Mehrere Lücken pro Behauptung möglich."
          : "For each claim, identify what type of evidence is missing. Multiple gaps per claim possible."
        }
      </div>

      <div className="space-y-4">
        {claims.map(claim => {
          const userGaps = gaps.get(claim.id) ?? [];
          const correctClaimGaps = correctGaps.get(claim.id) ?? [];
          const claimCorrect = userGaps.length === correctClaimGaps.length &&
            userGaps.every(ug => correctClaimGaps.some(cg => cg.missingEvidenceType === ug.missingEvidenceType));

          return (
            <div
              key={claim.id}
              className={`p-4 rounded-sm border transition-colors ${
                completed
                  ? (claimCorrect
                      ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
                      : "border-oxblood-300 bg-oxblood-50 dark:border-oxblood-700 dark:bg-oxblood-900/20")
                  : (userGaps.length > 0 ? "border-bronze bg-bronze-50 dark:border-bronze-700 dark:bg-bronze-900/20" : "border-line bg-paper hover:border-bronze")
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                <SupportBadge status={claim.support} />
                <p className="flex-1 font-serif text-base leading-snug text-ink">{t(claim.statement, lang)}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {GAP_TYPES.map(gt => {
                  const isSelected = userGaps.some(g => g.missingEvidenceType === gt.value);
                  const isCorrectGap = correctClaimGaps.some(g => g.missingEvidenceType === gt.value);
                  return (
                    <button
                      key={gt.value}
                      type="button"
                      disabled={completed}
                      onClick={() => handleGapToggle(claim.id, gt.value)}
                      className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${
                        completed
                          ? (isCorrectGap
                              ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
                              : isSelected
                              ? "border-oxblood-300 bg-oxblood-50 dark:border-oxblood-700 dark:bg-oxblood-900/20"
                              : "border-line bg-paper opacity-60")
                          : (isSelected
                              ? "border-bronze-500 bg-bronze-100 dark:border-bronze-600 dark:bg-bronze-900/30"
                              : "border-line bg-paper hover:border-bronze hover:bg-bronze-50")
                      }`}
                      title={t(gt.help, lang)}
                    >
                      {t(gt.label, lang)}
                      {completed && isCorrectGap && (
                        <svg className="ml-1 inline w-3 h-3 text-emerald-600" viewBox="0 0 14 14" fill="currentColor"><path d="M12.5 3.5a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06 0L2 8.56a.75.75 0 0 1 1.06-1.06L5.44 10.5 11.44 4.5a.75.75 0 0 1 1.06 0Z"/></svg>
                      )}
                    </button>
                  );
                })}
              </div>

              {completed && !claimCorrect && (
                <p className="mt-2 text-xs text-oxblood-600 dark:text-oxblood-400">
                  {lang === "de" ? "Fehlende Lücken: " : "Missing gaps: "}
                  {correctClaimGaps.filter(cg => !userGaps.some(ug => ug.missingEvidenceType === cg.missingEvidenceType))
                    .map(cg => t(GAP_TYPES.find(gt => gt.value === cg.missingEvidenceType)!.label, lang)).join(", ")}
                </p>
              )}
              {completed && claimCorrect && userGaps.length > correctClaimGaps.length && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  {lang === "de" ? "Zusätzliche Lücken markiert (nicht falsch, aber nicht erwartet)." : "Extra gaps marked (not wrong, but not expected)."}
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
          >
            {lang === "de" ? "Prüfen" : "Check Answer"}
          </button>
          <button
            type="button"
            onClick={() => setGaps(new Map())}
            className="rounded-sm border border-line px-4 py-2.5 text-sm hover:border-bronze hover:text-bronze"
          >
            {lang === "de" ? "Zurücksetzen" : "Reset"}
          </button>
        </div>
      )}

      {completed && (
        <div className={`p-3 rounded-sm ${isCorrect ? "bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800" : "bg-oxblood-50 border border-oxblood-200 dark:bg-oxblood-900/20 dark:border-oxblood-800"}`}>
          <p className="font-medium">{isCorrect ? (lang === "de" ? "Alle Evidenzlücken korrekt identifiziert!" : "All evidence gaps correctly identified!") : (lang === "de" ? "Einige Lücken fehlen oder sind falsch." : "Some gaps missing or incorrect.")}</p>
        </div>
      )}
    </div>
  );
}

function SupportBadge({ status }: { status: SupportStatus }) {
  const labels: Record<SupportStatus, { en: string; de: string }> = {
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
    <span className="inline-block border px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wider border-navy text-navy dark:border-bronze dark:text-bronze shrink-0">
      {label.en}
    </span>
  );
}