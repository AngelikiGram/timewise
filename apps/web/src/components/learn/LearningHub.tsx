"use client";

import { useState, useMemo, useEffect } from "react";
import type { LearningActivity, ActivityType, ActivityDifficulty, UserActivityProgress, SkillNode } from "@timewise/historical-schemas";
import { austriaJourneyActivities, activitiesByJourney, activityById } from "@/lib/learning-activities";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SkillTree } from "./SkillTree";
import { ProgressDashboard } from "./ProgressDashboard";
import { ActivityLibrary } from "./ActivityLibrary";
import { EventGraph } from "./EventGraph";
import { buildEventGraph, applyForceLayout, applyTimelineLayout, applyGeoLayout, type EventGraph as EventGraphType } from "@/lib/event-graph";
import { eventsByDate, placeById } from "@/lib/collection";

const STORAGE_KEY = "timewise-learning-progress";

interface LearningHubProps {
  initialJourneyId?: string;
  initialChapterId?: string;
  initialActivityId?: string;
}

export function LearningHub({ initialJourneyId, initialChapterId, initialActivityId }: LearningHubProps) {
  const searchParams = useSearchParams();
  const [selectedJourneyId, setSelectedJourneyId] = useState(initialJourneyId || searchParams.get("journey") || "austria-1848-1921");
  const [selectedChapterId, setSelectedChapterId] = useState(initialChapterId || searchParams.get("chapter") || "");
  const [viewMode, setViewMode] = useState<"overview" | "library" | "graph" | "skill-tree" | "progress">("overview");
const [graphLayout, setGraphLayout] = useState<"force" | "time" | "geo">("force");
const [graphFilters, setGraphFilters] = useState<{
  themes: string[];
  countries: string[];
  connectionTypes: ("causal" | "temporal" | "thematic" | "geographic" | "person")[];
  search: string;
}>({
  themes: [],
  countries: [],
  connectionTypes: ["causal", "temporal", "thematic", "geographic", "person"],
  search: "",
});

const graph = useMemo(() => {
  const g = buildEventGraph({
    themes: graphFilters.themes,
    countries: graphFilters.countries,
    connectionTypes: graphFilters.connectionTypes,
    search: graphFilters.search,
  });
  let positioned = g.nodes;
  if (graphLayout === "force") positioned = applyForceLayout([...g.nodes], g.edges);
  else if (graphLayout === "time") positioned = applyTimelineLayout([...g.nodes]);
  else if (graphLayout === "geo") positioned = applyGeoLayout([...g.nodes]);
  return { ...g, nodes: positioned };
}, [graphLayout, graphFilters]);
  const [activityProgress, setActivityProgress] = useState<Map<string, UserActivityProgress>>(new Map());

  // Load progress from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setActivityProgress(new Map(Object.entries(JSON.parse(stored))));
      }
    } catch (e) {
      console.warn("Failed to load learning progress:", e);
    }
  }, []);

  const allActivities = useMemo(() => activitiesByJourney(selectedJourneyId), [selectedJourneyId]);
  const chapterActivities = useMemo(() =>
    selectedChapterId ? allActivities.filter(a => a.chapterId === selectedChapterId) : allActivities,
    [allActivities, selectedChapterId]
  );

  const completedCount = useMemo(() =>
    [...activityProgress.values()].filter(p => p.completedAt).length,
    [activityProgress]
  );

  const totalXP = useMemo(() =>
    allActivities
      .filter(a => activityProgress.get(a.id)?.completedAt)
      .reduce((sum, a) => sum + a.xpReward, 0),
    [allActivities, activityProgress]
  );

  const journeyChapters = useMemo(() => {
    const activitiesByChapter = new Map<string, LearningActivity[]>();
    allActivities.forEach(a => {
      const arr = activitiesByChapter.get(a.chapterId) || [];
      arr.push(a);
      activitiesByChapter.set(a.chapterId, arr);
    });
    return Array.from(activitiesByChapter.keys());
  }, [allActivities]);

  return (
    <div className="min-h-dvh bg-paper flex flex-col">
      {/* Header */}
      <header className="border-b border-line bg-paper-2 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-4">
            <div>
              <h1 className="font-serif text-2xl sm:text-3xl text-ink">Learning Hub</h1>
              <p className="text-sm text-ink-2 mt-1">Master historical thinking skills through evidence-grounded activities</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <JourneySelector
                value={selectedJourneyId}
                onChange={setSelectedJourneyId}
                journeyChapters={journeyChapters}
                selectedChapterId={selectedChapterId}
                onChapterChange={setSelectedChapterId}
              />
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex gap-1 border-t border-line pb-4" role="tablist">
            {[
              { id: "overview", label: "Overview", icon: "📊" },
              { id: "library", label: "Activities", icon: "📚" },
              { id: "graph", label: "Event Graph", icon: "🕸️" },
              { id: "skill-tree", label: "Skill Tree", icon: "🌳" },
              { id: "progress", label: "Progress", icon: "📈" },
            ].map(tab => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={viewMode === tab.id}
                onClick={() => setViewMode(tab.id as typeof viewMode)}
                className={`px-4 py-2 rounded-t-sm text-sm font-medium transition-colors ${
                  viewMode === tab.id
                    ? "bg-navy text-on-accent"
                    : "text-ink-2 hover:text-ink hover:bg-paper-3"
                }`}
              >
                <span className="flex items-center gap-1.5">{tab.icon} {tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {viewMode === "overview" && (
          <LearningOverview
            journeyId={selectedJourneyId}
            chapterId={selectedChapterId}
            chapterActivities={chapterActivities}
            completedCount={completedCount}
            totalActivities={chapterActivities.length}
            totalXP={totalXP}
            activityProgress={activityProgress}
            initialActivityId={initialActivityId}
          />
        )}
        {viewMode === "library" && (
          <ActivityLibrary
            activities={allActivities}
            activityProgress={activityProgress}
            journeyId={selectedJourneyId}
          />
        )}
        {viewMode === "skill-tree" && (
          <SkillTree
            journeyId={selectedJourneyId}
            activities={allActivities}
            activityProgress={activityProgress}
          />
        )}
        {viewMode === "graph" && (
          <div className="h-[calc(100vh-200px)] min-h-[600px]">
            <EventGraph
              initialNodes={graph.nodes}
              initialEdges={graph.edges}
              layout={graphLayout}
              onLayoutChange={setGraphLayout}
              onNodeSelect={() => {}}
              selectedNodeId={null}
              filters={graphFilters}
              onFiltersChange={setGraphFilters}
              availableThemes={graph.metadata.themes}
              availableCountries={graph.metadata.countries}
              onCreateJourney={(ids) => {
                const params = new URLSearchParams();
                params.set("events", ids.join(","));
                window.location.href = `/journey/auto?${params.toString()}`;
              }}
            />
          </div>
        )}
        {viewMode === "progress" && (
          <ProgressDashboard
            activityProgress={activityProgress}
            allActivities={allActivities}
          />
        )}
      </main>
    </div>
  );
}

function JourneySelector({
  value,
  onChange,
  journeyChapters,
  selectedChapterId,
  onChapterChange
}: {
  value: string;
  onChange: (v: string) => void;
  journeyChapters: string[];
  selectedChapterId: string;
  onChapterChange: (v: string) => void;
}) {
  // For now only Austria journey exists
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1 sm:w-64 px-3 py-2 rounded-sm border border-line bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-bronze"
      >
        <option value="austria-1848-1921">How Austria Changed, 1848–1921</option>
      </select>
      {journeyChapters.length > 0 && (
        <select
          value={selectedChapterId}
          onChange={e => onChapterChange(e.target.value)}
          className="flex-1 sm:w-48 px-3 py-2 rounded-sm border border-line bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-bronze"
        >
          <option value="">All Chapters</option>
          {journeyChapters.map(ch => (
            <option key={ch} value={ch}>{ch}</option>
          ))}
        </select>
      )}
    </div>
  );
}

function LearningOverview({
  journeyId,
  chapterId,
  chapterActivities,
  completedCount,
  totalActivities,
  totalXP,
  activityProgress,
  initialActivityId,
}: {
  journeyId: string;
  chapterId: string;
  chapterActivities: LearningActivity[];
  completedCount: number;
  totalActivities: number;
  totalXP: number;
  activityProgress: Map<string, UserActivityProgress>;
  initialActivityId?: string;
}) {
  const progressPercent = totalActivities > 0 ? Math.round((completedCount / totalActivities) * 100) : 0;

  // Find next recommended activity
  const nextActivity = useMemo(() => {
    return chapterActivities.find(a => !activityProgress.get(a.id)?.completedAt);
  }, [chapterActivities, activityProgress]);

  // Find due for review (FSRS)
  const dueForReview = useMemo(() => {
    const now = new Date();
    return chapterActivities.filter(a => {
      const p = activityProgress.get(a.id);
      return p?.nextReviewAt && new Date(p.nextReviewAt) <= now && !p.completedAt;
    });
  }, [chapterActivities, activityProgress]);

  return (
    <div className="space-y-6">
      {/* Progress Summary */}
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Completed" value={`${completedCount} / ${totalActivities}`} icon="✓" />
        <StatCard label="Progress" value={`${progressPercent}%`} icon="📊" />
        <StatCard label="XP Earned" value={totalXP.toString()} icon="⭐" />
      </section>

      {/* Next Activity CTA */}
      {nextActivity && (
        <section className="bg-paper-2 border border-line rounded-lg p-5">
          <h2 className="font-serif text-xl mb-2">Continue Learning</h2>
          <p className="text-ink-2 mb-4">{nextActivity.prompt.en}</p>
          <Link
            href={`/learn/activities/${nextActivity.id}?journey=${journeyId}${chapterId ? `&chapter=${chapterId}` : ""}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-navy text-on-accent rounded-sm font-medium hover:opacity-90 transition-opacity"
          >
            {nextActivity.type.replace("_", " ")}
          </Link>
        </section>
      )}

      {/* Due for Review */}
      {dueForReview.length > 0 && (
        <section>
          <h2 className="font-serif text-xl mb-3">Due for Review ({dueForReview.length})</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dueForReview.slice(0, 6).map(activity => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                progress={activityProgress.get(activity.id)}
                journeyId={journeyId}
                chapterId={activity.chapterId}
              />
            ))}
          </div>
        </section>
      )}

      {/* Chapter Progress */}
      <section>
        <h2 className="font-serif text-xl mb-3">Chapter Activities</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {chapterActivities.map(activity => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              progress={activityProgress.get(activity.id)}
              journeyId={journeyId}
              chapterId={activity.chapterId}
              highlight={activity.id === initialActivityId}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-paper-2 border border-line rounded-lg p-5 text-center">
      <div className="text-3xl mb-2">{icon}</div>
      <div className="font-serif text-3xl font-bold text-ink">{value}</div>
      <div className="text-sm text-ink-2 mt-1">{label}</div>
    </div>
  );
}

function ActivityCard({
  activity,
  progress,
  journeyId,
  chapterId,
  highlight = false
}: {
  activity: LearningActivity;
  progress?: UserActivityProgress;
  journeyId: string;
  chapterId: string;
  highlight?: boolean;
}) {
  const isCompleted = !!progress?.completedAt;
  const bestScore = progress?.bestScore ?? 0;
  const attempts = progress?.totalAttempts ?? 0;

  return (
    <Link
      href={`/learn/activities/${activity.id}?journey=${journeyId}&chapter=${chapterId}`}
      className={`group block p-4 rounded-lg border transition-all ${
        highlight
          ? "border-bronze bg-bronze-50 dark:border-bronze-700 dark:bg-bronze-900/20 ring-2 ring-bronze"
          : isCompleted
            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
            : "border-line bg-paper hover:border-bronze hover:bg-paper-2"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${getDifficultyColor(activity.difficulty)}`}>
          {activity.difficulty}
        </span>
        {isCompleted && (
          <span className="text-emerald-600 dark:text-emerald-400">✓</span>
        )}
      </div>
      <h3 className="font-serif text-base font-medium text-ink group-hover:text-bronze transition-colors line-clamp-2">
        {activity.prompt.en.split(".")[0]}
      </h3>
      <p className="text-xs text-ink-2 mt-1 capitalize">{activity.type.replace("_", " ")}</p>
      <div className="mt-3 flex items-center justify-between text-xs text-ink-2">
        <span>+{activity.xpReward} XP</span>
        <span>{attempts} attempt{attempts !== 1 ? "s" : ""}</span>
        {bestScore > 0 && <span>{Math.round(bestScore * 100)}% best</span>}
      </div>
      {progress?.nextReviewAt && (
        <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          🔄 Due for review
        </div>
      )}
    </Link>
  );
}

function getDifficultyColor(difficulty: ActivityDifficulty): string {
  switch (difficulty) {
    case "intro": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "core": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "advanced": return "bg-oxblood-100 text-oxblood-700 dark:bg-oxblood-900/30 dark:text-oxblood-400";
  }
}