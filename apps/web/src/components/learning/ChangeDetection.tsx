"use client";

import { useState, useCallback } from "react";
import type { LearningActivity, ChangeDetectionAnswer } from "@timewise/historical-schemas";
import { eventById, geometriesFor, DERIVATION_LABELS } from "@/lib/collection";

interface ChangeDetectionProps {
  activity: LearningActivity;
  currentAnswer?: ChangeDetectionAnswer;
  onSubmit: (answer: ChangeDetectionAnswer, timeSpentSeconds: number) => void;
  completed: boolean;
  lang: "en" | "de";
}

const t = (text: { en: string; de?: string }, lang: "en" | "de") => lang === "de" && text.de ? text.de : text.en;

const CHANGE_TYPES = [
  { value: "appeared", label: { en: "Appeared", de: "Erschienen" }, color: "emerald" },
  { value: "disappeared", label: { en: "Disappeared", de: "Verschwunden" }, color: "oxblood" },
  { value: "modified", label: { en: "Modified", de: "Verändert" }, color: "amber" },
  { value: "unchanged", label: { en: "Unchanged", de: "Unverändert" }, color: "navy" },
] as const;

export function ChangeDetection({ activity, currentAnswer, onSubmit, completed, lang }: ChangeDetectionProps) {
  const eventIds = activity.eventIds;
  const [changes, setChanges] = useState<Map<string, { changeType: ChangeDetectionAnswer["changes"][0]["changeType"]; description: string }>>(
    currentAnswer ? new Map(currentAnswer.changes.map(c => [c.geometryId, { changeType: c.changeType, description: c.description }])) : new Map()
  );
  const [startTime] = useState(Date.now());

  // Gather all geometries from the events
  const allGeometries = eventIds.flatMap(id => geometriesFor(id));

  const handleChange = useCallback((geometryId: string, changeType: ChangeDetectionAnswer["changes"][0]["changeType"], description: string) => {
    if (completed) return;
    const newChanges = new Map(changes);
    newChanges.set(geometryId, { changeType, description });
    setChanges(newChanges);
  }, [completed, changes]);

  const handleSubmit = useCallback(() => {
    if (completed) return;
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const answer: ChangeDetectionAnswer = {
      type: "change_detection",
      changes: [...changes.entries()].map(([geometryId, { changeType, description }]) => ({
        geometryId,
        changeType,
        description,
      })),
    };
    onSubmit(answer, timeSpent);
  }, [completed, changes, startTime, onSubmit]);

  const correctChanges = new Map((activity.correctAnswer as ChangeDetectionAnswer).changes.map(c => [c.geometryId, c]));
  const allAnswered = allGeometries.every(g => changes.has(g.id));
  const isCorrect = allAnswered && [...changes.entries()].every(([geometryId, { changeType }]) =>
    correctChanges.get(geometryId)?.changeType === changeType
  );

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-2">
        {lang === "de"
          ? "Vergleichen Sie die Kartenebenen für die zwei Zeitpunkte. Identifizieren Sie, was sich geändert hat."
          : "Compare the map layers for the two time points. Identify what changed."
        }
      </div>

      {/* Time Context */}
      <div className="grid gap-4 sm:grid-cols-2">
        {eventIds.slice(0, 2).map((eventId, i) => {
          const event = eventById.get(eventId)!;
          return (
            <div key={eventId} className="p-3 rounded-sm border border-line bg-paper-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-2">
                {i === 0 ? (lang === "de" ? "Früher" : "Earlier") : (lang === "de" ? "Später" : "Later")}
              </span>
              <p className="mt-1 font-serif text-base">{t(event.title, lang)}</p>
              <p className="text-xs text-ink-2 mt-1">{event.when.start.slice(0, 4)}</p>
            </div>
          );
        })}
      </div>

      {/* Geometry Changes */}
      <div className="space-y-3">
        <h4 className="font-semibold text-sm uppercase tracking-wider text-ink-2">
          {lang === "de" ? "Geografische Änderungen" : "Geographic Changes"}
        </h4>
        {allGeometries.map(geometry => {
          const userChange = changes.get(geometry.id);
          const correctChange = correctChanges.get(geometry.id);
          const isCorrect = userChange?.changeType === correctChange?.changeType;

          return (
            <div
              key={geometry.id}
              className={`p-3 rounded-sm border transition-colors ${
                completed
                  ? (isCorrect
                      ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
                      : "border-oxblood-300 bg-oxblood-50 dark:border-oxblood-700 dark:bg-oxblood-900/20")
                  : (userChange ? "border-bronze bg-bronze-50 dark:border-bronze-700 dark:bg-bronze-900/20" : "border-line bg-paper hover:border-bronze")
              }`}
            >
              <div className="flex items-start gap-3 mb-2">
                <span className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-paper-3 border border-line text-xs font-medium">
                  {geometry.geometry.type === "Polygon" ? "▢" : geometry.geometry.type === "LineString" ? "━" : "•"}
                </span>
                <div className="flex-1">
                  <p className="font-serif text-sm leading-snug">{geometry.name}</p>
                  <p className="text-xs text-ink-2 mt-0.5">
                    <span className="border border-line px-1.5 py-0.5 rounded text-xs">{DERIVATION_LABELS[geometry.derivation].label}</span>
                    <span className="ml-2">{geometry.validFrom} – {geometry.validTo}</span>
                  </p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-4">
                {CHANGE_TYPES.map(ct => (
                  <button
                    key={ct.value}
                    type="button"
                    disabled={completed}
                    onClick={() => handleChange(geometry.id, ct.value, "")}
                    className={`p-2 rounded-sm text-xs font-medium transition-colors ${
                      completed
                        ? (correctChange?.changeType === ct.value
                            ? `border-${ct.color}-300 bg-${ct.color}-50 dark:border-${ct.color}-700 dark:bg-${ct.color}-900/20`
                            : userChange?.changeType === ct.value
                            ? `border-oxblood-300 bg-oxblood-50 dark:border-oxblood-700 dark:bg-oxblood-900/20`
                            : "border-line bg-paper opacity-60")
                        : (userChange?.changeType === ct.value
                            ? `border-${ct.color}-500 bg-${ct.color}-100 dark:border-${ct.color}-600 dark:bg-${ct.color}-900/30`
                            : "border-line bg-paper hover:border-bronze")
                    }`}
                    title={t(ct.label, lang)}
                  >
                    {t(ct.label, lang)}
                  </button>
                ))}
              </div>

              <textarea
                value={userChange?.description ?? ""}
                onChange={e => handleChange(geometry.id, userChange?.changeType ?? "unchanged", e.target.value)}
                disabled={completed}
                placeholder={lang === "de" ? "Beschreibung der Änderung..." : "Describe the change..."}
                className="mt-2 w-full p-2 text-xs border border-line bg-paper rounded-sm resize-none"
                rows={2}
              />

              {completed && userChange?.changeType !== correctChange?.changeType && (
                <p className="mt-2 text-xs text-oxblood-600 dark:text-oxblood-400">
                  {lang === "de" ? "Richtig: " : "Correct: "}{t(CHANGE_TYPES.find(c => c.value === correctChange?.changeType)?.label ?? {en:"",de:""}, lang)}
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
            disabled={!allAnswered}
          >
            {lang === "de" ? "Prüfen" : "Check Answer"}
          </button>
          <button
            type="button"
            onClick={() => setChanges(new Map())}
            className="rounded-sm border border-line px-4 py-2.5 text-sm hover:border-bronze hover:text-bronze"
          >
            {lang === "de" ? "Zurücksetzen" : "Reset"}
          </button>
        </div>
      )}

      {completed && (
        <div className={`p-3 rounded-sm ${isCorrect ? "bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800" : "bg-oxblood-50 border border-oxblood-200 dark:bg-oxblood-900/20 dark:border-oxblood-800"}`}>
          <p className="font-medium">{isCorrect ? (lang === "de" ? "Alle Änderungen korrekt erkannt!" : "All changes correctly identified!") : (lang === "de" ? "Einige Änderungen sind falsch." : "Some changes are incorrect.")}</p>
        </div>
      )}
    </div>
  );
}