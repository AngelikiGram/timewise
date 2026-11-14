"use client";

import { useState, useCallback } from "react";
import type { LearningActivity, CausalReasoningAnswer, HistoricalEvent } from "@timewise/historical-schemas";
import { eventById, formatWhen, placeLabel } from "@/lib/collection";

interface CausalReasoningProps {
  activity: LearningActivity;
  currentAnswer?: CausalReasoningAnswer;
  onSubmit: (answer: CausalReasoningAnswer, timeSpentSeconds: number) => void;
  completed: boolean;
  lang: "en" | "de";
}

const t = (text: { en: string; de?: string }, lang: "en" | "de") => lang === "de" && text.de ? text.de : text.en;

const CONFIDENCE_LEVELS = [
  { value: "explicit_in_sources", label: { en: "Explicit in sources", de: "Explizit in Quellen" }, color: "emerald", help: { en: "Sources directly state this causal link", de: "Quellen benennen diesen kausalen Link direkt" }},
  { value: "plausible_inference", label: { en: "Plausible inference", de: "Plausible Schlussfolgerung" }, color: "amber", help: { en: "Temporal proximity and context suggest causation, but sources don't state it", de: "Zeitliche Nähe und Kontext deuten auf Kausalität hin, Quellen benennen sie nicht" }},
  { value: "speculative", label: { en: "Speculative", de: "Spekulativ" }, color: "oxblood", help: { en: "No evidence for causation; merely chronological sequence", de: "Kein Beleg für Kausalität; bloß zeitliche Folge" }},
] as const;

export function CausalReasoning({ activity, currentAnswer, onSubmit, completed, lang }: CausalReasoningProps) {
  const events = activity.eventIds.map(id => eventById.get(id)).filter(Boolean) as HistoricalEvent[];
  const [chains, setChains] = useState<CausalReasoningAnswer["chains"]>(
    currentAnswer?.chains ?? []
  );
  const [startTime] = useState(Date.now());

  const addChain = useCallback(() => {
    if (completed) return;
    setChains([...chains, { causeEventId: "", effectEventId: "", confidence: "speculative", note: "" }]);
  }, [completed, chains]);

  const updateChain = useCallback((index: number, field: keyof CausalReasoningAnswer["chains"][0], value: any) => {
    if (completed) return;
    const newChains = [...chains];
    newChains[index] = { ...newChains[index], [field]: value };
    setChains(newChains);
  }, [completed, chains]);

  const removeChain = useCallback((index: number) => {
    if (completed) return;
    setChains(chains.filter((_, i) => i !== index));
  }, [completed, chains]);

  const handleSubmit = useCallback(() => {
    if (completed) return;
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const answer: CausalReasoningAnswer = {
      type: "causal_reasoning",
      chains: chains.filter(c => c.causeEventId && c.effectEventId && c.causeEventId !== c.effectEventId),
    };
    onSubmit(answer, timeSpent);
  }, [completed, chains, startTime, onSubmit]);

  const correctChains = (activity.correctAnswer as CausalReasoningAnswer).chains;

  // Simple correctness check: each user chain must match a correct chain in cause, effect, and confidence
  const isCorrect = chains.length === correctChains.length &&
    chains.every(userChain => correctChains.some(correct =>
      correct.causeEventId === userChain.causeEventId &&
      correct.effectEventId === userChain.effectEventId &&
      correct.confidence === userChain.confidence
    ));

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-2">
        {lang === "de"
          ? "Bauen Sie kausale Ketten zwischen den Ereignissen. Wählen Sie Ursache, Wirkung und Ihr Vertrauen in den kausalen Link."
          : "Build causal chains between events. Select cause, effect, and your confidence in the causal link."
        }
      </div>

      {/* Event Reference */}
      <details className="border border-line rounded-sm bg-paper-2">
        <summary className="p-3 cursor-pointer font-medium text-sm">{lang === "de" ? "Ereignis-Referenz anzeigen" : "Show Event Reference"}</summary>
        <div className="px-3 pb-3 space-y-2">
          {events.map(event => (
            <div key={event.id} className="text-sm">
              <span className="font-medium">{t(event.title, lang)}</span>
              <span className="ml-2 text-ink-2">({formatWhen(event.when)} · {placeLabel(event)})</span>
            </div>
          ))}
        </div>
      </details>

      {/* Causal Chains */}
      <div className="space-y-4">
        {chains.length === 0 && !completed && (
          <div className="text-center py-8 border-2 border-dashed border-line rounded-sm">
            <p className="text-ink-2 mb-3">{lang === "de" ? "Noch keine kausalen Ketten definiert." : "No causal chains defined yet."}</p>
            <button type="button" onClick={addChain} className="rounded-sm bg-navy px-4 py-2 text-sm font-medium text-on-accent">
              {lang === "de" ? "Erste Kette hinzufügen" : "Add First Chain"}
            </button>
          </div>
        )}

        {chains.map((chain, index) => (
          <div
            key={index}
            className={`p-4 rounded-sm border transition-colors ${
              completed
                ? (isCorrect ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20" : "border-oxblood-300 bg-oxblood-50 dark:border-oxblood-700 dark:bg-oxblood-900/20")
                : "border-line bg-paper"
            }`}
          >
            <div className="flex items-start gap-3 mb-3">
              <span className="shrink-0 w-8 text-center font-mono text-sm text-ink-2">{index + 1}</span>
              <div className="flex-1 grid gap-3 sm:grid-cols-3">
                {/* Cause */}
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">{lang === "de" ? "Ursache (Cause)" : "Cause"}</label>
                  <select
                    value={chain.causeEventId}
                    onChange={e => updateChain(index, "causeEventId", e.target.value)}
                    disabled={completed}
                    className="w-full p-2 text-sm border border-line bg-paper rounded-sm"
                  >
                    <option value="">{lang === "de" ? "Wählen..." : "Select..."}</option>
                    {events.map(e => (
                      <option key={e.id} value={e.id}>{t(e.title, lang)} ({e.when.start.slice(0, 4)})</option>
                    ))}
                  </select>
                </div>

                {/* Effect */}
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">{lang === "de" ? "Wirkung (Effect)" : "Effect"}</label>
                  <select
                    value={chain.effectEventId}
                    onChange={e => updateChain(index, "effectEventId", e.target.value)}
                    disabled={completed}
                    className="w-full p-2 text-sm border border-line bg-paper rounded-sm"
                  >
                    <option value="">{lang === "de" ? "Wählen..." : "Select..."}</option>
                    {events.map(e => (
                      <option key={e.id} value={e.id}>{t(e.title, lang)} ({e.when.start.slice(0, 4)})</option>
                    ))}
                  </select>
                </div>

                {/* Confidence */}
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">{lang === "de" ? "Vertrauen" : "Confidence"}</label>
                  <select
                    value={chain.confidence}
                    onChange={e => updateChain(index, "confidence", e.target.value as any)}
                    disabled={completed}
                    className="w-full p-2 text-sm border border-line bg-paper rounded-sm"
                  >
                    {CONFIDENCE_LEVELS.map(cl => (
                      <option key={cl.value} value={cl.value}>{t(cl.label, lang)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Note */}
              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-ink-2 mb-1">
                  {lang === "de" ? "Begründung / Notiz" : "Reasoning / Note"}
                </label>
                <textarea
                  value={chain.note ?? ""}
                  onChange={e => updateChain(index, "note", e.target.value)}
                  disabled={completed}
                  placeholder={lang === "de" ? "Warum glauben Sie, dass dies kausal zusammenhängt?" : "Why do you think this is causally linked?"}
                  className="w-full p-2 text-sm border border-line bg-paper rounded-sm resize-none"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {completed && (
                <span className={`text-xs font-medium ${isCorrect ? "text-emerald-600" : "text-oxblood-600"}`}>
                  {isCorrect ? (lang === "de" ? "✓ Korrekt" : "✓ Correct") : (lang === "de" ? "✗ Falsch" : "✗ Incorrect")}
                </span>
              )}
              {!completed && chains.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeChain(index)}
                  className="ml-auto text-xs text-oxblood-600 hover:underline"
                >
                  {lang === "de" ? "Entfernen" : "Remove"}
                </button>
              )}
            </div>

            {completed && !isCorrect && (
              <p className="mt-2 text-xs text-oxblood-600 dark:text-oxblood-400">
                {lang === "de" ? "Erwartete Kette: " : "Expected chain: "}
                {correctChains.map(c => {
                  const causeTitle = eventById.get(c.causeEventId)?.title ?? { en: c.causeEventId, de: c.causeEventId };
                  const effectTitle = eventById.get(c.effectEventId)?.title ?? { en: c.effectEventId, de: c.effectEventId };
                  const confLabel = CONFIDENCE_LEVELS.find(cl => cl.value === c.confidence)?.label ?? { en: c.confidence, de: c.confidence };
                  return `${t(causeTitle, lang)} → ${t(effectTitle, lang)} (${t(confLabel, lang)})`;
                }).join("; ")}
              </p>
            )}
          </div>
        ))}

        {!completed && (
          <button
            type="button"
            onClick={addChain}
            className="w-full sm:w-auto rounded-sm border border-line px-4 py-2 text-sm hover:border-bronze hover:text-bronze"
          >
            {lang === "de" ? "+ Weitere Kette hinzufügen" : "+ Add Another Chain"}
          </button>
        )}
      </div>

      {!completed && (
        <div className="flex gap-3 pt-2 justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-sm bg-navy px-4 py-2.5 text-sm font-medium text-on-accent hover:opacity-90 transition-opacity"
            disabled={chains.length === 0 || chains.some(c => !c.causeEventId || !c.effectEventId || c.causeEventId === c.effectEventId)}
          >
            {lang === "de" ? "Prüfen" : "Check Answer"}
          </button>
        </div>
      )}

      {completed && (
        <div className={`p-3 rounded-sm ${isCorrect ? "bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800" : "bg-oxblood-50 border border-oxblood-200 dark:bg-oxblood-900/20 dark:border-oxblood-800"}`}>
          <p className="font-medium">{isCorrect ? (lang === "de" ? "Alle kausalen Ketten korrekt!" : "All causal chains correct!") : (lang === "de" ? "Einige Ketten sind falsch oder fehlen." : "Some chains are incorrect or missing.")}</p>
          <p className="text-sm text-ink-2 mt-1">
            {lang === "de" ? "Wichtigste Lektion: Zeitliche Folge ≠ Kausalität." : "Key lesson: Temporal sequence ≠ causation."}
          </p>
        </div>
      )}
    </div>
  );
}