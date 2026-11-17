// One shared vocabulary of historical entities, used by lessons, the entity panel and the personal atlas.
//
// Identity: a Wikidata QID whenever one is known (records, places, and people resolved by hand in
// data/curated/austria/identities.json); otherwise a TIMEWISE id ("tw:<event>"). The same entity in two
// lessons therefore has one id, and the atlas extends one node instead of adding a duplicate.
//
// Edges are historical claims and always carry a precise label, a source and, when known, a date. Sharing
// a lesson is not a historical relationship: it is kept as lesson membership on the entity, never as an edge.
import identities from "@data/curated/austria/identities.json";
import type { SourceRef } from "./lessons";

export type EntityType = "event" | "person" | "place" | "country" | "organization" | "object";
export const TYPE_LABEL: Record<EntityType, string> = { event: "Event", person: "Person", place: "Place", country: "Country", organization: "Organisation", object: "Object" };

export type Entity = {
  id: string;
  label: string;
  type: EntityType;
  /** As shown: "24 October 1844", "1848–1854". */
  dates?: string;
  /** For sorting and the time filter. */
  year?: number;
  description?: string;
  /** Where the description comes from. */
  source?: SourceRef;
  qid?: string;
  image?: { url: string; page: string; credit: string };
};

export type Edge = { from: string; to: string; label: string; source: SourceRef; date?: string };
export const edgeKey = (e: Pick<Edge, "from" | "label" | "to">) => `${e.from}|${e.label}|${e.to}`;

const PEOPLE = identities.people as Record<string, { wikidata: string; evidence: string }>;
const EVENTS = identities.events as Record<string, { wikidata: string; evidence: string }>;

/** The canonical id of a checked event: its Wikidata twin if one is known. */
export const checkedEventId = (id: string) => EVENTS[id]?.wikidata ?? `tw:${id}`;
/** A person's id, only when their identity has been resolved; otherwise none, and the name stays plain text. */
export const personId = (name: string) => PEOPLE[name]?.wikidata;
export const personEvidence = (name: string) => PEOPLE[name]?.evidence;
export const countryId = (regionId: string) => `country:${regionId}`;
export const isWikidata = (id: string) => /^Q\d+$/.test(id);
export const wikidataUrl = (qid: string) => `https://www.wikidata.org/wiki/${qid}`;
