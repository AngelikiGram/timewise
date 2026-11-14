# TIMEWISE Education & Journey Redesign Plan

## User Requirements Summary

1. **Learning Mode**: Dislike layout + dislike it embedded in Journey Mode → Move to dedicated area
2. **Journey Mode**: Should work for ANY series of events on the historical map
3. **Automation**: Auto-generate journeys from event sequences  
4. **Graph/Mindmap Mode**: Visual network of connected events with time/country filters, intuitive UI

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     TIMEWISE Application                        │
├─────────────────────────────────────────────────────────────────┤
│  /explore          → Atlas/Map view (existing)                  │
│  /journey/:id      → Curated journeys (existing)                │
│  /journey/auto     → AUTO-GENERATED journey from selection      │
│  /learn            → DEDICATED Learning Hub (NEW)               │
│  /learn/graph      → Graph/Mindmap Mode (NEW)                   │
│  /learn/activities → Activity library by skill/type (NEW)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Extract Learning Mode from Journey (Week 1)

### 1.1 New Route: `/learn` - Learning Hub
- **Landing page**: Skill tree visualization, progress overview, recommended activities
- **Activity library**: Filter by type, difficulty, region, time period, skill tag
- **Progress dashboard**: FSRS review queue, certificates, XP, streak
- **Entry points**: "Practice this skill", "Review due activities", "Continue journey"

### 1.2 New Route: `/learn/activities/[activityId]` - Standalone Activity Player
- Full-screen activity component (no journey chrome)
- Progress persistence via localStorage + future API
- Breadcrumb: Learning Hub → Skill → Activity

### 1.3 Decouple LearningModeToggle from JourneyPlayer
- Remove `<LearningModeToggle />` from JourneyPlayer.tsx
- Journey becomes pure narrative/map experience
- Add "Practice this chapter's skills" link → `/learn?journey=...&chapter=...`

### 1.4 Journey → Learning Bridge
- "Learning companions" sidebar in journey (optional, collapsible)
- Shows 1-2 relevant activities for current chapter
- Click opens `/learn/activities/...` in new tab or modal

---

## Phase 2: Generalize Journey Mode (Week 2)

### 2.1 Data Model: AutoJourney (extends Journey)
```typescript
interface AutoJourney {
  id: `auto-${string}`; // e.g., "auto-austria-railways-1844-1867"
  title: LocalizedText;
  subtitle: LocalizedText;
  source: "curated" | "auto-generated";
  eventIds: string[]; // Selected events in sequence
  generatedAt: string;
  filters: {
    region?: string;
    timeRange?: [string, string];
    themes?: string[];
    placeId?: string;
    eventIds?: string[];
  };
}
```

### 2.2 Auto-Journey Generator (`lib/auto-journey.ts`)
```typescript
function generateJourneyFromEvents(
  eventIds: string[],
  options: { title?: string; groupBy?: "theme" | "place" | "time" }
): AutoJourney

function generateJourneyFromFilters(
  filters: { region?; timeRange?; themes?; placeId? }
): AutoJourney
```

### 2.3 New Route: `/journey/auto` (or `/journey/generate`)
- **Step 1**: Filter events (map selection, time slider, theme checkboxes, place picker)
- **Step 2**: Preview event sequence (reorderable, editable)
- **Step 3**: Auto-generate chapter structure (group by theme/time/place)
- **Step 4**: Save as "My Journey" (localStorage) or play immediately

### 2.4 Journey Player Enhancements
- Accept `eventIds[]` prop directly (bypass curated journey lookup)
- Chapter auto-generation: group events by theme, place, or time chunks
- "Save as custom journey" button

---

## Phase 3: Graph/Mindmap Mode (Week 3)

### 3.1 Data Model: Event Graph
```typescript
interface EventNode {
  id: string; // eventId
  label: string; // event.title.en
  date: string; // event.when.start
  themes: string[];
  placeId?: string;
  connections: EventEdge[];
}

interface EventEdge {
  target: string; // eventId
  type: "causal" | "temporal" | "thematic" | "geographic" | "person";
  confidence: "explicit" | "plausible" | "speculative";
  sourceClaimIds?: string[]; // Evidence for this connection
}
```

### 3.2 Graph Builder (`lib/event-graph.ts`)
- **Temporal edges**: Events within N days/months/years
- **Thematic edges**: Shared themes
- **Geographic edges**: Same place or connected places (routes)
- **Person edges**: Shared people
- **Causal edges**: From learning activities (causal_reasoning) + explicit claims

### 3.3 New Component: `EventGraph.tsx`
- **Canvas**: React Flow or custom D3/Canvas implementation
- **Nodes**: Event cards (title, date, theme badges, place)
- **Edges**: Styled by type (causal=solid, temporal=dashed, thematic=dotted)
- **Layouts**: Force-directed, hierarchical (time), geographic (map-based)

### 3.4 New Route: `/learn/graph`
- **Filters panel**: Time range, country/region, themes, connection types
- **Graph canvas**: Interactive, zoomable, searchable
- **Sidebar**: Selected event details + connected events list
- **Actions**: "Create journey from selection", "Open in explore", "Start learning activity"

### 3.5 Intuitive UI Features
- **Time scrubber**: Slider at bottom filters nodes by date
- **Map mini-view**: Geographic layout option
- **Search**: Type event name, person, place → highlights nodes
- **Presets**: "Austrian Railways 1844-1867", "WWI Causes", "Vienna Urban Change"

---

## Phase 4: Integration & Polish (Week 4)

### 4.1 Navigation Updates
- Top-level nav: Explore | Journeys | Learn | Graph
- Contextual links between all modes

### 4.2 Shared State (Zustand)
- Selected events/time range/theme persist across modes
- "Continue in Journey Mode" / "View in Graph" / "Practice Skills"

### 4.3 Responsive Design
- Mobile: Stack panels, swipeable filters
- Tablet: Split view
- Desktop: Multi-panel

---

## Implementation Priority

| Priority | Task | Effort |
|----------|------|--------|
| P0 | Extract LearningModeToggle → `/learn` hub + standalone activity pages | High |
| P0 | Auto-journey generator from event selection | High |
| P1 | Graph/Mindmap mode with filters | High |
| P1 | Journey Player accepts arbitrary event sequences | Medium |
| P2 | Cross-mode state persistence | Medium |
| P2 | Skill tree visualization in Learning Hub | Medium |
| P3 | Certificate/PDF generation | Low |
| P3 | Educator dashboard | Low |

---

## File Structure Changes

```
apps/web/src/
├── app/
│   ├── learn/
│   │   ├── page.tsx                    # Learning Hub
│   │   ├── layout.tsx
│   │   ├── activities/
│   │   │   └── [activityId]/
│   │   │       └── page.tsx            # Standalone Activity Player
│   │   └── graph/
│   │       └── page.tsx                # Graph/Mindmap Mode
│   └── journey/
│       └── auto/
│           └── page.tsx                # Auto-Journey Builder
├── components/
│   ├── learn/
│   │   ├── LearningHub.tsx             # Main hub component
│   │   ├── ActivityPlayer.tsx          # Full-screen activity
│   │   ├── SkillTree.tsx               # Visualization
│   │   ├── ProgressDashboard.tsx       # FSRS, XP, certificates
│   │   ├── ActivityLibrary.tsx         # Filterable list
│   │   ├── EventGraph.tsx              # Graph canvas
│   │   ├── GraphFilters.tsx            # Time/country/theme filters
│   │   └── GraphSidebar.tsx            # Node details
│   ├── journey/
│   │   ├── AutoJourneyBuilder.tsx      # Step-by-step generator
│   │   ├── EventSelector.tsx           # Map/time/theme selection
│   │   └── ChapterAutoGenerator.tsx    # Groups events into chapters
│   └── shared/
│       ├── EventCard.tsx               # Reusable event display
│       └── TimeRangeSlider.tsx         # Reusable time filter
├── lib/
│   ├── auto-journey.ts                 # Journey generation logic
│   ├── event-graph.ts                  # Graph building logic
│   ├── learning-progress.ts            # Progress utilities (extracted)
│   └── activity-filters.ts             # Filter helpers
└── hooks/
    ├── useLearningProgress.ts          # Progress state
    ├── useEventGraph.ts                # Graph state
    └── useAutoJourney.ts               # Auto-journey state
```

---

## Technical Decisions

1. **Graph Rendering**: Start with React Flow (npm: `reactflow`) for rapid prototyping, evaluate Canvas/D3 for performance if >500 nodes
2. **State**: Zustand stores for cross-mode persistence
3. **Auto-chaptering**: Simple algorithm - group by theme, then by time gaps > 2 years
4. **LocalStorage keys**: Namespaced `timewise:learn:*`, `timewise:journey:*`
5. **No backend changes yet**: All client-side; API/db integration in later phase