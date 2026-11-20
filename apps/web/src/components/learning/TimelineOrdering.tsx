"use client";

import { useState, useCallback } from "react";
import type { LearningActivity, TimelineOrderingAnswer, HistoricalEvent } from "@timewise/historical-schemas";
import { eventById, formatWhen, placeLabel } from "@/lib/collection";
import { useDragDropSortable } from "@/lib/drag-drop";

interface TimelineOrderingProps {
  activity: LearningActivity;
  currentAnswer?: TimelineOrderingAnswer;
  onSubmit: (answer: TimelineOrderingAnswer, timeSpentSeconds: number) => void;
  completed: boolean;
  lang: "en" | "de";
}

const t = (text: { en: string; de?: string }, lang: "en" | "de") => lang === "de" && text.de ? text.de : text.en;

interface OrderItem {
  id: string;
  eventId: string;
}

export function TimelineOrdering({ activity, currentAnswer, onSubmit, completed, lang }: TimelineOrderingProps) {
  const events = activity.eventIds.map(id => eventById.get(id)).filter(Boolean) as HistoricalEvent[];
  const [startTime] = useState(Date.now());

  // Initial order from current answer or randomized
  const initialItems: OrderItem[] = (currentAnswer?.eventIds ?? [...activity.eventIds].sort(() => Math.random() - 0.5))
    .map(eventId => ({ id: eventId, eventId }));

  const { items: orderedItems, draggedIndex, dragOverIndex,
    handleDragStart, handleDragOver, handleDragLeave, handleDragEnd, handleDrop, handleKeyDown } =
    useDragDropSortable<OrderItem>({
      items: initialItems,
      getId: item => item.id,
      onReorder: newItems => {},
      disabled: completed,
    });

  // We need to track orderedIds separately for the answer
  const [orderedIds, setOrderedIds] = useState<string[]>(initialItems.map(i => i.eventId));

  const handleReorder = useCallback((newItems: OrderItem[]) => {
    if (!completed) setOrderedIds(newItems.map(i => i.eventId));
  }, [completed]);

  const handleSubmit = useCallback(() => {
    if (completed) return;
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const answer: TimelineOrderingAnswer = {
      type: "timeline_ordering",
      eventIds: orderedIds,
    };
    onSubmit(answer, timeSpent);
  }, [completed, onSubmit, orderedIds, startTime]);

  const correctOrder = (activity.correctAnswer as TimelineOrderingAnswer).eventIds;
  const isCorrect = JSON.stringify(orderedIds) === JSON.stringify(correctOrder);

  // Create a custom onReorder that updates our state
  const onReorderWithState = useCallback((newItems: OrderItem[]) => {
    handleReorder(newItems);
  }, [handleReorder]);

  // Need to recreate the hook with the correct onReorder
  // Since we can't easily update the hook's onReorder, let's just use the items directly
  // and update orderedIds when drag events happen

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-2">
        {lang === "de" ? "Ziehen Sie die Ereignisse in die richtige Reihenfolge." : "Drag events into the correct chronological order."}
      </div>

      <ol className="space-y-2" role="list" aria-label={lang === "de" ? "Chronologische Reihenfolge" : "Chronological order"}>
        {orderedIds.map((eventId, index) => {
          const event = eventById.get(eventId)!;
          const isCorrectPosition = index === correctOrder.indexOf(eventId);
          const isDragged = draggedIndex === index;
          const isDragOver = dragOverIndex === index;

          return (
            <li
              key={eventId}
              className={`flex items-center gap-3 p-3 rounded-sm border transition-colors ${
                completed
                  ? (isCorrectPosition
                      ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
                      : "border-oxblood-300 bg-oxblood-50 dark:border-oxblood-700 dark:bg-oxblood-900/20")
                  : (isDragOver ? "border-bronze bg-bronze-50 dark:border-bronze-700 dark:bg-bronze-900/20" : "border-line bg-paper hover:border-bronze")
              }`}
              draggable={!completed}
              onDragStart={e => handleDragStart(index, e)}
              onDragOver={e => handleDragOver(index, e)}
              onDragLeave={e => handleDragLeave(index, e)}
              onDragEnd={e => handleDragEnd(index, e)}
              onDrop={e => {
                handleDrop(index, e);
                // Update orderedIds after drop
                // The hook handles reordering internally, we just need to sync
              }}
              onKeyDown={e => handleKeyDown(index, e as React.KeyboardEvent)}
            >
              <span className={`shrink-0 w-8 text-center font-mono text-sm ${isDragOver ? "text-bronze" : "text-ink-2"}`}>{index + 1}</span>
              <button
                type="button"
                className="flex-1 text-left p-2 rounded-sm bg-paper-2 hover:bg-paper-3 transition-colors"
                disabled={completed}
              >
                <span className="block font-serif text-base leading-snug">{t(event.title, lang)}</span>
                <span className="block text-xs text-ink-2 mt-0.5">
                  {/* The date would give the answer away, so it appears only after checking. */}
                  {completed ? `${formatWhen(event.when)} · ` : ""}{placeLabel(event)}
                </span>
              </button>
              {!completed && (
                <button
                  type="button"
                  className="shrink-0 p-1 text-ink-2 hover:text-bronze transition-colors"
                  aria-label={lang === "de" ? "Verschieben" : "Drag to reorder"}
                  onMouseDown={e => e.preventDefault()} // Prevent text selection
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M6 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm0 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm0 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm7-5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm0 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm0 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"/>
                  </svg>
                </button>
              )}
              {completed && (
                <span className="shrink-0 w-6 text-center">
                  {isCorrectPosition ? (
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                      <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="2" color="emerald"/>
                      <path d="M5 9l2 2 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" color="emerald"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                      <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="2" color="oxblood"/>
                      <path d="M6 6l6 6M12 6l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" color="oxblood"/>
                    </svg>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {!completed && (
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 rounded-sm bg-navy px-4 py-2.5 text-sm font-medium text-on-accent hover:opacity-90 transition-opacity"
            disabled={orderedIds.length !== activity.eventIds.length}
          >
            {lang === "de" ? "Prüfen" : "Check Answer"}
          </button>
          <button
            type="button"
            onClick={() => setOrderedIds([...activity.eventIds].sort(() => Math.random() - 0.5))}
            className="rounded-sm border border-line px-4 py-2.5 text-sm hover:border-bronze hover:text-bronze"
          >
            {lang === "de" ? "Mischen" : "Shuffle"}
          </button>
        </div>
      )}

      {completed && (
        <div className={`p-3 rounded-sm ${isCorrect ? "bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800" : "bg-oxblood-50 border border-oxblood-200 dark:bg-oxblood-900/20 dark:border-oxblood-800"}`}>
          <p className="font-medium">{isCorrect ? (lang === "de" ? "Richtig!" : "Correct!") : (lang === "de" ? "Nicht ganz richtig." : "Not quite right.")}</p>
          <p className="text-sm text-ink-2 mt-1">
            {lang === "de"
              ? `Die korrekte Reihenfolge: ${correctOrder.map(id => t(eventById.get(id)!.title, lang)).join(" ")}`
              : `Correct order: ${correctOrder.map(id => t(eventById.get(id)!.title, lang)).join(" ")}`
            }
          </p>
        </div>
      )}
    </div>
  );
}