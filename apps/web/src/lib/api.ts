export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const RELATION_LABELS = {
  primary_evidence: { label: "Primary evidence", help: "A record from the time that bears directly on this claim." },
  illustrates: { label: "Illustrates", help: "Shows the subject, without proving the claim." },
  context: { label: "Context", help: "Background that helps explain the claim." },
} as const;

export type Relation = keyof typeof RELATION_LABELS;
