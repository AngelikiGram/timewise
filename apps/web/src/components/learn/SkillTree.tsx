"use client";

import { useMemo } from "react";
import type { LearningActivity, UserActivityProgress, SkillNode, SkillTree } from "@timewise/historical-schemas";
import { activitiesByJourney } from "@/lib/learning-activities";

interface SkillTreeProps {
  journeyId: string;
  activities: LearningActivity[];
  activityProgress: Map<string, UserActivityProgress>;
}

// Generate skill tree from activities
function generateSkillTree(activities: LearningActivity[], progress: Map<string, UserActivityProgress>): SkillNode[] {
  const skillMap = new Map<string, {
    id: string;
    label: { en: string; de?: string };
    description: { en: string; de?: string };
    activityIds: string[];
    prerequisites: string[];
    xpToMaster: number;
    icon?: string;
  }>();

  // Group activities by skill tags
  activities.forEach(activity => {
    activity.skillTags.forEach(tag => {
      if (!skillMap.has(tag)) {
        skillMap.set(tag, {
          id: tag,
          label: { en: tag.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "), de: tag },
          description: { en: `Skills related to ${tag.replace("-", " ")}`, de: `Fähigkeiten zu ${tag.replace("-", " ")}` },
          activityIds: [],
          prerequisites: [],
          xpToMaster: 100,
        });
      }
      const skill = skillMap.get(tag)!;
      if (!skill.activityIds.includes(activity.id)) {
        skill.activityIds.push(activity.id);
      }
    });
  });

  // Add prerequisite relationships based on activity prerequisites
  activities.forEach(activity => {
    activity.prerequisites.forEach(preqId => {
      const preqActivity = activities.find(a => a.id === preqId);
      if (preqActivity) {
        preqActivity.skillTags.forEach(preqTag => {
          activity.skillTags.forEach(tag => {
            if (preqTag !== tag) {
              const skill = skillMap.get(tag);
              if (skill && !skill.prerequisites.includes(preqTag)) {
                skill.prerequisites.push(preqTag);
              }
            }
          });
        });
      }
    });
  });

  return Array.from(skillMap.values()).map(skill => {
    const completedActivities = skill.activityIds.filter(id => progress.get(id)?.completedAt).length;
    const totalXpEarned = skill.activityIds
      .filter(id => progress.get(id)?.completedAt)
      .reduce((sum, id) => sum + (activities.find(a => a.id === id)?.xpReward || 0), 0);
    const mastered = completedActivities === skill.activityIds.length && skill.activityIds.length > 0;

    return {
      ...skill,
      region: "austria",
      theme: "historical-thinking",
      xpToMaster: skill.xpToMaster,
    } as SkillNode;
  });
}

export function SkillTree({ journeyId, activities, activityProgress }: SkillTreeProps) {
  const skillNodes = useMemo(() => generateSkillTree(activities, activityProgress), [activities, activityProgress]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl">Skill Tree</h2>
          <p className="text-ink-2 mt-1">Visualize your mastery of historical thinking skills</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm text-ink-2 bg-paper-2 border border-line rounded-lg p-4">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Mastered</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500"></span> In Progress</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-line"></span> Not Started</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-bronze border-2 border-bronze"></span> Prerequisite Locked</span>
      </div>

      {/* Skill Tree Visualization */}
      <div className="bg-paper-2 border border-line rounded-lg p-6 min-h-[400px] relative overflow-auto">
        <svg
          className="w-full h-auto"
          viewBox="0 0 1200 600"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Connections */}
          <g stroke="currentColor" stroke-width="2" stroke-dasharray="5,5" opacity="0.3">
            {skillNodes.flatMap(node =>
              node.prerequisites.map(preqId => {
                const preq = skillNodes.find(n => n.id === preqId);
                if (!preq) return null;
                const from = getNodePosition(preq.id, skillNodes);
                const to = getNodePosition(node.id, skillNodes);
                return (
                  <line
                    key={`${preqId}-${node.id}`}
                    x1={from.x} y1={from.y + 40}
                    x2={to.x} y2={to.y - 40}
                    stroke="currentColor"
                  />
                );
              })
            )}
          </g>

          {/* Nodes */}
          {skillNodes.map((node, index) => {
            const pos = getNodePosition(node.id, skillNodes);
            const completedCount = node.activityIds.filter(id => activityProgress.get(id)?.completedAt).length;
            const isMastered = completedCount === node.activityIds.length && node.activityIds.length > 0;
            const isStarted = completedCount > 0;
            const isLocked = node.prerequisites.some(p => {
              const preqSkill = skillNodes.find(s => s.id === p);
              return preqSkill && preqSkill.activityIds.some(id => !activityProgress.get(id)?.completedAt);
            });

            const nodeColor = isMastered
              ? "url(#mastered-gradient)"
              : isStarted
                ? "url(#progress-gradient)"
                : isLocked
                  ? "url(#locked-gradient)"
                  : "url(#idle-gradient)";

            return (
              <g key={node.id} className="cursor-pointer">
                {/* Node circle */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={40}
                  fill={nodeColor}
                  stroke={isMastered ? "#10b981" : isStarted ? "#f59e0b" : isLocked ? "#d97706" : "#9ca3af"}
                  strokeWidth={isMastered || isStarted ? 3 : 2}
                  filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
                />
                {/* Icon or initial */}
                <text
                  x={pos.x}
                  y={pos.y + 5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="20"
                  fill={isMastered || isStarted ? "white" : "#6b7280"}
                >
                  {getSkillIcon(node.id)}
                </text>
                {/* Mastery badge */}
                {isMastered && (
                  <g>
                    <circle cx={pos.x + 28} cy={pos.y - 28} r={12} fill="#10b981" />
                    <text x={pos.x + 28} y={pos.y - 24} textAnchor="middle" fontSize="12" fill="white" fontWeight="bold">✓</text>
                  </g>
                )}
                {/* Lock icon */}
                {isLocked && !isStarted && (
                  <g>
                    <circle cx={pos.x + 28} cy={pos.y - 28} r={12} fill="#9ca3af" />
                    <text x={pos.x + 28} y={pos.y - 24} textAnchor="middle" fontSize="14" fill="white">🔒</text>
                  </g>
                )}
                {/* Label */}
                <text
                  x={pos.x}
                  y={pos.y + 60}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#374151"
                  fontWeight={isMastered ? "bold" : "normal"}
                >
                  {node.label.en.split(" ").map((w, i) => (
                    <tspan key={i} x={pos.x} dy={i === 0 ? 0 : "1.2em"}>{w}</tspan>
                  ))}
                </text>
                {/* Progress */}
                {node.activityIds.length > 0 && (
                  <text
                    x={pos.x}
                    y={pos.y + 85}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#9ca3af"
                  >
                    {completedCount}/{node.activityIds.length}
                  </text>
                )}
              </g>
            );
          })}

          {/* Gradients */}
          <defs>
            <linearGradient id="mastered-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d1fae5" />
              <stop offset="100%" stopColor="#a7f3d0" />
            </linearGradient>
            <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef3c7" />
              <stop offset="100%" stopColor="#fde68a" />
            </linearGradient>
            <linearGradient id="idle-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f3f4f6" />
              <stop offset="100%" stopColor="#e5e7eb" />
            </linearGradient>
            <linearGradient id="locked-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef3c7" />
              <stop offset="100%" stopColor="#fde68a" />
            </linearGradient>
          </defs>
        </svg>

        {/* Skill Details Panel */}
        <SkillDetailPanel skillNodes={skillNodes} activityProgress={activityProgress} activities={activities} />
      </div>
    </div>
  );
}

function getNodePosition(skillId: string, skillNodes: SkillNode[]): { x: number; y: number } {
  const index = skillNodes.findIndex(n => n.id === skillId);
  const cols = 4;
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    x: 100 + col * 280,
    y: 120 + row * 180,
  };
}

function getSkillIcon(skillId: string): string {
  const icons: Record<string, string> = {
    "chronological-reasoning": "📅",
    "source-criticism": "📜",
    "evidence-evaluation": "🔍",
    "historical-interpretation": "🧠",
    "historiography": "📚",
    "map-reading": "🗺️",
    "spatial-reasoning": "📐",
    "industrial-history": "🚂",
    "change-detection": "🔄",
    "urban-history": "🏙️",
    "map-comparison": "🗺️",
    "causal-reasoning": "🔗",
    "historical-method": "🔬",
    "hindsight-mode": "👁️",
    "historical-empathy": "💭",
    "contingency": "🎲",
    "source-gaps": "🕳️",
    "diplomatic-history": "🤝",
  };
  return icons[skillId] || "⭐";
}

function SkillDetailPanel({ skillNodes, activityProgress, activities }: { skillNodes: SkillNode[]; activityProgress: Map<string, UserActivityProgress>; activities: LearningActivity[] }) {
  // This would be a side panel showing details on hover/click
  // For now, render as a list below the graph
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {skillNodes.map(node => {
        const completedCount = node.activityIds.filter(id => activityProgress.get(id)?.completedAt).length;
        const isMastered = completedCount === node.activityIds.length && node.activityIds.length > 0;
        const isStarted = completedCount > 0;
        const totalXp = node.activityIds
          .filter(id => activityProgress.get(id)?.completedAt)
          .reduce((sum, id) => sum + (activities.find(a => a.id === id)?.xpReward || 0), 0);

        return (
          <div
            key={node.id}
            className={`p-4 rounded-lg border transition-colors ${
              isMastered ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
              : isStarted ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
              : "border-line bg-paper"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{getSkillIcon(node.id)}</span>
              <h4 className="font-semibold text-ink">{node.label.en}</h4>
              {isMastered && <span className="text-emerald-600 text-sm">✓ Mastered</span>}
            </div>
            <p className="text-sm text-ink-2 mb-2">{node.description.en}</p>
            <div className="flex items-center justify-between text-xs text-ink-2">
              <span>{completedCount}/{node.activityIds.length} activities</span>
              <span>+{totalXp} XP</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}