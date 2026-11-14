"use client";

import { useState, useCallback, useEffect } from "react";
import type { LearningActivity, ActivityAnswer, UserActivityProgress, FSRSState } from "@timewise/historical-schemas";
import { activitiesByChapter, activityById } from "@/lib/learning-activities";
import { useAtlas } from "@/lib/store";
import { ActivityRenderer } from "./ActivityRenderer";

const STORAGE_KEY = "timewise-learning-progress";

interface LearningModeToggleProps {
  journeyId: string;
  chapterId: string;
  lang?: "en" | "de";
  onActivityComplete?: (activityId: string, score: number) => void;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function calculateScore(activity: LearningActivity, answer: ActivityAnswer): { score: number; isCorrect: boolean } {
  const correctAnswer = activity.correctAnswer;

  switch (activity.type) {
    case "timeline_ordering": {
      const a = answer as { type: "timeline_ordering"; eventIds: string[] };
      const ca = correctAnswer as { type: "timeline_ordering"; eventIds: string[] };
      const isCorrect = JSON.stringify(a.eventIds) === JSON.stringify(ca.eventIds);
      return { score: isCorrect ? 1 : 0.3, isCorrect };
    }
    case "source_matching": {
      const a = answer as { type: "source_matching"; matches: { claimId: string; sourceId: string }[] };
      const ca = correctAnswer as { type: "source_matching"; matches: { claimId: string; sourceId: string }[] };
      const userMatches = new Map(a.matches.map(m => [m.claimId, m.sourceId]));
      const correctMatches = new Map(ca.matches.map(m => [m.claimId, m.sourceId]));
      const matches = [...userMatches.entries()].filter(([k, v]) => correctMatches.get(k) === v).length;
      const score = matches / Math.max(correctMatches.size, 1);
      return { score, isCorrect: score === 1 };
    }
    case "interpretation_rating": {
      const a = answer as { type: "interpretation_rating"; ratings: { statementId: string; rating: string }[] };
      const ca = correctAnswer as { type: "interpretation_rating"; ratings: { statementId: string; rating: string }[] };
      const userRatings = new Map(a.ratings.map(r => [r.statementId, r.rating]));
      const correctRatings = new Map(ca.ratings.map(r => [r.statementId, r.rating]));
      const correctRatingsCount = [...userRatings.entries()].filter(([k, v]) => correctRatings.get(k) === v).length;
      const score = correctRatingsCount / Math.max(correctRatings.size, 1);
      return { score, isCorrect: score === 1 };
    }
    case "map_placement": {
      const a = answer as { type: "map_placement"; placements: { eventId: string; lat: number; lng: number; toleranceKm: number }[] };
      const ca = correctAnswer as { type: "map_placement"; placements: { eventId: string; lat: number; lng: number; toleranceKm: number }[] };
      const userPlacements = new Map(a.placements.map(p => [p.eventId, p]));
      const correctPlacements = new Map(ca.placements.map(p => [p.eventId, p]));
      let correctPlaced = 0;
      for (const [eventId, userP] of userPlacements) {
        const correctP = correctPlacements.get(eventId);
        if (correctP) {
          const dist = haversineDistance(userP.lat, userP.lng, correctP.lat, correctP.lng);
          if (dist <= correctP.toleranceKm) correctPlaced++;
        }
      }
      const score = correctPlaced / Math.max(correctPlacements.size, 1);
      return { score, isCorrect: score === 1 };
    }
    case "change_detection": {
      const a = answer as { type: "change_detection"; changes: { geometryId: string; changeType: string }[] };
      const ca = correctAnswer as { type: "change_detection"; changes: { geometryId: string; changeType: string }[] };
      const userChanges = new Map(a.changes.map(c => [c.geometryId, c.changeType]));
      const correctChanges = new Map(ca.changes.map(c => [c.geometryId, c.changeType]));
      const correctChangesCount = [...userChanges.entries()].filter(([k, v]) => correctChanges.get(k) === v).length;
      const score = correctChangesCount / Math.max(correctChanges.size, 1);
      return { score, isCorrect: score === 1 };
    }
    case "evidence_gap_finding": {
      const a = answer as { type: "evidence_gap_finding"; gaps: { claimId: string; missingEvidenceType: string }[] };
      const ca = correctAnswer as { type: "evidence_gap_finding"; gaps: { claimId: string; missingEvidenceType: string }[] };
      const userGaps = new Map(a.gaps.map(g => [g.claimId, g.missingEvidenceType]));
      const correctGaps = new Map(ca.gaps.map(g => [g.claimId, g.missingEvidenceType]));
      let gapScore = 0;
      for (const [claimId, userGap] of userGaps) {
        if (correctGaps.get(claimId) === userGap) gapScore++;
      }
      const score = gapScore / Math.max(correctGaps.size, 1);
      return { score, isCorrect: score === 1 };
    }
    case "causal_reasoning": {
      const a = answer as { type: "causal_reasoning"; chains: { causeEventId: string; effectEventId: string; confidence: string }[] };
      const ca = correctAnswer as { type: "causal_reasoning"; chains: { causeEventId: string; effectEventId: string; confidence: string }[] };
      const userChains = a.chains.map(c => `${c.causeEventId}->${c.effectEventId}:${c.confidence}`);
      const correctChains = ca.chains.map(c => `${c.causeEventId}->${c.effectEventId}:${c.confidence}`);
      const chainMatches = userChains.filter(uc => correctChains.includes(uc)).length;
      const score = chainMatches / Math.max(correctChains.length, 1);
      return { score, isCorrect: score === 1 };
    }
    case "perspective_taking": {
      const a = answer as { type: "perspective_taking"; comparisons: { eventId: string; contemporaryView: string; retrospectiveView: string; keyDifference: string }[] };
      const ca = correctAnswer as { type: "perspective_taking"; comparisons: { eventId: string; contemporaryView: string; retrospectiveView: string; keyDifference: string }[] };
      let perspectiveScore = 0;
      for (let i = 0; i < a.comparisons.length && i < ca.comparisons.length; i++) {
        const userComp = a.comparisons[i];
        const correctComp = ca.comparisons[i];
        if (userComp.keyDifference.toLowerCase().includes(correctComp.keyDifference.toLowerCase().split(" ")[0])) {
          perspectiveScore++;
        }
      }
      const score = perspectiveScore / Math.max(ca.comparisons.length, 1);
      return { score, isCorrect: score === 1 };
    }
    default:
      return { score: 0.5, isCorrect: false };
  }
}

export function LearningModeToggle({ journeyId, chapterId, lang = "en", onActivityComplete }: LearningModeToggleProps) {
  const [isLearningMode, setIsLearningMode] = useState(false);
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);
  const [activityAnswers, setActivityAnswers] = useState<Map<string, ActivityAnswer>>(new Map());
  const [activityProgress, setActivityProgress] = useState<Map<string, UserActivityProgress>>(new Map());
  const [showExplanation, setShowExplanation] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const { selectedId } = useAtlas();

  const activities = activitiesByChapter(journeyId, chapterId);
  const currentActivity = activities[currentActivityIndex];
  const totalActivities = activities.length;

  // Load progress from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setActivityProgress(new Map(Object.entries(parsed)));
        const completed = Object.values(parsed).filter((p: any) => p.completedAt).length;
        setCompletedCount(completed);
      }
    } catch (e) {
      console.warn("Failed to load learning progress:", e);
    }
  }, []);

  // Save progress to localStorage
  const saveProgress = useCallback((progress: Map<string, UserActivityProgress>) => {
    try {
      const obj = Object.fromEntries(progress);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn("Failed to save learning progress:", e);
    }
  }, []);

  const getProgress = (activityId: string): UserActivityProgress | undefined => {
    return activityProgress.get(activityId);
  };

  const handleSubmit = useCallback((answer: ActivityAnswer, timeSpentSeconds: number) => {
    if (!currentActivity) return;

    const { score, isCorrect } = calculateScore(currentActivity, answer);

    // Update progress
    const existing = activityProgress.get(currentActivity.id);
    const attempts = (existing?.totalAttempts ?? 0) + 1;
    const bestScore = Math.max(existing?.bestScore ?? 0, score);
    const now = new Date().toISOString();

    // FSRS update (simplified)
    let fsrs: FSRSState | undefined;
    if (existing?.fsrs) {
      const { stability, difficulty, reps, lapses } = existing.fsrs;
      if (isCorrect) {
        fsrs = {
          stability: Math.min(stability * 1.5, 365),
          difficulty: Math.max(difficulty - 0.5, 1),
          dueDate: new Date(Date.now() + stability * 1.5 * 24 * 60 * 60 * 1000).toISOString(),
          lastReview: now,
          reps: reps + 1,
          lapses,
        };
      } else {
        fsrs = {
          stability: Math.max(stability * 0.5, 1),
          difficulty: Math.min(difficulty + 1, 10),
          dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
          lastReview: now,
          reps,
          lapses: lapses + 1,
        };
      }
    } else {
      fsrs = {
        stability: isCorrect ? 2.5 : 1,
        difficulty: isCorrect ? 3 : 6,
        dueDate: new Date(Date.now() + (isCorrect ? 2.5 : 1) * 24 * 60 * 60 * 1000).toISOString(),
        lastReview: now,
        reps: isCorrect ? 1 : 0,
        lapses: isCorrect ? 0 : 1,
      };
    }

    const updatedProgress: UserActivityProgress = {
      userId: "local-user",
      activityId: currentActivity.id,
      journeyId,
      chapterId,
      bestScore,
      totalAttempts: attempts,
      lastAttemptAt: now,
      completedAt: isCorrect && !existing?.completedAt ? now : existing?.completedAt,
      fsrs,
      nextReviewAt: fsrs.dueDate,
    };

    setActivityProgress(prev => {
      const next = new Map(prev);
      next.set(currentActivity.id, updatedProgress);
      saveProgress(next);
      return next;
    });

    setActivityAnswers(prev => {
      const next = new Map(prev);
      next.set(currentActivity.id, answer);
      return next;
    });

    if (isCorrect && !existing?.completedAt) {
      setCompletedCount(prev => prev + 1);
      onActivityComplete?.(currentActivity.id, score);
    }
  }, [currentActivity, journeyId, chapterId, activityProgress, saveProgress, onActivityComplete]);

  const handleNext = useCallback(() => {
    if (currentActivityIndex < activities.length - 1) {
      setCurrentActivityIndex(prev => prev + 1);
      setShowExplanation(null);
    }
  }, [currentActivityIndex, activities.length]);

  const handlePrev = useCallback(() => {
    if (currentActivityIndex > 0) {
      setCurrentActivityIndex(prev => prev - 1);
      setShowExplanation(null);
    }
  }, [currentActivityIndex]);

  const toggleMode = useCallback(() => {
    setIsLearningMode(!isLearningMode);
    if (!isLearningMode) {
      setCurrentActivityIndex(0);
      setShowExplanation(null);
    }
  }, [isLearningMode]);

  if (activities.length === 0) return null;

  const progressPercent = totalActivities > 0 ? Math.round((completedCount / totalActivities) * 100) : 0;

  return (
    <div className="border border-line bg-paper-2 rounded-sm overflow-hidden">
      {/* Mode Toggle Bar */}
      <div className="flex items-center justify-between p-3 border-b border-line bg-paper-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-2">
            {lang === "de" ? "Lernmodus" : "Learning Mode"}
          </span>
          <button
            type="button"
            onClick={toggleMode}
            className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${
              isLearningMode
                ? "bg-navy text-on-accent"
                : "border border-line bg-paper hover:border-bronze"
            }`}
            aria-pressed={isLearningMode}
          >
            {isLearningMode
              ? (lang === "de" ? "Zur Erzählung" : "Back to Story")
              : (lang === "de" ? "Lernmodus starten" : "Start Learning")}
          </button>
        </div>

        {isLearningMode && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-ink-2">{completedCount}/{totalActivities}</span>
              <div className="w-24 h-1.5 bg-paper rounded-full overflow-hidden">
                <div
                  className="h-full bg-navy transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-ink-2">{progressPercent}%</span>
            </div>
            <span className="text-xs text-ink-2">+{activities.reduce((sum, a) => sum + a.xpReward, 0)} XP</span>
          </div>
        )}
      </div>

      {/* Learning Mode Content */}
      {isLearningMode && currentActivity && (
        <div className="p-4">
          {/* Activity Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentActivityIndex === 0}
              className="p-1.5 rounded-sm text-ink-2 hover:text-bronze hover:bg-paper-3 transition-colors disabled:opacity-40"
              aria-label={lang === "de" ? "Vorherige Aktivität" : "Previous activity"}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M12.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L8.414 9l4.293 4.293a1 1 0 010 1.414z"/></svg>
            </button>
            <div className="flex-1 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-ink-2">
                {lang === "de" ? "Aktivität" : "Activity"} {currentActivityIndex + 1} / {totalActivities}
              </p>
              <p className="text-sm font-serif text-ink truncate">{currentActivity.prompt[lang]?.split(".")[0] ?? currentActivity.prompt.en.split(".")[0]}</p>
            </div>
            <button
              type="button"
              onClick={handleNext}
              disabled={currentActivityIndex === activities.length - 1}
              className="p-1.5 rounded-sm text-ink-2 hover:text-bronze hover:bg-paper-3 transition-colors disabled:opacity-40"
              aria-label={lang === "de" ? "Nächste Aktivität" : "Next activity"}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M7.293 15.707a1 1 0 010-1.414L11.586 9 7.293 4.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z"/></svg>
            </button>
          </div>

          {/* Activity Renderer */}
          <ActivityRenderer
            activity={currentActivity}
            currentAnswer={activityAnswers.get(currentActivity.id)}
            onSubmit={handleSubmit}
            completed={!!activityProgress.get(currentActivity.id)?.completedAt}
            bestScore={activityProgress.get(currentActivity.id)?.bestScore}
            attempts={activityProgress.get(currentActivity.id)?.totalAttempts}
            onShowExplanation={() => setShowExplanation(currentActivity.id)}
            lang={lang}
          />
        </div>
      )}
    </div>
  );
}