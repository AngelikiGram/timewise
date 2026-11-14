import austriaJourneys from "@data/generated/austria/db-journeys.json";
import { Collection, geometryErrors, integrityErrors, Journey, journeyErrors, TemporalGeometry, type GeometryDerivation, type HistoricalEvent, type SupportStatus } from "@timewise/historical-schemas";
// Exported from PostGIS by `npm run sync:db`, so the site shows persisted records and keeps working if the database is down.
import austria from "@data/generated/austria/db-collection.json";
import austriaGeometries from "@data/generated/austria/db-geometries.json";
import publishedRaw from "@data/generated/austria/published.json";

type PublishedFeature = { id: string; names: string[]; sources: { source_id: string }[]; valid_from: string; uncertainty: string; classification: string; geometry: unknown };
const published = publishedRaw as unknown as { gate_passed: boolean; features: PublishedFeature[] };

// Region packages register here; nothing downstream names a specific country.
const parsed = Collection.parse(austria);
const investigationEnd = parsed.investigations[0].range.end;
// Machine-extracted routes reach the map only after passing the pipeline's checks and evaluation gate.
const machineRoutes = published.features.map((f) => ({
  id: f.id,
  name: `${f.names.join(" – ")} (machine-extracted)`,
  layer: "routes",
  sourceName: `Extracted automatically from: ${f.sources.map((s) => s.source_id).join(", ")}`,
  crs: "EPSG:4326",
  validFrom: f.valid_from,
  validTo: investigationEnd,
  accuracy: f.uncertainty,
  derivation: "schematic",
  license: "Endpoints: Wikidata (CC0)",
  review: "unreviewed",
  retrievedAt: "2026-11-02",
  note: `Not reviewed by a person. Classified as ${f.classification}. The opening year comes from one sentence, and the start of that year is used as a placeholder.`,
  eventIds: [],
  geometry: f.geometry,
}));
export const geometries = TemporalGeometry.array().parse([...austriaGeometries.features, ...machineRoutes]);
export const journeys = Journey.array().parse(austriaJourneys.journeys);
export const journeyById = new Map(journeys.map((j) => [j.id, j]));
const errors = [...integrityErrors(parsed), ...geometryErrors(geometries, parsed), ...journeyErrors(journeys, parsed)];
if (errors.length) throw new Error(`Invalid collection: ${errors.join("; ")}`);

export const collection = parsed;

export const geometriesFor = (eventId: string) => geometries.filter((g) => g.eventIds.includes(eventId));
export const activeAt = (date: string) => geometries.filter((g) => g.validFrom <= date && date <= g.validTo);

export const DERIVATION_LABELS: Record<GeometryDerivation, { label: string; help: string }> = {
  digitized_original: { label: "Digitized original", help: "Traced from a historical source." },
  expert_reconstructed: { label: "Expert reconstruction", help: "Reconstructed by a named specialist." },
  community_digitized: { label: "Community-digitized", help: "A coarse outline from a volunteer-built dataset, not an authenticated historical border." },
  approximate: { label: "Approximate location", help: "The position is only roughly known." },
  schematic: { label: "Schematic connection", help: "A straight line between two named places. It doesn't show the real route." },
  inferred: { label: "Algorithmically inferred", help: "Computed, not recorded." },
  modern_reference: { label: "Modern reference", help: "A present-day shape, shown for orientation only." },
};

export type TemporalForm = "exact" | "approximate" | "range" | "process";

/** The kind of time a record occupies, which decides how the timeline draws it. */
export function temporalForm(e: HistoricalEvent): TemporalForm {
  if (e.kind === "process") return "process";
  if (e.when.end) return "range";
  return e.when.precision === "day" ? "exact" : "approximate";
}

/** Where a record ends. A year-precision end means the end of that year. */
export const endOf = (e: HistoricalEvent) => {
  if (e.when.end) return e.when.end;
  return e.when.precision === "year" ? `${e.when.start.slice(0, 4)}-12-31` : e.when.start;
};

export const placeLabel = (e: HistoricalEvent) => (e.placeId ? placeById.get(e.placeId)!.label.en : "No single location");

export const eventsByDate = [...collection.events].sort((a, b) => a.when.start.localeCompare(b.when.start));
export const placeById = new Map(collection.places.map((p) => [p.id, p]));
export const sourceById = new Map(collection.sources.map((s) => [s.id, s]));
export const eventById = new Map(collection.events.map((e) => [e.id, e]));

export const claimById = new Map(collection.claims.map((c) => [c.id, c]));
export const claimsFor =(eventId: string) => collection.claims.filter((c) => c.eventId === eventId);
export const placeEvents = (placeId: string) => collection.events.filter((e) => e.placeId === placeId);

export const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const dayLabel = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

/** Never shows more precision than the record holds. */
export function formatWhen(when: HistoricalEvent["when"]): string {
  const [y, m] = when.start.split("-").map(Number);
  if (when.precision === "year") return when.end && when.end.slice(0, 4) !== String(y) ? `${y}–${when.end.slice(0, 4)}` : String(y);
  if (when.precision === "month") return `${MONTHS[m - 1]} ${y}`;
  if (!when.end) return dayLabel(when.start);
  const [, em, ed] = when.end.split("-").map(Number);
  const [, , d] = when.start.split("-").map(Number);
  return em === m ? `${d}–${ed} ${MONTHS[m - 1]} ${y}` : `${dayLabel(when.start)} – ${dayLabel(when.end)}`;
}

export const SUPPORT_LABELS: Record<SupportStatus, { label: string; help: string }> = {
  documented: { label: "Documented", help: "A primary historical record is linked directly." },
  corroborated: { label: "Corroborated", help: "More than one source agrees." },
  reference: { label: "Reference work", help: "Stated by a reference work. The primary record is not linked yet." },
  interpretation: { label: "Interpretation", help: "A judgement about the past, not a recorded fact." },
  disputed: { label: "Disputed", help: "Accounts or assessments of this conflict." },
  inferred: { label: "Inferred", help: "Plausible, but not directly verified." },
  missing: { label: "Missing", help: "No adequate evidence has been found." },
};

export const investigationRange = {
  start: collection.investigations[0].range.start,
  end: collection.investigations[0].range.end,
};

export const COVERAGE_LABELS = {
  curated_reviewed: "Curated and reviewed",
  source_backed: "Source-backed, not fully reviewed",
  limited: "Limited verified coverage",
  insufficient: "Insufficient evidence",
} as const;
