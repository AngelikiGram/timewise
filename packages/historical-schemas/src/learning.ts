import { z } from "zod";

/** English is required; other locales slot in without a schema change. */
const LocalizedText = z.object({ en: z.string().min(1), de: z.string().optional() });

/** Types of interactive learning activities. All are evidence-grounded. */
export const ActivityTypeSchema = z.enum([
  "timeline_ordering",      // Drag events into chronological order
  "map_placement",          // Place event markers on map
  "source_matching",        // Match claim to supporting passage
  "interpretation_rating",  // Classify: documented / interpretation / disputed
  "change_detection",       // Compare two map layers, identify changes
  "evidence_gap_finding",   // Identify claims lacking primary sources
  "causal_reasoning",       // Arrange events in causal chains
  "perspective_taking",     // Contemporary vs retrospective accounts
]);

/** Difficulty tier for activity sequencing and XP rewards. */
export const ActivityDifficultySchema = z.enum(["intro", "core", "advanced"]);

/** Answer key formats per activity type (discriminated union). */
export const TimelineOrderingAnswerSchema = z.object({
  type: z.literal("timeline_ordering"),
  eventIds: z.array(z.string()).min(2), // Correct chronological order
});

export const MapPlacementAnswerSchema = z.object({
  type: z.literal("map_placement"),
  placements: z.array(z.object({
    eventId: z.string(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    toleranceKm: z.number().positive().default(5), // Acceptable radius
  })).min(1),
});

export const SourceMatchingAnswerSchema = z.object({
  type: z.literal("source_matching"),
  matches: z.array(z.object({
    claimId: z.string(),
    sourceId: z.string(),
    locator: z.string(), // Text fragment that supports the claim
  })).min(1),
});

export const InterpretationRatingAnswerSchema = z.object({
  type: z.literal("interpretation_rating"),
  ratings: z.array(z.object({
    statementId: z.string(), // Claim ID or custom statement
    rating: z.enum(["documented", "corroborated", "reference", "interpretation", "disputed", "inferred", "missing"]),
  })).min(1),
});

export const ChangeDetectionAnswerSchema = z.object({
  type: z.literal("change_detection"),
  changes: z.array(z.object({
    geometryId: z.string(),
    changeType: z.enum(["appeared", "disappeared", "modified", "unchanged"]),
    description: z.string(),
  })).min(1),
});

export const EvidenceGapFindingAnswerSchema = z.object({
  type: z.literal("evidence_gap_finding"),
  gaps: z.array(z.object({
    claimId: z.string(),
    missingEvidenceType: z.enum(["primary_source", "corroboration", "contemporary_account", "precise_date", "precise_location"]),
  })).min(1),
});

export const CausalReasoningAnswerSchema = z.object({
  type: z.literal("causal_reasoning"),
  chains: z.array(z.object({
    causeEventId: z.string(),
    effectEventId: z.string(),
    confidence: z.enum(["explicit_in_sources", "plausible_inference", "speculative"]),
    note: z.string().optional(),
  })).min(1),
});

export const PerspectiveTakingAnswerSchema = z.object({
  type: z.literal("perspective_taking"),
  comparisons: z.array(z.object({
    eventId: z.string(),
    contemporaryView: z.string(), // What was known at the time
    retrospectiveView: z.string(), // What historians know now
    keyDifference: z.string(),
  })).min(1),
});

export const ActivityAnswerSchema = z.discriminatedUnion("type", [
  TimelineOrderingAnswerSchema,
  MapPlacementAnswerSchema,
  SourceMatchingAnswerSchema,
  InterpretationRatingAnswerSchema,
  ChangeDetectionAnswerSchema,
  EvidenceGapFindingAnswerSchema,
  CausalReasoningAnswerSchema,
  PerspectiveTakingAnswerSchema,
]);

/** A single learning activity, grounded in claims/events from a journey chapter. */
export const LearningActivitySchema = z.object({
  id: z.string(),
  journeyId: z.string(),
  chapterId: z.string(),
  type: ActivityTypeSchema,
  prompt: LocalizedText,
  /** Claims this activity draws on — every answer must be derivable from these. */
  claimIds: z.array(z.string()).min(1),
  /** Events this activity references (for map/timeline context). */
  eventIds: z.array(z.string()).default([]),
  /** Correct answer with validation logic. */
  correctAnswer: ActivityAnswerSchema,
  /** Explanation shown after submission, with source references. */
  explanation: LocalizedText,
  difficulty: ActivityDifficultySchema,
  estimatedMinutes: z.number().int().positive().default(5),
  xpReward: z.number().int().positive().default(10),
  /** Prerequisite activities (by ID) that should be completed first. */
  prerequisites: z.array(z.string()).default([]),
  /** Tags for skill tree mapping. */
  skillTags: z.array(z.string()).default([]),
});

export type ActivityType = z.infer<typeof ActivityTypeSchema>;
export type ActivityDifficulty = z.infer<typeof ActivityDifficultySchema>;
export type ActivityAnswer = z.infer<typeof ActivityAnswerSchema>;
export type LearningActivity = z.infer<typeof LearningActivitySchema>;
export type TimelineOrderingAnswer = z.infer<typeof TimelineOrderingAnswerSchema>;
export type MapPlacementAnswer = z.infer<typeof MapPlacementAnswerSchema>;
export type SourceMatchingAnswer = z.infer<typeof SourceMatchingAnswerSchema>;
export type InterpretationRatingAnswer = z.infer<typeof InterpretationRatingAnswerSchema>;
export type ChangeDetectionAnswer = z.infer<typeof ChangeDetectionAnswerSchema>;
export type EvidenceGapFindingAnswer = z.infer<typeof EvidenceGapFindingAnswerSchema>;
export type CausalReasoningAnswer = z.infer<typeof CausalReasoningAnswerSchema>;
export type PerspectiveTakingAnswer = z.infer<typeof PerspectiveTakingAnswerSchema>;

/** User's attempt at an activity. */
export const ActivityAttemptSchema = z.object({
  userId: z.string(),
  activityId: z.string(),
  journeyId: z.string(),
  chapterId: z.string(),
  answer: ActivityAnswerSchema,
  score: z.number().min(0).max(1), // 0.00 - 1.00
  isCorrect: z.boolean(),
  timeSpentSeconds: z.number().int().positive(),
  attempts: z.number().int().positive(), // Which attempt number (1, 2, 3...)
  completedAt: z.string().datetime(),
});

export type ActivityAttempt = z.infer<typeof ActivityAttemptSchema>;

/** FSRS (Free Spaced Repetition Scheduler) state for an activity. */
export const FSRSStateSchema = z.object({
  stability: z.number().positive(), // Days until 90% recall probability
  difficulty: z.number().min(1).max(10), // Item difficulty
  dueDate: z.string().datetime(), // When next review is due
  lastReview: z.string().datetime().optional(),
  reps: z.number().int().nonnegative(), // Successful reviews
  lapses: z.number().int().nonnegative(), // Times forgotten
});

export type FSRSState = z.infer<typeof FSRSStateSchema>;

/** User progress on a learning activity (persisted). */
export const UserActivityProgressSchema = z.object({
  userId: z.string(),
  activityId: z.string(),
  journeyId: z.string(),
  chapterId: z.string(),
  bestScore: z.number().min(0).max(1).default(0),
  totalAttempts: z.number().int().nonnegative().default(0),
  lastAttemptAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(), // First time reaching 1.0
  fsrs: FSRSStateSchema.optional(),
  /** For spaced repetition queue. */
  nextReviewAt: z.string().datetime().optional(),
});

export type UserActivityProgress = z.infer<typeof UserActivityProgressSchema>;

/** Skill tree node for mastery visualization. */
export const SkillNodeSchema = z.object({
  id: z.string(),
  label: LocalizedText,
  description: LocalizedText,
  region: z.string(), // e.g., "austria"
  theme: z.string(), // e.g., "political-geography"
  /** Activity IDs that contribute to this skill. */
  activityIds: z.array(z.string()),
  /** Prerequisite skill IDs. */
  prerequisites: z.array(z.string()).default([]),
  xpToMaster: z.number().int().positive().default(100),
  icon: z.string().optional(), // Lucide icon name
});

export const SkillTreeSchema = z.object({
  region: z.string(),
  nodes: z.array(SkillNodeSchema),
});

export type SkillNode = z.infer<typeof SkillNodeSchema>;
export type SkillTree = z.infer<typeof SkillTreeSchema>;

/** Certificate types. */
export const CertificateTypeSchema = z.enum([
  "journey_completion",    // Finished all chapters + activities in a journey
  "regional_mastery",      // Mastered all skills in a region
  "method_competency",     // Mastered a historical method skill
  "educator_issued",       // Teacher-issued to student
]);

export const CertificateSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: CertificateTypeSchema,
  journeyId: z.string().optional(),
  skillId: z.string().optional(),
  region: z.string().optional(),
  title: LocalizedText,
  description: LocalizedText,
  issuedAt: z.string().datetime(),
  verificationToken: z.string(), // For public verification URL
  pdfUrl: z.string().url().optional(),
  /** For educator-issued: teacher ID and class context. */
  issuedBy: z.string().optional(),
  classId: z.string().optional(),
});

export type CertificateType = z.infer<typeof CertificateTypeSchema>;
export type Certificate = z.infer<typeof CertificateSchema>;

/** Premium journey / product entitlements. */
export const ProductEntitlementSchema = z.object({
  userId: z.string(),
  productId: z.string(), // e.g., "journey-vienna-deep-dive", "educator-classroom"
  source: z.enum(["subscription", "purchase", "institutional", "promo"]),
  expiresAt: z.string().datetime().nullable(), // Null = perpetual
  grantedAt: z.string().datetime(),
});

export type ProductEntitlement = z.infer<typeof ProductEntitlementSchema>;

/** Educator class management. */
export const EducatorClassSchema = z.object({
  id: z.string(),
  teacherId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  journeyIds: z.array(z.string()),
  inviteCode: z.string(),
  maxStudents: z.number().int().positive().default(30),
  createdAt: z.string().datetime(),
  archivedAt: z.string().datetime().optional(),
});

export const ClassEnrollmentSchema = z.object({
  classId: z.string(),
  studentId: z.string(),
  joinedAt: z.string().datetime(),
  progress: z.record(z.string(), z.number().min(0).max(1)).default({}), // journeyId -> completion
});

export type EducatorClass = z.infer<typeof EducatorClassSchema>;
export type ClassEnrollment = z.infer<typeof ClassEnrollmentSchema>;