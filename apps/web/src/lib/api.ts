// Local default: the API from `npm run api`. A public static build sets NEXT_PUBLIC_API_URL to "" (no API),
// and the features that need it say so instead of calling the visitor's own computer.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const HAS_API = API_URL !== "";

export const RELATION_LABELS = {
  primary_evidence: { label: "Primary evidence", help: "A record from the time that bears directly on this claim." },
  illustrates: { label: "Illustrates", help: "Shows the subject, without proving the claim." },
  context: { label: "Context", help: "Background that helps explain the claim." },
} as const;

export type Relation = keyof typeof RELATION_LABELS;
