"use client";

import { useMemo, useState } from "react";
import type { LearningActivity, UserActivityProgress, FSRSState, ActivityType } from "@timewise/historical-schemas";
import * as d3 from "d3-scale";

interface ProgressDashboardProps {
  activityProgress: Map<string, UserActivityProgress>;
  allActivities: LearningActivity[];
}

export function ProgressDashboard({ activityProgress, allActivities }: ProgressDashboardProps) {
  const [timeRange, setTimeRange] = useState<"week" | "month" | "all">("all");

  const stats = useMemo(() => calculateStats(activityProgress, allActivities, timeRange), [activityProgress, allActivities, timeRange]);
  const activityTypeStats = useMemo(() => calculateActivityTypeStats(activityProgress, allActivities), [activityProgress, allActivities]);
  const weeklyProgress = useMemo(() => calculateWeeklyProgress(activityProgress), [activityProgress]);
  const fsrsDistribution = useMemo(() => calculateFSRSDistribution(activityProgress), [activityProgress]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl">Progress Dashboard</h2>
          <p className="text-ink-2 mt-1">Track your learning journey and mastery over time</p>
        </div>
        <div className="flex gap-2">
          {["week", "month", "all"].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range as "week" | "month" | "all")}
              className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${
                timeRange === range
                  ? "bg-navy text-on-accent"
                  : "border border-line bg-paper hover:border-bronze"
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Activities"
          value={stats.totalActivities}
          subtitle={`${stats.completedActivities} completed`}
          icon="📚"
          trend={stats.completionRate}
        />
        <MetricCard
          label="XP Earned"
          value={stats.totalXP.toLocaleString()}
          subtitle={`${stats.averageXPPerActivity} avg per activity`}
          icon="⭐"
        />
        <MetricCard
          label="Current Streak"
          value={`${stats.streak} days`}
          subtitle={stats.longestStreak > stats.streak ? `Best: ${stats.longestStreak} days` : "Keep going!"}
          icon="🔥"
        />
        <MetricCard
          label="Mastery Level"
          value={stats.masteryLevel}
          subtitle={`${stats.masteryPercent}% of skills mastered`}
          icon="🏆"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Activity Type Breakdown */}
        <section className="bg-paper-2 border border-line rounded-lg p-5">
          <h3 className="font-serif text-lg mb-4">Activity Types</h3>
          <div className="space-y-3">
            {Object.entries(activityTypeStats).map(([type, data]) => (
              <ActivityTypeRow key={type} type={type as ActivityType} data={data} />
            ))}
          </div>
        </section>

        {/* FSRS Distribution */}
        <section className="bg-paper-2 border border-line rounded-lg p-5">
          <h3 className="font-serif text-lg mb-4">Memory Strength (FSRS)</h3>
          <div className="space-y-3">
            {[
              { label: "Strong (30+ days)", color: "bg-emerald-500", count: fsrsDistribution.strong },
              { label: "Moderate (7-30 days)", color: "bg-amber-500", count: fsrsDistribution.moderate },
              { label: "Weak (1-7 days)", color: "bg-orange-500", count: fsrsDistribution.weak },
              { label: "Due Now", color: "bg-oxblood-500", count: fsrsDistribution.due },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${item.color}`} />
                <span className="text-sm text-ink flex-1">{item.label}</span>
                <span className="font-mono text-navy">{item.count}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Weekly Progress Chart */}
      <section className="bg-paper-2 border border-line rounded-lg p-5">
        <h3 className="font-serif text-lg mb-4">Weekly Activity</h3>
        <WeeklyProgressChart data={weeklyProgress} />
      </section>

      {/* Recent Activity Feed */}
      <section className="bg-paper-2 border border-line rounded-lg p-5">
        <h3 className="font-serif text-lg mb-4">Recent Activity</h3>
        <ActivityFeed activities={allActivities} progress={activityProgress} />
      </section>
    </div>
  );
}

function calculateStats(
  progress: Map<string, UserActivityProgress>,
  activities: LearningActivity[],
  timeRange: "week" | "month" | "all"
) {
  const now = new Date();
  const cutoff = new Date(now);
  if (timeRange === "week") cutoff.setDate(now.getDate() - 7);
  else if (timeRange === "month") cutoff.setMonth(now.getMonth() - 1);

  const completed = activities.filter(a => progress.get(a.id)?.completedAt);
  const recentCompleted = completed.filter(a => {
    const completedAt = progress.get(a.id)?.completedAt;
    return completedAt && new Date(completedAt) >= cutoff;
  });

  // Calculate streak
  const completionDates = completed
    .map(a => progress.get(a.id)?.completedAt)
    .filter(Boolean)
    .map(d => new Date(d!).toDateString())
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  let streak = 0;
  let longestStreak = 0;
  let currentStreak = 0;
  const today = new Date().toDateString();

  completionDates.forEach((date, i) => {
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() - i);
    if (date === expectedDate.toDateString() || (i === 0 && date === today)) {
      currentStreak++;
    } else {
      currentStreak = 0;
    }
    longestStreak = Math.max(longestStreak, currentStreak);
  });
  streak = currentStreak;

  // Mastery level
  const totalSkills = new Set(activities.flatMap(a => a.skillTags)).size;
  const masteredSkills = new Set(
    activities
      .filter(a => progress.get(a.id)?.completedAt)
      .flatMap(a => a.skillTags)
  ).size;

  const totalXP = completed.reduce((sum, a) => sum + a.xpReward, 0);

  return {
    totalActivities: activities.length,
    completedActivities: completed.length,
    completionRate: activities.length > 0 ? Math.round((completed.length / activities.length) * 100) : 0,
    totalXP,
    averageXPPerActivity: completed.length > 0 ? Math.round(totalXP / completed.length) : 0,
    streak,
    longestStreak,
    masteryLevel: getMasteryLevel(masteredSkills, totalSkills),
    masteryPercent: totalSkills > 0 ? Math.round((masteredSkills / totalSkills) * 100) : 0,
  };
}

function getMasteryLevel(mastered: number, total: number): string {
  const pct = total > 0 ? mastered / total : 0;
  if (pct >= 0.9) return "Grandmaster";
  if (pct >= 0.7) return "Master";
  if (pct >= 0.5) return "Expert";
  if (pct >= 0.3) return "Practitioner";
  if (pct >= 0.1) return "Apprentice";
  return "Novice";
}

function calculateActivityTypeStats(progress: Map<string, UserActivityProgress>, activities: LearningActivity[]) {
  const types = [...new Set(activities.map(a => a.type))] as ActivityType[];
  const result: Record<string, { total: number; completed: number; avgScore: number; totalXP: number }> = {};

  types.forEach(type => {
    const typeActivities = activities.filter(a => a.type === type);
    const typeProgress = typeActivities.map(a => progress.get(a.id));
    const completed = typeProgress.filter((p): p is UserActivityProgress => p?.completedAt !== undefined);
    const avgScore = typeProgress.length > 0
      ? typeProgress.reduce((sum, p) => sum + (p?.bestScore || 0), 0) / typeProgress.length
      : 0;

    result[type] = {
      total: typeActivities.length,
      completed: completed.length,
      avgScore: Math.round(avgScore * 100),
      totalXP: completed.reduce((sum, p) => {
        const activity = typeActivities.find(a => a.id === p.activityId);
        return sum + (activity?.xpReward || 0);
      }, 0),
    };
  });

  return result;
}

function calculateWeeklyProgress(progress: Map<string, UserActivityProgress>) {
  const weeks: { week: string; completed: number; xp: number }[] = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (now.getDay() + 7 * i));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    let completed = 0;
    let xp = 0;

    progress.forEach(p => {
      if (p.completedAt) {
        const date = new Date(p.completedAt);
        if (date >= weekStart && date <= weekEnd) {
          completed++;
        }
      }
      if (p.lastAttemptAt) {
        const date = new Date(p.lastAttemptAt);
        if (date >= weekStart && date <= weekEnd) {
          xp += 10; // approximate
        }
      }
    });

    weeks.push({
      week: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      completed,
      xp,
    });
  }

  return weeks;
}

function calculateFSRSDistribution(progress: Map<string, UserActivityProgress>) {
  let strong = 0, moderate = 0, weak = 0, due = 0;
  const now = new Date();

  progress.forEach(p => {
    if (p.fsrs) {
      const daysUntilDue = (new Date(p.fsrs.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysUntilDue <= 0) due++;
      else if (daysUntilDue <= 7) weak++;
      else if (daysUntilDue <= 30) moderate++;
      else strong++;
    }
  });

  return { strong, moderate, weak, due };
}

function MetricCard({ label, value, subtitle, icon, trend }: {
  label: string;
  value: string | number;
  subtitle: string;
  icon: string;
  trend?: number;
}) {
  return (
    <div className="bg-paper-2 border border-line rounded-lg p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-ink-2">{label}</p>
          <p className="font-serif text-3xl font-bold text-ink mt-1">{value}</p>
          <p className="text-sm text-ink-2 mt-1">{subtitle}</p>
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1 text-sm">
          <span className={trend >= 50 ? "text-emerald-600" : "text-amber-600"}>
            {trend >= 50 ? "↑" : "→"}
          </span>
          <span className="text-ink-2">{trend}% completion</span>
        </div>
      )}
    </div>
  );
}

function ActivityTypeRow({ type, data }: { type: ActivityType; data: { total: number; completed: number; avgScore: number; totalXP: number } }) {
  const pct = data.total > 0 ? data.completed / data.total : 0;
  const labels: Record<ActivityType, string> = {
    timeline_ordering: "Timeline Ordering",
    source_matching: "Source Matching",
    interpretation_rating: "Interpretation Rating",
    map_placement: "Map Placement",
    change_detection: "Change Detection",
    evidence_gap_finding: "Evidence Gap Finding",
    causal_reasoning: "Causal Reasoning",
    perspective_taking: "Perspective Taking",
  };

  return (
    <div className="flex items-center gap-3">
      <div className="w-32 text-sm text-ink-2">{labels[type]}</div>
      <div className="flex-1 h-2 bg-line rounded-full overflow-hidden">
        <div
          className="h-full bg-navy transition-all"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <div className="w-20 text-right text-sm font-mono text-ink">
        {data.completed}/{data.total}
      </div>
      <div className="w-16 text-right text-xs text-ink-2">
        {data.avgScore}%
      </div>
    </div>
  );
}

function WeeklyProgressChart({ data }: { data: { week: string; completed: number; xp: number }[] }) {
  const maxCompleted = Math.max(...data.map(d => d.completed), 1);
  const barHeight = 24;
  const chartHeight = data.length * barHeight;

  return (
    <div className="h-[300px] flex items-end gap-2" style={{ height: chartHeight + 40 }}>
      {data.map((d, i) => (
        <div key={d.week} className="flex-1 flex flex-col items-center gap-1" style={{ minWidth: 40 }}>
          <div className="w-full flex items-end h-[200px]">
            <div
              className="w-full bg-navy rounded-t transition-all hover:bg-bronze"
              style={{ height: `${(d.completed / maxCompleted) * 200}px` }}
              title={`${d.week}: ${d.completed} activities, ${d.xp} XP`}
            />
          </div>
          <span className="text-xs text-ink-2 rotate-90 origin-bottom-left whitespace-nowrap" style={{ transformOrigin: 'left bottom' }}>
            {d.week}
          </span>
        </div>
      ))}
    </div>
  );
}

function ActivityFeed({ activities, progress }: { activities: LearningActivity[]; progress: Map<string, UserActivityProgress> }) {
  const recent = [...progress.values()]
    .filter(p => p.lastAttemptAt)
    .sort((a, b) => new Date(b.lastAttemptAt!).getTime() - new Date(a.lastAttemptAt!).getTime())
    .slice(0, 10);

  if (recent.length === 0) {
    return <p className="text-ink-2 text-center py-8">No activity yet. Start learning to see your progress!</p>;
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {recent.map(p => {
        const activity = activities.find(a => a.id === p.activityId);
        const isCompleted = !!p.completedAt;
        return (
          <div key={p.activityId} className="flex items-center justify-between p-3 bg-paper rounded-sm border border-line">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${isCompleted ? "bg-emerald-500" : "bg-amber-500"}`} />
              <div>
                <p className="font-medium text-sm text-ink">{activity?.prompt.en.split(".")[0] || "Activity"}</p>
                <p className="text-xs text-ink-2">
                  {new Date(p.lastAttemptAt!).toLocaleDateString()} · {Math.round((p.bestScore || 0) * 100)}% · {p.totalAttempts} attempt(s)
                </p>
              </div>
            </div>
            <span className="text-sm font-mono text-navy">+{activity?.xpReward || 0} XP</span>
          </div>
        );
      })}
    </div>
  );
}