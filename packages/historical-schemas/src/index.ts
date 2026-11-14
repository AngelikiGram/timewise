import { z } from "zod";

/** English is required today; other locales slot in without a schema change. */
export const LocalizedText = z.object({ en: z.string().min(1), de: z.string().optional() });

export const SupportStatus = z.enum([
  "documented", // a primary record is linked directly
  "corroborated", // independent sources agree
  "reference", // stated by a reference work; primary record not yet linked
  "interpretation",
  "disputed",
  "inferred",
  "missing",
]);

export const ReviewStatus = z.enum(["unreviewed", "source_checked", "expert_reviewed"]);

export const CoverageStatus = z.enum(["curated_reviewed", "source_backed", "limited", "insufficient"]);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const TemporalScope = z.object({
  start: isoDate,
  end: isoDate.optional(),
  /** The dates beyond this precision are placeholders and must not be displayed. */
  precision: z.enum(["day", "month", "year"]),
  note: z.string().optional(),
});

export const Source = z.object({
  id: z.string(),
  provider: z.string(),
  sourceId: z.string(),
  url: z.url(),
  title: z.string(),
  creator: z.string(),
  language: z.string(),
  recordType: z.enum(["primary", "reference_work", "scholarship", "institutional"]),
  rights: z.string(),
  /** Unknown rights never default to permitted reproduction. */
  reproduction: z.enum(["permitted_with_attribution", "link_and_paraphrase_only"]),
  attribution: z.string(),
  retrievedAt: isoDate,
});

export const Place = z.object({
  id: z.string(),
  wikidata: z.string().regex(/^Q\d+$/),
  names: z.array(z.object({ name: z.string(), lang: z.string(), note: z.string().optional() })).min(1),
  label: LocalizedText,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  modernCountry: z.string().length(2),
  region: z.string(),
});

export const Media = z.object({
  url: z.url(),
  page: z.url(),
  title: z.string(),
  creator: z.string(),
  created: z.string(),
  license: z.string(),
  caveat: z.string().optional(),
});

/** How a shape came to exist. Anything but an original must never read as one. */
export const GeometryDerivation = z.enum([
  "digitized_original",
  "expert_reconstructed",
  "community_digitized",
  "approximate",
  "schematic",
  "inferred",
  "modern_reference",
]);

const Position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

export const GeoShape = z.discriminatedUnion("type", [
  z.object({ type: z.literal("LineString"), coordinates: z.array(Position).min(2) }),
  z.object({ type: z.literal("MultiLineString"), coordinates: z.array(z.array(Position).min(2)).min(1) }),
  z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(Position).min(4)).min(1) }),
  z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(z.array(z.array(Position).min(4)).min(1)).min(1) }),
]);

export const TemporalGeometry = z.object({
  id: z.string(),
  name: z.string(),
  layer: z.enum(["boundaries", "routes", "urban"]),
  sourceName: z.string(),
  sourceUrl: z.url().optional(),
  sourceId: z.string().optional(),
  locator: z.string().optional(),
  crs: z.literal("EPSG:4326"),
  validFrom: isoDate,
  validTo: isoDate,
  snapshotYear: z.number().optional(),
  accuracy: z.string(),
  derivation: GeometryDerivation,
  license: z.string(),
  review: ReviewStatus,
  retrievedAt: isoDate,
  note: z.string(),
  eventIds: z.array(z.string()),
  geometry: GeoShape,
});

export const HistoricalEvent = z.object({
  id: z.string(),
  /** A process spans time as a development; an event is a dated occurrence. */
  kind: z.enum(["event", "process"]).default("event"),
  title: LocalizedText,
  summary: LocalizedText,
  when: TemporalScope,
  /** Optional: an event without a real location stays off the map rather than getting an invented marker. */
  placeId: z.string().optional(),
  noPlaceReason: z.string().optional(),
  placeNote: z.string().optional(),
  themes: z.array(z.string()).min(1),
  chapterId: z.string(),
  people: z.array(z.string()).default([]),
  media: Media.optional(),
});

export const Claim = z.object({
  id: z.string(),
  eventId: z.string(),
  statement: LocalizedText,
  support: SupportStatus,
  review: ReviewStatus,
  extraction: z.string(),
  evidence: z
    .array(
      z.object({
        sourceId: z.string(),
        /** Short phrase present verbatim on the source page; checked by scripts/verify-sources.mjs. */
        locator: z.string().min(3),
        passage: z.string(),
      }),
    )
    .min(1),
});

export const Period = z.object({
  id: z.string(),
  label: LocalizedText,
  start: isoDate,
  end: isoDate,
  note: z.string().optional(),
});

export const Chapter = z.object({ id: z.string(), title: LocalizedText, intro: LocalizedText });

export const Investigation = z.object({
  id: z.string(),
  question: LocalizedText,
  intro: LocalizedText,
  range: z.object({ start: isoDate, end: isoDate }),
  chapters: z.array(Chapter).min(1),
});

export const Collection = z.object({
  region: z.object({ id: z.string(), label: LocalizedText, coverage: CoverageStatus, coverageNote: z.string() }),
  themes: z.array(z.object({ id: z.string(), label: LocalizedText })),
  periods: z.array(Period),
  places: z.array(Place),
  sources: z.array(Source),
  events: z.array(HistoricalEvent),
  claims: z.array(Claim),
  investigations: z.array(Investigation),
});

export type TemporalGeometry = z.infer<typeof TemporalGeometry>;
export type GeometryDerivation = z.infer<typeof GeometryDerivation>;
export type Collection = z.infer<typeof Collection>;
export type HistoricalEvent = z.infer<typeof HistoricalEvent>;
export type Claim = z.infer<typeof Claim>;
export type Place = z.infer<typeof Place>;
export type Source = z.infer<typeof Source>;
export type Period = z.infer<typeof Period>;
export type Investigation = z.infer<typeof Investigation>;
export type SupportStatus = z.infer<typeof SupportStatus>;

/** Narrative text can only be written against claims, so a journey can't assert beyond its evidence. */
export const JourneyChapter = z.object({
  id: z.string(),
  question: LocalizedText,
  connection: LocalizedText.optional(),
  segments: z.array(z.object({ text: LocalizedText, claimIds: z.array(z.string()).min(1) })).min(1),
  eventIds: z.array(z.string()).min(1),
  summary: LocalizedText,
});

export const Journey = z.object({
  id: z.string(),
  title: LocalizedText,
  subtitle: LocalizedText,
  chapters: z.array(JourneyChapter).min(1),
  closing: LocalizedText,
});

export type Journey = z.infer<typeof Journey>;
export type JourneyChapter = z.infer<typeof JourneyChapter>;

// Learning activity schemas (Zod)
export {
  ActivityTypeSchema,
  ActivityDifficultySchema,
  ActivityAnswerSchema,
  LearningActivitySchema,
  ActivityAttemptSchema,
  FSRSStateSchema,
  UserActivityProgressSchema,
  SkillNodeSchema,
  SkillTreeSchema,
  CertificateTypeSchema,
  CertificateSchema,
  ProductEntitlementSchema,
  EducatorClassSchema,
  ClassEnrollmentSchema,
  TimelineOrderingAnswerSchema,
  MapPlacementAnswerSchema,
  SourceMatchingAnswerSchema,
  InterpretationRatingAnswerSchema,
  ChangeDetectionAnswerSchema,
  EvidenceGapFindingAnswerSchema,
  CausalReasoningAnswerSchema,
  PerspectiveTakingAnswerSchema,
} from "./learning";

// Learning activity types (TypeScript)
export type {
  ActivityType,
  ActivityDifficulty,
  ActivityAnswer,
  LearningActivity,
  ActivityAttempt,
  FSRSState,
  UserActivityProgress,
  SkillNode,
  SkillTree,
  CertificateType,
  Certificate,
  ProductEntitlement,
  EducatorClass,
  ClassEnrollment,
  TimelineOrderingAnswer,
  MapPlacementAnswer,
  SourceMatchingAnswer,
  InterpretationRatingAnswer,
  ChangeDetectionAnswer,
  EvidenceGapFindingAnswer,
  CausalReasoningAnswer,
  PerspectiveTakingAnswer,
} from "./learning";

export function journeyErrors(journeys: Journey[], c: Collection): string[] {
  const events = new Set(c.events.map((e) => e.id));
  const claimEvent = new Map(c.claims.map((cl) => [cl.id, cl.eventId]));
  const errors: string[] = [];
  for (const j of journeys) {
    for (const ch of j.chapters) {
      for (const id of ch.eventIds) if (!events.has(id)) errors.push(`${ch.id}: unknown event ${id}`);
      for (const seg of ch.segments) {
        for (const id of seg.claimIds) {
          const eventId = claimEvent.get(id);
          if (!eventId) errors.push(`${ch.id}: unknown claim ${id}`);
          else if (!ch.eventIds.includes(eventId)) errors.push(`${ch.id}: claim ${id} belongs to an event outside this chapter`);
        }
      }
    }
  }
  return errors;
}

/** A geometry must link to real events and have a usable validity interval. */
export function geometryErrors(features: TemporalGeometry[], c: Collection): string[] {
  const events = new Set(c.events.map((e) => e.id));
  const errors: string[] = [];
  for (const f of features) {
    if (f.validTo < f.validFrom) errors.push(`${f.id}: validity ends before it starts`);
    for (const id of f.eventIds) if (!events.has(id)) errors.push(`${f.id}: unknown event ${id}`);
    if (f.sourceId && !c.sources.some((s) => s.id === f.sourceId)) errors.push(`${f.id}: unknown source ${f.sourceId}`);
  }
  return errors;
}

/** Referential checks zod can't express: a claim may only cite records that exist. */
export function integrityErrors(c: Collection): string[] {
  const errors: string[] = [];
  const sources = new Set(c.sources.map((s) => s.id));
  const places = new Set(c.places.map((p) => p.id));
  const themes = new Set(c.themes.map((t) => t.id));
  const chapters = new Set(c.investigations.flatMap((i) => i.chapters.map((ch) => ch.id)));
  const events = new Set(c.events.map((e) => e.id));
  for (const e of c.events) {
    if (e.placeId && !places.has(e.placeId)) errors.push(`${e.id}: unknown place ${e.placeId}`);
    if (!e.placeId && !e.noPlaceReason) errors.push(`${e.id}: no place and no reason given`);
    if (!chapters.has(e.chapterId)) errors.push(`${e.id}: unknown chapter ${e.chapterId}`);
    for (const t of e.themes) if (!themes.has(t)) errors.push(`${e.id}: unknown theme ${t}`);
    if (!c.claims.some((cl) => cl.eventId === e.id)) errors.push(`${e.id}: event has no claim`);
    if (e.when.end && e.when.end < e.when.start) errors.push(`${e.id}: end before start`);
  }
  for (const cl of c.claims) {
    if (!events.has(cl.eventId)) errors.push(`${cl.id}: unknown event ${cl.eventId}`);
    for (const ev of cl.evidence) if (!sources.has(ev.sourceId)) errors.push(`${cl.id}: unknown source ${ev.sourceId}`);
  }
  return errors;
}
