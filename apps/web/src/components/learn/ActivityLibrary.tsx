"use client";

import { useState, useMemo } from "react";
import type { LearningActivity, ActivityType, ActivityDifficulty, UserActivityProgress } from "@timewise/historical-schemas";
import { ActivityTypeSchema, ActivityDifficultySchema } from "@timewise/historical-schemas";
import Link from "next/link";

interface ActivityLibraryProps {
  activities: LearningActivity[];
  activityProgress: Map<string, UserActivityProgress>;
  journeyId: string;
}

const ACTIVITY_TYPE_LABELS: Record<ActivityType, { label: string; icon: string; description: string }> = {
  timeline_ordering: { label: "Timeline Ordering", icon: "📅", description: "Drag events into chronological order" },
  source_matching: { label: "Source Matching", icon: "📜", description: "Match claims to supporting passages" },
  interpretation_rating: { label: "Interpretation Rating", icon: "🧠", description: "Classify statements by evidentiary status" },
  map_placement: { label: "Map Placement", icon: "🗺️", description: "Place events on the map" },
  change_detection: { label: "Change Detection", icon: "🔄", description: "Compare map layers across time" },
  evidence_gap_finding: { label: "Evidence Gap Finding", icon: "🕳️", description: "Identify missing evidence types" },
  causal_reasoning: { label: "Causal Reasoning", icon: "🔗", description: "Build causal chains with confidence" },
  perspective_taking: { label: "Perspective Taking", icon: "👁️", description: "Contemporary vs retrospective views" },
};

const DIFFICULTY_ORDER: ActivityDifficulty[] = ["intro", "core", "advanced"];

export function ActivityLibrary({ activities, activityProgress, journeyId }: ActivityLibraryProps) {
  const [filters, setFilters] = useState({
    types: [] as ActivityType[],
    difficulties: [] as ActivityDifficulty[],
    skills: [] as string[],
    status: "all" as "all" | "completed" | "in-progress" | "not-started" | "due",
    search: "",
  });
  const [sortBy, setSortBy] = useState<"difficulty" | "type" | "xp" | "progress" | "title">("difficulty");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const allSkills = useMemo(() =>
    [...new Set(activities.flatMap(a => a.skillTags))].sort(),
    [activities]
  );

  const filteredActivities = useMemo(() => {
    let result = activities;

    // Search filter
    if (filters.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(a =>
        a.prompt.en.toLowerCase().includes(search) ||
        a.prompt.de?.toLowerCase().includes(search) ||
        a.type.toLowerCase().includes(search) ||
        a.skillTags.some(t => t.toLowerCase().includes(search))
      );
    }

    // Type filter
    if (filters.types.length > 0) {
      result = result.filter(a => filters.types.includes(a.type));
    }

    // Difficulty filter
    if (filters.difficulties.length > 0) {
      result = result.filter(a => filters.difficulties.includes(a.difficulty));
    }

    // Skill filter
    if (filters.skills.length > 0) {
      result = result.filter(a => filters.skills.some(s => a.skillTags.includes(s)));
    }

    // Status filter
    if (filters.status !== "all") {
      result = result.filter(a => {
        const p = activityProgress.get(a.id);
        switch (filters.status) {
          case "completed": return !!p?.completedAt;
          case "in-progress": return !!p?.totalAttempts && !p?.completedAt;
          case "not-started": return !p?.totalAttempts;
          case "due": return !!p?.nextReviewAt && new Date(p.nextReviewAt) <= new Date() && !p?.completedAt;
          default: return true;
        }
      });
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "difficulty": {
          const diffA = DIFFICULTY_ORDER.indexOf(a.difficulty);
          const diffB = DIFFICULTY_ORDER.indexOf(b.difficulty);
          return diffA - diffB;
        }
        case "type": return a.type.localeCompare(b.type);
        case "xp": return b.xpReward - a.xpReward;
        case "progress": {
          const progA = activityProgress.get(a.id)?.bestScore || 0;
          const progB = activityProgress.get(b.id)?.bestScore || 0;
          return progB - progA;
        }
        case "title": return a.prompt.en.localeCompare(b.prompt.en);
      }
    });

    return result;
  }, [activities, activityProgress, filters, sortBy]);

  const completedCount = filteredActivities.filter(a => activityProgress.get(a.id)?.completedAt).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl">Activity Library</h2>
          <p className="text-ink-2 mt-1">
            {filteredActivities.length} activities ({completedCount} completed)
            {filters.search && ` matching "${filters.search}"`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-1.5 rounded-sm border border-line bg-paper text-sm"
          >
            <option value="difficulty">Difficulty</option>
            <option value="type">Type</option>
            <option value="xp">XP Reward</option>
            <option value="progress">Progress</option>
            <option value="title">Title</option>
          </select>
          <div className="flex gap-1 border border-line rounded-sm">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1.5 text-sm ${viewMode === "grid" ? "bg-navy text-on-accent" : "text-ink-2 hover:text-ink"}`}
            >⊞</button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 text-sm ${viewMode === "list" ? "bg-navy text-on-accent" : "text-ink-2 hover:text-ink"}`}
            >☰</button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-paper-2 border border-line rounded-lg p-4 space-y-4">
        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-ink-2 mb-2">Search</label>
          <input
            type="text"
            placeholder="Search activities, skills, types..."
            value={filters.search}
            onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="w-full px-3 py-2 rounded-sm border border-line bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-bronze"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap gap-2">
          <FilterChipGroup
            label="Type"
            options={ActivityTypeSchema.options.map(o => ({ value: o, label: ACTIVITY_TYPE_LABELS[o as ActivityType]?.label || o }))}
            selected={filters.types}
            onChange={vals => setFilters(prev => ({ ...prev, types: vals }))}
            renderOption={({ value, selected, onClick }) => (
              <FilterChip
                key={value}
                label={ACTIVITY_TYPE_LABELS[value as ActivityType]?.label || value}
                icon={ACTIVITY_TYPE_LABELS[value as ActivityType]?.icon}
                selected={selected}
                onClick={onClick}
              />
            )}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterChipGroup
            label="Difficulty"
            options={DIFFICULTY_ORDER.map(d => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) }))}
            selected={filters.difficulties}
            onChange={vals => setFilters(prev => ({ ...prev, difficulties: vals }))}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterChipGroup
            label="Skills"
            options={allSkills.map(s => ({ value: s, label: s.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") }))}
            selected={filters.skills}
            onChange={vals => setFilters(prev => ({ ...prev, skills: vals }))}
            maxVisible={6}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterChipGroup<"all" | "completed" | "in-progress" | "not-started" | "due">
            label="Status"
            options={[
              { value: "all", label: "All" },
              { value: "completed", label: "Completed" },
              { value: "in-progress", label: "In Progress" },
              { value: "not-started", label: "Not Started" },
              { value: "due", label: "Due for Review" },
            ]}
            selected={filters.status}
            onChange={vals => setFilters(prev => ({ ...prev, status: vals[0] || "all" }))}
            single
          />
        </div>

        {Object.keys(filters).some(k => {
          const v = filters[k as keyof typeof filters];
          return Array.isArray(v) ? v.length > 0 : v !== "all" && v !== "";
        }) && (
          <button
            onClick={() => setFilters({ types: [], difficulties: [], skills: [], status: "all", search: "" })}
            className="text-sm text-bronze hover:underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Activity List */}
      {viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredActivities.map(activity => (
            <ActivityCard key={activity.id} activity={activity} progress={activityProgress.get(activity.id)} journeyId={journeyId} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredActivities.map(activity => (
            <ActivityRow key={activity.id} activity={activity} progress={activityProgress.get(activity.id)} journeyId={journeyId} />
          ))}
        </div>
      )}

      {filteredActivities.length === 0 && (
        <div className="text-center py-12 text-ink-2">
          <p className="text-xl mb-2">No activities match your filters</p>
          <button
            onClick={() => setFilters({ types: [], difficulties: [], skills: [], status: "all", search: "" })}
            className="text-bronze hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}

function FilterChipGroup<T>({
  label,
  options,
  selected,
  onChange,
  renderOption,
  maxVisible,
  single = false
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[] | T;
  onChange: (vals: T[]) => void;
  renderOption?: ({ value, selected, onClick }: { value: T; selected: boolean; onClick: () => void }) => React.ReactNode;
  maxVisible?: number;
  single?: boolean;
}) {
  const selectedArray = Array.isArray(selected) ? selected : [selected];
  const visibleOptions = maxVisible ? options.slice(0, maxVisible) : options;
  const hasMore = maxVisible && options.length > maxVisible;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-ink-2 uppercase tracking-wider">{label}</span>
      {visibleOptions.map(opt => {
        const isSelected = single ? selectedArray[0] === opt.value : selectedArray.includes(opt.value);
        if (renderOption) {
          return renderOption({ value: opt.value, selected: isSelected, onClick: () => {
            if (single) {
              onChange(isSelected ? [] : [opt.value]);
            } else {
              onChange(isSelected ? selectedArray.filter(v => v !== opt.value) : [...selectedArray, opt.value]);
            }
          }});
        }
        return (
          <FilterChip
            key={String(opt.value)}
            label={opt.label}
            selected={isSelected}
            onClick={() => {
              if (single) {
                onChange(isSelected ? [] : [opt.value]);
              } else {
                onChange(isSelected ? selectedArray.filter(v => v !== opt.value) : [...selectedArray, opt.value]);
              }
            }}
          />
        );
      })}
      {hasMore && (
        <button className="px-2 py-1 text-xs text-ink-2 hover:text-bronze">+{options.length - maxVisible} more</button>
      )}
    </div>
  );
}

function FilterChip({ label, icon, selected, onClick }: { label: string; icon?: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
        selected
          ? "bg-navy text-on-accent"
          : "bg-paper border border-line text-ink-2 hover:border-bronze hover:bg-paper-2"
      }`}
    >
      {icon && <span>{icon}</span>}
      {label}
    </button>
  );
}

function ActivityCard({ activity, progress, journeyId }: { activity: LearningActivity; progress?: UserActivityProgress; journeyId: string }) {
  const isCompleted = !!progress?.completedAt;
  const bestScore = progress?.bestScore ?? 0;
  const attempts = progress?.totalAttempts ?? 0;
  const isDue = progress?.nextReviewAt && new Date(progress.nextReviewAt) <= new Date() && !isCompleted;

  const typeInfo = ACTIVITY_TYPE_LABELS[activity.type];

  return (
    <Link
      href={`/learn/activities/${activity.id}?journey=${journeyId}&chapter=${activity.chapterId}`}
      className={`group block p-4 rounded-lg border transition-all ${
        isCompleted
          ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
          : isDue
            ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
            : "border-line bg-paper hover:border-bronze hover:bg-paper-2"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-2xl">{typeInfo.icon}</span>
        <div className="flex items-center gap-1.5">
          {isCompleted && <span className="text-emerald-600">✓</span>}
          {isDue && <span className="text-amber-600" title="Due for review">🔄</span>}
        </div>
      </div>

      <div className="mb-2">
        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${getDifficultyColor(activity.difficulty)}`}>
          {activity.difficulty}
        </span>
        <span className="ml-2 text-xs text-ink-2 capitalize">{activity.type.replace("_", " ")}</span>
      </div>

      <h3 className="font-serif text-base font-medium text-ink group-hover:text-bronze transition-colors line-clamp-2 mb-2">
        {activity.prompt.en.split(".")[0]}
      </h3>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {activity.skillTags.slice(0, 3).map(tag => (
          <span key={tag} className="px-2 py-0.5 text-xs bg-paper-3 border border-line rounded text-ink-2">
            {tag.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
          </span>
        ))}
        {activity.skillTags.length > 3 && (
          <span className="px-2 py-0.5 text-xs bg-paper-3 border border-line rounded text-ink-2">
            +{activity.skillTags.length - 3}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-ink-2 pt-2 border-t border-line">
        <span>+{activity.xpReward} XP</span>
        <span>{attempts} attempt{attempts !== 1 ? "s" : ""}</span>
        {bestScore > 0 && <span>{Math.round(bestScore * 100)}% best</span>}
      </div>

      {progress?.nextReviewAt && (
        <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <span>🔄</span> Due for review
        </div>
      )}
    </Link>
  );
}

function ActivityRow({ activity, progress, journeyId }: { activity: LearningActivity; progress?: UserActivityProgress; journeyId: string }) {
  const isCompleted = !!progress?.completedAt;
  const bestScore = progress?.bestScore ?? 0;
  const attempts = progress?.totalAttempts ?? 0;
  const typeInfo = ACTIVITY_TYPE_LABELS[activity.type];

  return (
    <Link
      href={`/learn/activities/${activity.id}?journey=${journeyId}&chapter=${activity.chapterId}`}
      className={`group flex items-center gap-4 p-3 rounded-lg border transition-all ${
        isCompleted
          ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
          : "border-line bg-paper hover:border-bronze hover:bg-paper-2"
      }`}
    >
      <span className="text-2xl shrink-0">{typeInfo.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-serif text-base font-medium text-ink group-hover:text-bronze transition-colors truncate">
            {activity.prompt.en}
          </h3>
          {isCompleted && <span className="text-emerald-600 shrink-0">✓</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getDifficultyColor(activity.difficulty)}`}>
            {activity.difficulty}
          </span>
          <span className="px-2 py-0.5 rounded text-xs bg-paper-3 border border-line">{activity.type.replace("_", " ")}</span>
          {activity.skillTags.slice(0, 2).map(tag => (
            <span key={tag} className="px-2 py-0.5 rounded text-xs bg-paper-3 border border-line">
              {tag.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          <p className="font-mono text-navy">+{activity.xpReward} XP</p>
          <p className="text-xs text-ink-2">{attempts} attempt{attempts !== 1 ? "s" : ""}</p>
        </div>
        {bestScore > 0 && (
          <div className="w-16 h-2 bg-line rounded-full overflow-hidden">
            <div className="h-full bg-navy" style={{ width: `${bestScore * 100}%` }} />
          </div>
        )}
      </div>
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