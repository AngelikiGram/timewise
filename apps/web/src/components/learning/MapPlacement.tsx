"use client";

import { useState, useCallback, useRef } from "react";
import type { LearningActivity, MapPlacementAnswer, HistoricalEvent } from "@timewise/historical-schemas";
import { eventById } from "@/lib/collection";
import { AtlasMap } from "../AtlasMap";

interface MapPlacementProps {
  activity: LearningActivity;
  currentAnswer?: MapPlacementAnswer;
  onSubmit: (answer: MapPlacementAnswer, timeSpentSeconds: number) => void;
  completed: boolean;
  lang: "en" | "de";
}

const t = (text: { en: string; de?: string }, lang: "en" | "de") => lang === "de" && text.de ? text.de : text.en;

const DEFAULT_CENTER: [number, number] = [14.2, 47.6];
const DEFAULT_ZOOM = 5.3;

function getPlacementClassName(completed: boolean, isCorrect: boolean, placed: boolean): string {
  if (completed) {
    return isCorrect
      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
      : "border-oxblood-200 bg-oxblood-50 dark:border-oxblood-800 dark:bg-oxblood-900/20";
  }
  return placed
    ? "border-bronze-200 bg-bronze-50 dark:border-bronze-800 dark:bg-bronze-900/20"
    : "border-line bg-paper";
}

function getMarkerClassName(completed: boolean, isCorrect: boolean, placed: boolean): string {
  if (completed) {
    return isCorrect ? "border-emerald-500 bg-emerald-500" : "border-oxblood-500 bg-oxblood-500";
  }
  return placed ? "border-bronze-500 bg-bronze-500" : "border-line";
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function CheckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="currentColor" aria-hidden>
      <path d="M12.5 3.5a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06 0L2 8.56a.75.75 0 0 1 1.06-1.06L5.44 10.5 11.44 4.5a.75.75 0 0 1 1.06 0Z"/>
    </svg>
  );
}

export function MapPlacement({ activity, currentAnswer, onSubmit, completed, lang }: MapPlacementProps) {
  const events = activity.eventIds.map(id => eventById.get(id)).filter(Boolean) as HistoricalEvent[];
  const [placements, setPlacements] = useState<Map<string, { lat: number; lng: number }>>(
    currentAnswer ? new Map(currentAnswer.placements.map(p => [p.eventId, { lat: p.lat, lng: p.lng }])) : new Map()
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [startTime] = useState(Date.now());
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const handleMapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (completed || !selectedEventId || !mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    const lng = DEFAULT_CENTER[0] + (e.clientX - rect.left - rect.width / 2) * 0.01;
    const lat = DEFAULT_CENTER[1] - (e.clientY - rect.top - rect.height / 2) * 0.01;
    const newPlacements = new Map(placements);
    newPlacements.set(selectedEventId, { lat, lng });
    setPlacements(newPlacements);
  }, [completed, selectedEventId, placements]);

  const handleSubmit = useCallback(() => {
    if (completed) return;
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const correctAnswer = activity.correctAnswer as MapPlacementAnswer;
    const answer: MapPlacementAnswer = {
      type: "map_placement",
      placements: [...placements.entries()].map(([eventId, coords]) => {
        const correct = correctAnswer.placements.find(p => p.eventId === eventId);
        return {
          eventId,
          lat: coords.lat,
          lng: coords.lng,
          toleranceKm: correct?.toleranceKm ?? 5,
        };
      }),
    };
    onSubmit(answer, timeSpent);
  }, [completed, placements, startTime, onSubmit, activity.correctAnswer]);

  const correctPlacements = new Map((activity.correctAnswer as MapPlacementAnswer).placements.map(p => [p.eventId, p]));
  const allPlaced = events.every(e => placements.has(e.id));
  const isCorrect = allPlaced && [...placements.entries()].every(([eventId, coords]) => {
    const correct = correctPlacements.get(eventId);
    if (!correct) return false;
    const dist = haversineDistance(coords.lat, coords.lng, correct.lat, correct.lng);
    return dist <= correct.toleranceKm;
  });

  // Render placement markers
  const renderMarkers = () => {
    return Array.from(placements.entries()).map(([eventId, coords]) => {
      const correct = correctPlacements.get(eventId);
      const markerCorrect = correct && haversineDistance(coords.lat, coords.lng, correct.lat, correct.lng) <= correct.toleranceKm;
      return (
        <div
          key={eventId}
          className="absolute w-6 h-6 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            left: `${50 + (coords.lng - DEFAULT_CENTER[0]) * 20}%`,
            top: `${50 - (coords.lat - DEFAULT_CENTER[1]) * 20}%`,
          }}
        >
          <div className={`w-full h-full rounded-full border-2 transform transition-all ${getMarkerClassName(completed, markerCorrect ?? false, true)}`}>
            {completed && markerCorrect && <CheckIcon className="w-4 h-4 mx-auto mt-1 text-on-accent" />}
          </div>
        </div>
      );
    });
  };

  // Render placed events list
  const renderPlacedEvents = () => {
    return events.map(event => {
      const placed = placements.get(event.id);
      const correct = correctPlacements.get(event.id);
      const eventCorrect = placed && correct && haversineDistance(placed.lat, placed.lng, correct.lat, correct.lng) <= correct.toleranceKm;
      return (
        <div
          key={event.id}
          className={`flex items-center gap-2 p-2 rounded-sm border ${getPlacementClassName(completed, eventCorrect ?? false, !!placed)}`}
        >
          <span className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${getMarkerClassName(completed, eventCorrect ?? false, !!placed)}`}>
            {completed && eventCorrect && <CheckIcon className="w-3 h-3 text-on-accent" />}
          </span>
          <span className="text-sm font-medium">{t(event.title, lang)}</span>
          {placed && (
            <span className="text-xs text-ink-2 ml-auto">
              {placed.lat.toFixed(4)}, {placed.lng.toFixed(4)}
            </span>
          )}
        </div>
      );
    });
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-2">
        {lang === "de"
          ? "Wählen Sie ein Ereignis aus, dann klicken Sie auf die Karte, um es zu platzieren."
          : "Select an event, then click the map to place it."}
      </div>

      {/* Event Selector */}
      <div className="flex flex-wrap gap-2" role="group" aria-label={lang === "de" ? "Ereignis auswählen" : "Select event"}>
        {events.map(event => (
          <button
            key={event.id}
            type="button"
            onClick={() => setSelectedEventId(event.id)}
            disabled={completed}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedEventId === event.id
                ? "bg-navy text-on-accent dark:bg-bronze"
                : "border border-line bg-paper hover:border-bronze"
            }`}
          >
            {t(event.title, lang)}
          </button>
        ))}
      </div>

      {/* Map */}
      <div className="relative">
        <div
          ref={mapContainerRef}
          onClick={handleMapClick}
          className="aspect-video rounded-sm border border-line bg-paper-3 overflow-hidden"
          style={{ cursor: selectedEventId && !completed ? "crosshair" : "default" }}
          role="application"
          aria-label={lang === "de" ? "Interaktive Karte zur Ortung" : "Interactive map for placement"}
        >
          <AtlasMap
            events={events}
            selectedId={selectedEventId}
            date={events[0]?.when.start ?? "1850-01-01"}
            interactive={!completed}
            initialCenter={DEFAULT_CENTER}
            initialZoom={DEFAULT_ZOOM}
            style={{ width: "100%", height: "100%" }}
          />

          {/* Placement markers */}
          {renderMarkers()}
        </div>

        {/* Selected event indicator */}
        {selectedEventId && !completed && (
          <div className="absolute bottom-2 left-2 right-2 bg-paper-2/95 backdrop-blur p-2 rounded-sm border border-line text-xs text-center">
            {lang === "de" ? "Klicken Sie auf die Karte, um " : "Click the map to place "}
            {t(eventById.get(selectedEventId)!.title, lang)}
          </div>
        )}

        {/* Placed Events List */}
        <div className="space-y-2 mt-4">
          <h4 className="font-semibold text-sm uppercase tracking-wider text-ink-2">
            {lang === "de" ? "Platzierte Ereignisse" : "Placed Events"}
          </h4>
          {renderPlacedEvents()}
        </div>

        {!completed && (
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleSubmit}
              className="flex-1 rounded-sm bg-navy px-4 py-2.5 text-sm font-medium text-on-accent hover:opacity-90 transition-opacity"
              disabled={!allPlaced}
            >
              {lang === "de" ? "Prüfen" : "Check Answer"}
            </button>
            <button
              type="button"
              onClick={() => { setPlacements(new Map()); setSelectedEventId(null); }}
              className="rounded-sm border border-line px-4 py-2.5 text-sm hover:border-bronze hover:text-bronze"
            >
              {lang === "de" ? "Zurücksetzen" : "Reset"}
            </button>
          </div>
        )}

        {completed && (
          <div className={`p-3 rounded-sm ${isCorrect ? "bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800" : "bg-oxblood-50 border border-oxblood-200 dark:bg-oxblood-900/20 dark:border-oxblood-800"}`}>
            <p className="font-medium">{isCorrect ? (lang === "de" ? "Alle richtig platziert!" : "All correctly placed!") : (lang === "de" ? "Einige Positionen sind falsch." : "Some positions are incorrect.")}</p>
            <p className="text-sm text-ink-2 mt-1">
              {lang === "de" ? "Toleranz: ±5 km um den korrekten Ort." : "Tolerance: ±5 km from correct location."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}