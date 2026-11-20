"use client";

import { useState, useEffect, useCallback } from "react";
import type { LearningActivity, ActivityAnswer, UserActivityProgress, FSRSState } from "@timewise/historical-schemas";
import { activityById, activitiesByChapter, activitiesByJourney } from "@/lib/learning-activities";
import { ActivityRenderer } from "@/components/learning/ActivityRenderer";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const STORAGE_KEY = "timewise-learning-progress";

interface ActivityPlayerProps {
  activityId: string;
  journeyId: string;
  chapterId?: string;
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

function ActivityPlayer({ activityId, journeyId, chapterId }: ActivityPlayerProps) {
  const [activity, setActivity] = useState<LearningActivity | null>(null);
  const [activityAnswers, setActivityAnswers] = useState<Map<string, ActivityAnswer>>(new Map());
  const [activityProgress, setActivityProgress] = useState<Map<string, UserActivityProgress>>(new Map());
  const [showExplanation, setShowExplanation] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);
  const [siblingActivities, setSiblingActivities] = useState<LearningActivity[]>([]);

  // Load activity and sibling activities
  useEffect(() => {
    const act = activityById.get(activityId);
    if (act) {
      setActivity(act);
      if (chapterId) {
        setSiblingActivities(activitiesByChapter(journeyId, chapterId));
      } else {
        setSiblingActivities(activitiesByJourney(journeyId));
      }
      const idx = siblingActivities.findIndex(a => a.id === activityId);
      if (idx >= 0) setCurrentActivityIndex(idx);
    }
  }, [activityId, journeyId, chapterId]);

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

  const handleSubmit = useCallback((answer: ActivityAnswer, timeSpentSeconds: number) => {
    if (!activity) return;

    const { score, isCorrect } = calculateScore(activity, answer);

    // Update progress
    const existing = activityProgress.get(activity.id);
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
      activityId: activity.id,
      journeyId,
      chapterId: activity.chapterId,
      bestScore,
      totalAttempts: attempts,
      lastAttemptAt: now,
      completedAt: isCorrect && !existing?.completedAt ? now : existing?.completedAt,
      fsrs,
      nextReviewAt: fsrs.dueDate,
    };

    setActivityProgress(prev => {
      const next = new Map(prev);
      next.set(activity.id, updatedProgress);
      saveProgress(next);
      return next;
    });

    setActivityAnswers(prev => {
      const next = new Map(prev);
      next.set(activity.id, answer);
      return next;
    });

    if (isCorrect && !existing?.completedAt) {
      setCompletedCount(prev => prev + 1);
    }

    setShowExplanation(true);
  }, [activity, journeyId, activityProgress, saveProgress]);

  const handleNext = useCallback(() => {
    if (currentActivityIndex < siblingActivities.length - 1) {
      setCurrentActivityIndex(prev => prev + 1);
      setShowExplanation(false);
    }
  }, [currentActivityIndex, siblingActivities.length]);

  const handlePrev = useCallback(() => {
    if (currentActivityIndex > 0) {
      setCurrentActivityIndex(prev => prev - 1);
      setShowExplanation(false);
    }
  }, [currentActivityIndex]);

  const goToActivity = useCallback((index: number) => {
    if (index >= 0 && index < siblingActivities.length) {
      setCurrentActivityIndex(index);
      setShowExplanation(false);
    }
  }, [siblingActivities.length]);

  if (!activity) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-paper">
        <div className="text-center">
          <p className="text-xl text-ink-2">Loading activity...</p>
        </div>
      </div>
    );
  }

  const currentSiblingActivity = siblingActivities[currentActivityIndex];
  const progress = activityProgress.get(activity.id);
  const isCompleted = !!progress?.completedAt;
  const totalActivities = siblingActivities.length;
  const progressPercent = totalActivities > 0 ? Math.round((completedCount / totalActivities) * 100) : 0;

  return (
    <div className="min-h-dvh bg-paper flex flex-col">
      {/* Header */}
      <header className="border-b border-line bg-paper-2 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-4">
            <div className="flex items-center gap-4">
              <Link
                href={`/learn?journey=${journeyId}${chapterId ? `&chapter=${chapterId}` : ""}`}
                className="p-2 text-ink-2 hover:text-bronze transition-colors"
                aria-label="Back to Learning Hub"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </Link>
              <div>
                <p className="text-xs font-semibold text-ink-2">
                  {activity.type.replace("_", " ")} · {activity.difficulty.charAt(0).toUpperCase() + activity.difficulty.slice(1)}
                </p>
                <h1 className="font-serif text-xl sm:text-2xl text-ink truncate max-w-[400px]">
                  {activity.prompt.en}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <span className="text-ink-2">{completedCount}/{totalActivities}</span>
                <div className="w-32 h-1.5 bg-paper rounded-full overflow-hidden">
                  <div className="h-full bg-navy transition-all" style={{ width: `${progressPercent}%` }} />
                </div>
                <span className="text-ink-2">{progressPercent}%</span>
              </div>
              <Link
                href={`/learn?journey=${journeyId}${chapterId ? `&chapter=${chapterId}` : ""}`}
                className="px-3 py-1.5 text-sm font-medium text-bronze hover:underline"
              >
                Hub
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Activity Navigation */}
        {totalActivities > 1 && (
          <nav className="mb-6 overflow-x-auto pb-2" aria-label="Activity navigation">
            <ol className="flex gap-2 min-w-max" role="list">
              {siblingActivities.map((act, index) => (
                <li key={act.id}>
                  <button
                    type="button"
                    onClick={() => goToActivity(index)}
                    className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-all whitespace-nowrap ${
                      index === currentActivityIndex
                        ? "bg-navy text-on-accent"
                        : activityProgress.get(act.id)?.completedAt
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-paper border border-line text-ink-2 hover:border-bronze hover:bg-paper-2"
                    }`}
                    aria-current={index === currentActivityIndex ? "step" : undefined}
                    title={act.prompt.en}
                  >
                    {index + 1}. {act.prompt.en.split(".")[0]}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* Activity Renderer */}
        <div className="bg-paper-2 border border-line rounded-lg overflow-hidden">
          <ActivityRenderer
            activity={currentSiblingActivity || activity}
            currentAnswer={activityAnswers.get(activity.id)}
            onSubmit={handleSubmit}
            completed={isCompleted}
            bestScore={progress?.bestScore}
            attempts={progress?.totalAttempts}
            onShowExplanation={() => setShowExplanation(true)}
            lang="en"
          />
        </div>

        {/* Sibling Activity Cards */}
        {totalActivities > 1 && (
          <section className="mt-8">
            <h2 className="font-serif text-lg mb-4">Other Activities in This Chapter</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {siblingActivities.filter(a => a.id !== activity.id).map(act => (
                <Link
                  key={act.id}
                  href={`/learn/activities/${act.id}?journey=${journeyId}&chapter=${act.chapterId}`}
                  className={`p-4 rounded-lg border transition-all ${
                    activityProgress.get(act.id)?.completedAt
                      ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
                      : "border-line bg-paper hover:border-bronze hover:bg-paper-2"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xl">{getActivityIcon(act.type)}</span>
                    {activityProgress.get(act.id)?.completedAt && (
                      <span className="text-emerald-600">✓</span>
                    )}
                  </div>
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${getDifficultyColor(act.difficulty)}`}>
                    {act.difficulty}
                  </span>
                  <h3 className="font-serif text-sm font-medium text-ink mt-2 line-clamp-2">
                    {act.prompt.en.split(".")[0]}
                  </h3>
                  <div className="mt-3 flex items-center justify-between text-xs text-ink-2">
                    <span>+{act.xpReward} XP</span>
                    <span>{activityProgress.get(act.id)?.totalAttempts || 0} attempts</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function getActivityIcon(type: string): string {
  const icons: Record<string, string> = {
    timeline_ordering: "📅",
    source_matching: "📜",
    interpretation_rating: "🧠",
    map_placement: "🗺️",
    change_detection: "🔄",
    evidence_gap_finding: "🕳️",
    causal_reasoning: "🔗",
    perspective_taking: "👁️",
  };
  return icons[type] || "📝";
}

function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case "intro": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "core": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "advanced": return "bg-oxblood-100 text-oxblood-700 dark:bg-oxblood-900/30 dark:text-oxblood-400";
    default: return "bg-line text-ink-2";
  }
}

export default ActivityPlayer;