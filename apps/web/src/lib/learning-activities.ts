import { LearningActivity, ActivityType, ActivityDifficulty } from "@timewise/historical-schemas";

/**
 * Learning activities for the Austria 1848-1921 journey.
 * Each activity is grounded in specific claims from the journey chapters.
 */
export const austriaJourneyActivities: LearningActivity[] = [
  // Chapter 1: Revolution - Timeline Ordering
  {
    id: "act-revolution-timeline",
    journeyId: "austria-1848-1921",
    chapterId: "revolution",
    type: "timeline_ordering",
    prompt: {
      en: "The 1848 Revolution in Vienna unfolded rapidly. Put these events in chronological order.",
      de: "Die Revolution 1848 in Wien verlief rasant. Bringen Sie diese Ereignisse in die richtige chronologische Reihenfolge.",
    },
    claimIds: ["c-mar-1", "c-oct-1"],
    eventIds: ["vienna-march-1848", "vienna-october-1848"],
    correctAnswer: {
      type: "timeline_ordering",
      eventIds: ["vienna-march-1848", "vienna-october-1848"],
    },
    explanation: {
      en: "The March uprising (13-15 March 1848) forced Metternich's resignation and won press freedom. The October uprising (6-31 October 1848) began with a mutiny at Gumpendorf barracks and ended with Windisch-Graetz's army retaking Vienna. The two events were separated by seven months.",
      de: "Der Märzaufstand (13.-15. März 1848) erzwang Metternichs Rücktritt und erkämpfte Pressefreiheit. Der Oktoberaufstand (6.-31. Oktober 1848) begann mit einer Meuterei in der Gumpendorfer Kaserne und endete mit der Rückeroberung Wiens durch Windisch-Graetz. Die beiden Ereignisse lagen sieben Monate auseinander.",
    },
    difficulty: "intro",
    estimatedMinutes: 3,
    xpReward: 15,
    prerequisites: [],
    skillTags: ["chronological-reasoning", "austrian-political-history"],
  },

  // Chapter 1: Revolution - Source Matching
  {
    id: "act-revolution-sources",
    journeyId: "austria-1848-1921",
    chapterId: "revolution",
    type: "source_matching",
    prompt: {
      en: "Each claim about the 1848 Revolution is supported by a specific source passage. Match each claim to its evidence.",
      de: "Jede Behauptung zur Revolution 1848 wird durch eine bestimmte Quellenstelle gestützt. Ordnen Sie jede Behauptung ihrem Beleg zu.",
    },
    claimIds: ["c-mar-1", "c-oct-1"],
    eventIds: ["vienna-march-1848", "vienna-october-1848"],
    correctAnswer: {
      type: "source_matching",
      matches: [
        {
          claimId: "c-mar-1",
          sourceId: "wien-geschichte-wiki-1848-march",
          locator: "Within two days Metternich had resigned, a National Guard had formed, and press freedom had been granted",
        },
        {
          claimId: "c-oct-1",
          sourceId: "wien-geschichte-wiki-1848-october",
          locator: "From 6 October troops mutinied at the Gumpendorf barracks, and an army under Windisch-Graetz was formed to subdue the city",
        },
      ],
    },
    explanation: {
      en: "Claim c-mar-1 draws on the Wien Geschichte Wiki entry for the March 1848 events, which describes the rapid concessions. Claim c-oct-1 draws on the October 1848 entry describing the mutiny and Windisch-Graetz's counter-revolutionary army. Both are reference works - not primary sources - so their support status is 'reference'.",
      de: "Behauptung c-mar-1 stützt sich auf den Wien Geschichte Wiki-Eintrag zu den Märzeignissen 1848, der die raschen Zugeständnisse beschreibt. Behauptung c-oct-1 stützt sich auf den Oktobereintrag, der die Meuterei und Windisch-Graetz' konterrevolutionäre Armee beschreibt. Beide sind Nachschlagewerke - keine Primärquellen - daher ist ihr Unterstützungsstatus 'reference'.",
    },
    difficulty: "core",
    estimatedMinutes: 4,
    xpReward: 20,
    prerequisites: ["act-revolution-timeline"],
    skillTags: ["source-criticism", "evidence-evaluation"],
  },

  // Chapter 1: Revolution - Interpretation Rating
  {
    id: "act-revolution-interpretation",
    journeyId: "austria-1848-1921",
    chapterId: "revolution",
    type: "interpretation_rating",
    prompt: {
      en: "Historians disagree on what the 1848 Revolution achieved. Rate each statement by its evidentiary status.",
      de: "Historiker streiten darüber, was die Revolution 1848 erreichte. Bewerten Sie jede Aussage nach ihrem Evidenzstatus.",
    },
    claimIds: ["c-mar-1", "c-oct-1"],
    eventIds: ["vienna-march-1848", "vienna-october-1848"],
    correctAnswer: {
      type: "interpretation_rating",
      ratings: [
        {
          statementId: "c-mar-1",
          rating: "reference",
        },
        {
          statementId: "c-oct-1",
          rating: "reference",
        },
        {
          statementId: "stmt-revolution-failed",
          rating: "interpretation",
        },
        {
          statementId: "stmt-revolution-lasting-impact",
          rating: "interpretation",
        },
      ],
    },
    explanation: {
      en: "The two journey claims (c-mar-1, c-oct-1) are rated 'reference' because they come from reference works (Wien Geschichte Wiki), not primary documents. Statements about whether the revolution 'failed' or had 'lasting impact' are historical interpretations - scholars disagree on how to weigh the short-term defeat against long-term constitutional changes. These are not directly documented facts.",
      de: "Die beiden Reise-Behauptungen (c-mar-1, c-oct-1) sind 'reference', da sie aus Nachschlagewerken (Wien Geschichte Wiki) stammen, nicht aus Primärdokumenten. Aussagen darüber, ob die Revolution 'gescheitert' sei oder 'nachhaltige Wirkung' hatte, sind historische Interpretationen - Forscher streiten darüber, wie die kurzfristige Niederlage gegen langfristige Verfassungsänderungen zu gewichten ist. Es sind keine direkt dokumentierten Fakten.",
    },
    difficulty: "advanced",
    estimatedMinutes: 5,
    xpReward: 25,
    prerequisites: ["act-revolution-sources"],
    skillTags: ["historical-interpretation", "historiography"],
  },

  // Chapter 2: Rails - Timeline Ordering
  {
    id: "act-rails-timeline",
    journeyId: "austria-1848-1921",
    chapterId: "rails",
    type: "timeline_ordering",
    prompt: {
      en: "Railway construction across the Alps was a multi-decade endeavor. Order these milestones chronologically.",
      de: "Der Eisenbahnbau über die Alpen war ein jahrzehntelanges Unterfangen. Ordnen Sie diese Meilensteine chronologisch.",
    },
    claimIds: ["c-graz-1", "c-semc-1", "c-sem-1", "c-sem-2"],
    eventIds: ["graz-railway-1844", "semmering-construction", "semmering-1854"],
    correctAnswer: {
      type: "timeline_ordering",
      eventIds: ["graz-railway-1844", "semmering-construction", "semmering-1854"],
    },
    explanation: {
      en: "The line to Graz opened in October 1844. Semmering construction began in 1848 and took six years (20,000 workers, 14 tunnels, 16 viaducts under Carl von Ghega). The line opened in 1854 and became a UNESCO World Heritage site in 1998. The construction period overlaps with the 1848 Revolution - work began the same year Vienna fought.",
      de: "Die Strecke nach Graz eröffnete im Oktober 1844. Der Semmeringbau begann 1848 und dauerte sechs Jahre (20.000 Arbeiter, 14 Tunnel, 16 Viadukte unter Carl von Ghega). Die Strecke eröffnete 1854 und wurde 1998 UNESCO-Welterbe. Die Bauzeit überschneidet sich mit der Revolution 1848 - der Bau begann im selben Jahr, in dem Wien kämpfte.",
    },
    difficulty: "intro",
    estimatedMinutes: 3,
    xpReward: 15,
    prerequisites: [],
    skillTags: ["chronological-reasoning", "industrial-history"],
  },

  // Chapter 2: Rails - Map Placement
  {
    id: "act-rails-map",
    journeyId: "austria-1848-1921",
    chapterId: "rails",
    type: "map_placement",
    prompt: {
      en: "The Semmering Railway crosses the Eastern Alps. Place the key locations on the map.",
      de: "Die Semmeringbahn überquert die Ostalpen. Platzieren Sie die wichtigsten Orte auf der Karte.",
    },
    claimIds: ["c-semc-1", "c-sem-1"],
    eventIds: ["semmering-construction", "semmering-1854"],
    correctAnswer: {
      type: "map_placement",
      placements: [
        {
          eventId: "semmering-construction",
          lat: 47.6378,
          lng: 15.8333,
          toleranceKm: 10, // Semmering Pass area
        },
        {
          eventId: "semmering-1854",
          lat: 47.6378,
          lng: 15.8333,
          toleranceKm: 10,
        },
      ],
    },
    explanation: {
      en: "The Semmering Pass (Semmeringpass) at 47.6378°N, 15.8333°E is the key location. The railway runs from Gloggnitz (north) to Mürzzuschlag (south) through the pass. The construction (1848-1854) and opening (1854) both center on this Alpine crossing. The map shows today's track (modern_reference derivation) which follows the historic route closely.",
      de: "Der Semmeringpass (47,6378° N, 15,8333° O) ist der zentrale Ort. Die Bahn führt von Gloggnitz (nördlich) nach Mürzzuschlag (südlich) durch den Pass. Sowohl der Bau (1848-1854) als auch die Eröffnung (1854) drehen sich um diese Alpenüberquerung. Die Karte zeigt die heutige Trasse (modern_reference), die der historischen Route weitgehend folgt.",
    },
    difficulty: "core",
    estimatedMinutes: 4,
    xpReward: 20,
    prerequisites: ["act-rails-timeline"],
    skillTags: ["map-reading", "spatial-reasoning", "industrial-history"],
  },

  // Chapter 3: Walls - Change Detection
  {
    id: "act-walls-change",
    journeyId: "austria-1848-1921",
    chapterId: "walls",
    type: "change_detection",
    prompt: {
      en: "Compare Vienna before and after the Ringstrasse. Identify what changed between 1857 and 1865.",
      de: "Vergleichen Sie Wien vor und nach der Ringstraße. Identifizieren Sie, was sich zwischen 1857 und 1865 veränderte.",
    },
    claimIds: ["c-dec-1", "c-dec-2", "c-ring-1"],
    eventIds: ["ring-decree-1857", "ring-opening-1865"],
    correctAnswer: {
      type: "change_detection",
      changes: [
        {
          geometryId: "vienna-fortifications",
          changeType: "disappeared",
          description: "City walls and glacis demolished per Franz Joseph's 1857 decree",
        },
        {
          geometryId: "ringstrasse",
          changeType: "appeared",
          description: "Ringstrasse boulevard constructed on former fortification grounds",
        },
      ],
    },
    explanation: {
      en: "Franz Joseph's handwritten decree of 20 December 1857 ('Es ist Mein Wille') ordered the demolition of Vienna's walls and glacis. The first section of the Ringstrasse opened 1 May 1865 (a smaller stretch opened in 1858). The fortification geometry is not yet in this collection (marked as a gap), so the 'before' state shows only the modern Ringstrasse as a modern_reference line. The change detection highlights what the sources document: walls removed, boulevard created.",
      de: "Franz Josephs handschriftliches Dekret vom 20. Dezember 1857 ('Es ist Mein Wille') ordnete den Abriss der Wiener Mauern und des Glacis an. Der erste Abschnitt der Ringstraße eröffnete am 1. Mai 1865 (ein kleinerer Teil schon 1858). Die Befestigungsgeometrie fehlt in dieser Sammlung (als Lücke markiert), daher zeigt der 'Vorher'-Zustand nur die moderne Ringstraße als modern_reference-Linie. Die Änderungsanalyse hebt hervor, was die Quellen dokumentieren: Mauern entfernt, Boulevard geschaffen.",
    },
    difficulty: "core",
    estimatedMinutes: 5,
    xpReward: 25,
    prerequisites: [],
    skillTags: ["change-detection", "urban-history", "map-comparison"],
  },

  // Chapter 4: Divided - Causal Reasoning
  {
    id: "act-divided-causal",
    journeyId: "austria-1848-1921",
    chapterId: "divided",
    type: "causal_reasoning",
    prompt: {
      en: "The journey presents Königgrätz, the Compromise, and the Brenner Railway in sequence. Which causal links are supported by the evidence?",
      de: "Die Reise präsentiert Königgrätz, den Ausgleich und die Brennerbahn in Folge. Welche kausalen Verbindungen stützen die Belege?",
    },
    claimIds: ["c-kon-1", "c-comp-1", "c-comp-2", "c-bren-1"],
    eventIds: ["koniggratz-1866", "compromise-1867", "brenner-1867"],
    correctAnswer: {
      type: "causal_reasoning",
      chains: [
        {
          causeEventId: "koniggratz-1866",
          effectEventId: "compromise-1867",
          confidence: "plausible_inference",
          note: "The journey explicitly states: 'This journey doesn't claim that one caused the next, because its sources don't establish that.' The military defeat at Königgrätz (July 1866) and the Compromise (May 1867) are temporally close but causation is an interpretation.",
        },
        {
          causeEventId: "compromise-1867",
          effectEventId: "brenner-1867",
          confidence: "speculative",
          note: "The Brenner Railway opened August 1867. The Compromise was ratified May 1867. No source in this collection links them causally - they are presented as contemporaneous developments.",
        },
      ],
    },
    explanation: {
      en: "This activity teaches a core TIMEWISE principle: temporal sequence != causation. The journey's connection field explicitly warns: 'This journey doesn't claim that one caused the next, because its sources don't establish that.' The only explicit causal claim in the sources is the Compromise's voting restriction (under 8% could vote) - itself an interpretation (c-comp-2). Students should learn to distinguish documented chronology from inferred causation.",
      de: "Diese Aktivität vermittelt ein Kernprinzip von TIMEWISE: zeitliche Folge != Kausalität. Das Verbindungsfeld der Reise warnt explizit: 'Diese Reise behauptet nicht, dass das eine das andere verursacht hat, weil die Quellen das nicht belegen.' Der einzige explizite kausale Anspruch in den Quellen ist die Wahlbeschränkung beim Ausgleich (unter 8% wahlberechtigt) - selbst eine Interpretation (c-comp-2). Lernende sollen dokumentierte Chronologie von vermuteter Kausalität unterscheiden lernen.",
    },
    difficulty: "advanced",
    estimatedMinutes: 6,
    xpReward: 30,
    prerequisites: [],
    skillTags: ["causal-reasoning", "historical-method", "source-criticism"],
  },

  // Chapter 6: End - Perspective Taking (Hindsight Mode)
  {
    id: "act-end-perspective",
    journeyId: "austria-1848-1921",
    chapterId: "end",
    type: "perspective_taking",
    prompt: {
      en: "Compare what contemporaries knew in 1914 vs. what historians know now about the Sarajevo assassination and its consequences.",
      de: "Vergleichen Sie, was Zeitgenossen 1914 über das Attentat von Sarajevo und seine Folgen wussten, mit dem heutigen Historikerwissen.",
    },
    claimIds: ["c-sar-1", "c-sar-2", "c-rep-2", "c-rep-1"],
    eventIds: ["sarajevo-1914", "republic-1918"],
    correctAnswer: {
      type: "perspective_taking",
      comparisons: [
        {
          eventId: "sarajevo-1914",
          contemporaryView: "Assassination of heir apparent; Princip sentenced to 20 years (too young for execution). Immediate crisis but war not yet certain.",
          retrospectiveView: "Trigger for WWI; Princip seen as nationalist/terrorist depending on perspective; war was not inevitable but diplomatic failures made it likely.",
          keyDifference: "Contemporaries couldn't know the assassination would trigger a world war killing 17M+. The July Crisis diplomacy was still unfolding.",
        },
        {
          eventId: "republic-1918",
          contemporaryView: "Emperor Charles recognizes right to self-determination (Nov 11); National Assembly declares German-Austria republic (Nov 12). Borders unknown; 'German-Austria' claimed all German-speaking Habsburg lands.",
          retrospectiveView: "Treaty of Saint-Germain (1919) forbade 'German-Austria' and union with Germany; borders set by treaties and plebiscites (Carinthia 1920, Sopron 1921); rump state of 6.5M vs. claimed 10M+.",
          keyDifference: "Contemporaries believed in a larger German-Austria; the treaty-imposed borders and name change were unknown in Nov 1918.",
        },
      ],
    },
    explanation: {
      en: "This activity uses TIMEWISE's Hindsight Mode concept (Spec Section 2C). Contemporary information mode shows what was knowable at the time; retrospective mode uses modern historical knowledge. The key difference: in November 1918, Austrian leaders proclaimed 'German-Austria' claiming all German-speaking former Habsburg lands. They didn't know the Allies would forbid the name, forbid Anschluss, and impose borders via Saint-Germain (1919) and plebiscites (Carinthia 1920, Sopron 1921). The Sopron vote (Dec 1921) keeping the city in Hungary was itself controversial per the sources.",
      de: "Diese Aktivität nutzt TIMEWISEs Hindsight-Mode (Spec Abschnitt 2C). Der Zeitgenössische-Modus zeigt, was zu der Zeit wissbar war; der retrospektive Modus nutzt heutiges Historikerwissen. Der Kernunterschied: Im November 1918 proklamierten österreichische Führer 'Deutschösterreich' mit Anspruch auf alle deutschsprachigen Habsburgerländer. Sie wussten nicht, dass die Alliierten den Namen verbieten, den Anschluss verbieten und Grenzen durch Saint-Germain (1919) und Volksabstimmungen (Kärnten 1920, Ödenburg 1921) festlegen würden. Die Ödenburger Abstimmung (Dez 1921), die die Stadt bei Ungarn beließ, war laut Quellen selbst umstritten.",
    },
    difficulty: "advanced",
    estimatedMinutes: 7,
    xpReward: 35,
    prerequisites: [],
    skillTags: ["hindsight-mode", "historical-empathy", "contingency"],
  },

  // Chapter 7: Borders - Evidence Gap Finding
  {
    id: "act-borders-gaps",
    journeyId: "austria-1921",
    chapterId: "borders",
    type: "evidence_gap_finding",
    prompt: {
      en: "The border settlements involved treaties and plebiscites. Identify which claims lack primary source evidence.",
      de: "Die Grenzregelungen umfassten Verträge und Volksabstimmungen. Identifizieren Sie, welche Behauptungen Primärquellenbelege fehlen.",
    },
    claimIds: ["c-ga-1", "c-ger-1", "c-car-1", "c-bur-1", "c-ger-3", "c-sop-1"],
    eventIds: ["german-austria-state", "saint-germain-1919", "carinthia-1920", "burgenland-adjustments", "sopron-1921"],
    correctAnswer: {
      type: "evidence_gap_finding",
      gaps: [
        {
          claimId: "c-ga-1",
          missingEvidenceType: "primary_source",
        },
        {
          claimId: "c-ger-1",
          missingEvidenceType: "primary_source",
        },
        {
          claimId: "c-car-1",
          missingEvidenceType: "primary_source",
        },
        {
          claimId: "c-sop-1",
          missingEvidenceType: "primary_source",
        },
      ],
    },
    explanation: {
      en: "All six claims in this chapter (c-ga-1, c-ger-1, c-car-1, c-bur-1, c-ger-3, c-sop-1) currently have 'reference' support status - they come from reference works (Wikipedia, Wien Geschichte Wiki), not from primary documents like the actual treaty texts, plebiscite protocols, or contemporary diplomatic correspondence. The c-sop-1 claim notes the Sopron vote was 'controversial' per the source itself, but doesn't link to the original controversy documentation. This is a documented evidence gap in the collection.",
      de: "Alle sechs Behauptungen in diesem Kapitel (c-ga-1, c-ger-1, c-car-1, c-bur-1, c-ger-3, c-sop-1) haben derzeit den Unterstützungsstatus 'reference' - sie stammen aus Nachschlagewerken (Wikipedia, Wien Geschichte Wiki), nicht aus Primärdokumenten wie den eigentlichen Vertragstexten, Abstimmungsprotokollen oder zeitgenössischem diplomatischen Schriftverkehr. Die Behauptung c-sop-1 vermerkt, die Ödenburger Abstimmung sei laut Quelle 'umstritten', verlinkt aber nicht die originale Kontroversendokumentation. Dies ist eine dokumentierte Evidenzlücke in der Sammlung.",
    },
    difficulty: "core",
    estimatedMinutes: 5,
    xpReward: 25,
    prerequisites: [],
    skillTags: ["evidence-evaluation", "source-gaps", "diplomatic-history"],
  },
];

export const activityById = new Map(austriaJourneyActivities.map(a => [a.id, a]));
export const activitiesByJourney = (journeyId: string) => austriaJourneyActivities.filter(a => a.journeyId === journeyId);
export const activitiesByChapter = (journeyId: string, chapterId: string) => austriaJourneyActivities.filter(a => a.journeyId === journeyId && a.chapterId === chapterId);