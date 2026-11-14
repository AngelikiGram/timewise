# TIMEWISE Interactive Education & Merchandising Plan

## Overview
Transform TIMEWISE from a history exploration tool into an **interactive education platform** with:
1. **Learning Activities** — Source-grounded interactive exercises
2. **Progress & Mastery** — Spaced repetition, skill trees, certificates
3. **Merchandised Content** — Premium journeys, educator packs, institutional licenses
4. **Social Learning** — Study groups, teacher workspaces, shared investigations

---

## 1. INTERACTIVE LEARNING ACTIVITIES

### A. Core Activity Types (Evidence-Grounded)

| Activity | Description | Evidence Link |
|----------|-------------|---------------|
| **Timeline Ordering** | Drag events into chronological order | Each event links to its claim + source |
| **Map Placement** | Drag event markers to correct locations | Shows derivation label (schematic/approximate/digitized) |
| **Source Matching** | Match claim to its supporting passage | Opens source with text fragment highlight |
| **Interpretation Rating** | Classify statements: documented / interpretation / disputed | Shows support status badge |
| **Change Detection** | Compare two map layers, identify what changed | Swipe/split view with derivation labels |
| **Evidence Gap Finding** | Identify which claims lack primary sources | Highlights "reference" and "inferred" status |
| **Causal Reasoning** | Arrange events in causal chains (with uncertainty) | Shows "connection" field from journey segments |
| **Perspective Taking** | Read contemporary vs. retrospective accounts | Hindsight mode: contemporary information mode |

### B. Difficulty Tiers
- **Explorer** (Free): 3 activities per journey, basic feedback
- **Scholar** (Plus): All activities, spaced repetition, progress tracking
- **Researcher** (Pro): Custom activity creation, export, analytics

### C. Activity Data Model
```typescript
interface LearningActivity {
  id: string;
  journeyId: string;
  chapterId: string;
  type: ActivityType;
  prompt: LocalizedText;
  // Grounded in existing claims/events
  claimIds: string[];
  eventIds: string[];
  // Answer validation
  correctAnswer: AnswerKey;
  explanation: LocalizedText; // Why this answer, with source refs
  difficulty: "intro" | "core" | "advanced";
  estimatedMinutes: number;
  xpReward: number;
}
```

---

## 2. PROGRESSION & MASTERY SYSTEM

### A. Skill Trees (Per Region/Theme)
```
Austrian History Mastery
├── Political Geography (borders, treaties, states)
├── Urban Development (Vienna, Graz, Salzburg, Innsbruck)
├── Transportation & Industry (rail, factories, trade)
├── Culture & Society (festivals, daily life, minorities)
└── Historical Methods (source criticism, corroboration)
```

### B. Spaced Repetition (FSRS Algorithm)
- Review intervals based on retrieval success
- Questions drawn from completed activity claimIds
- "Due for review" badge on journey chapters

### C. Certificates & Credentials
- **Journey Completion** → Digital certificate (PDF + verifiable link)
- **Regional Mastery** → "Austrian History Scholar" badge
- **Method Competency** → "Source Critic", "Map Reader", "Timeline Navigator"
- **Educator Verification** → Teacher-issued student certificates

---

## 3. MERCHANDISED EDUCATION PRODUCTS

### A. Premium Journeys (Paid Add-ons)
| Product | Price | Content |
|---------|-------|---------|
| **Vienna Deep Dive** | €4.99 | 12 chapters, 40+ activities, Ringstrasse AR overlay, 15 primary sources |
| **Habsburg Monarchy** | €7.99 | 15 chapters, multi-country comparison, 30 activities, genealogical explorer |
| **WWI Home Front** | €5.99 | 10 chapters, contemporary newspapers, 25 activities, letter-writing simulation |
| **Industrial Revolution** | €4.99 | 8 chapters, railway builder sim, factory map, economic data activities |

### B. Educator Packs (Institutional)
| Tier | Price/yr | Features |
|------|----------|----------|
| **Classroom** | €199 | 30 student seats, lesson builder, progress dashboard, LMS export (SCORM/LTI) |
| **School** | €799 | 200 seats, custom journeys, co-teacher access, parent reports |
| **District/Uni** | Custom | SSO, SIS integration, dedicated support, curriculum alignment |

### C. Physical Merchandise (Print-on-Demand)
- **Journey Companion Books** — Printed investigation workbooks with QR codes to digital activities
- **Historical Map Prints** — Archival-quality reproductions from verified sources
- **Timeline Posters** — Themed (Ringstrasse, Railways, Borders) with derivation legend
- **Source Facsimile Packs** — Printed primary documents with transcription & translation

---

## 4. IMPLEMENTATION ROADMAP

### Phase 1: Core Activity Engine (Week 1-2)
- [ ] Activity type definitions & validation schemas
- [ ] Activity renderer component (reusable)
- [ ] Answer checking + explanation display
- [ ] Integration with existing claim/event data
- [ ] Unit tests for each activity type

### Phase 2: Progression System (Week 2-3)
- [ ] User progress table (activity completions, scores, timestamps)
- [ ] FSRS spaced repetition scheduler
- [ ] Skill tree visualization
- [ ] Certificate generation (PDF + verifiable URL)

### Phase 3: Journey Integration (Week 3-4)
- [ ] "Learning Mode" toggle in JourneyPlayer
- [ ] Activity insertion between narrative segments
- [ ] Progress persistence per journey/chapter
- [ ] Completion gates (optional: require activity to advance)

### Phase 4: Educator Features (Week 4-5)
- [ ] Teacher workspace (create classes, assign journeys)
- [ ] Student progress dashboard
- [ ] Custom activity builder (select claims → generate activity)
- [ ] Export: CSV, SCORM, LTI 1.3

### Phase 5: Monetization (Week 5-6)
- [ ] Premium journey entitlements (subscription + a la carte)
- [ ] Educator pack checkout (Paddle sandbox)
- [ ] License key management for institutions
- [ ] Merchandise integration (Printful/Printify API)

### Phase 6: Social & Polish (Week 6-7)
- [ ] Study groups (shared progress, discussion threads)
- [ ] Public leaderboards (opt-in, pseudonymized)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Mobile optimization for activities
- [ ] German localization for all activities

---

## 5. TECHNICAL ARCHITECTURE

### New Database Tables
```sql
-- Learning activities (content)
CREATE TABLE learning_activities (...);

-- User progress
CREATE TABLE user_activity_progress (
  user_id UUID REFERENCES auth.users,
  activity_id UUID REFERENCES learning_activities,
  journey_id TEXT,
  chapter_id TEXT,
  completed_at TIMESTAMPTZ,
  score NUMERIC(3,2), -- 0.00-1.00
  attempts INT,
  answer JSONB,
  fsrs_state JSONB, -- stability, difficulty, due_date
  PRIMARY KEY (user_id, activity_id)
);

-- Skill tree progress
CREATE TABLE user_skill_progress (
  user_id UUID REFERENCES auth.users,
  skill_id TEXT, -- e.g. "austrian-political-geography"
  mastery_level INT, -- 0-5
  xp INT,
  updated_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, skill_id)
);

-- Educator classes
CREATE TABLE educator_classes (
  id UUID PRIMARY KEY,
  teacher_id UUID REFERENCES auth.users,
  name TEXT,
  journey_ids TEXT[],
  invite_code TEXT UNIQUE,
  created_at TIMESTAMPTZ
);

-- Student enrollments
CREATE TABLE class_enrollments (
  class_id UUID REFERENCES educator_classes,
  student_id UUID REFERENCES auth.users,
  joined_at TIMESTAMPTZ,
  PRIMARY KEY (class_id, student_id)
);

-- Certificates
CREATE TABLE certificates (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  type TEXT, -- 'journey', 'mastery', 'method', 'educator_issued'
  journey_id TEXT,
  skill_id TEXT,
  issued_at TIMESTAMPTZ,
  verification_token TEXT UNIQUE,
  pdf_url TEXT
);

-- Premium entitlements
CREATE TABLE user_entitlements (
  user_id UUID REFERENCES auth.users,
  product_id TEXT, -- 'journey-vienna-deep-dive', 'educator-classroom'
  source TEXT, -- 'subscription', 'purchase', 'institutional'
  expires_at TIMESTAMPTZ NULL,
  PRIMARY KEY (user_id, product_id)
);
```

### API Endpoints
```
POST   /api/learning/activities/:id/attempt     # Submit answer, get feedback
GET    /api/learning/progress                   # User's progress + due reviews
POST   /api/learning/review                     # FSRS review submission
GET    /api/learning/skill-tree/:region         # Skill tree with user progress
POST   /api/educator/classes                    # Create class
GET    /api/educator/classes/:id/dashboard      # Class progress overview
POST   /api/educator/activities/custom          # Build custom activity
GET    /api/certificates/:token/verify          # Public certificate verification
POST   /api/entitlements/claim                  # Claim license key
```

### Frontend Components
```
components/learning/
├── ActivityRenderer.tsx          # Polymorphic activity renderer
├── TimelineOrdering.tsx          # Drag-drop timeline
├── MapPlacement.tsx              # Click-to-place on AtlasMap
├── SourceMatching.tsx            # Passage-claim matching
├── InterpretationRating.tsx      # Support status classification
├── ChangeDetection.tsx           # Swipe/split comparison
├── EvidenceGapFinding.tsx        # Claim status audit
├── CausalReasoning.tsx           # Chain builder with uncertainty
├── PerspectiveTaking.tsx         # Hindsight mode comparator
├── ProgressRing.tsx              # Circular progress indicator
├── SkillTree.tsx                 # Visual skill tree
├── CertificateViewer.tsx         # PDF + verification
├── LearningModeToggle.tsx        # JourneyPlayer integration
└── EducatorDashboard.tsx         # Class management
```

---

## 6. CONTENT PIPELINE

### Activity Authoring Workflow
1. **Curator** selects journey/chapter
2. **Tool** shows available claims/events for that chapter
3. **Curator** picks activity type, writes prompt, selects correct answer
4. **Tool** auto-generates explanation from claim evidence
5. **Reviewer** (historian) validates accuracy & pedagogical value
6. **Publish** → appears in journey learning mode

### Quality Standards
- Every activity answer must be derivable from cited claims
- No "trivia" questions — all answers grounded in evidence
- Difficulty calibrated: intro (recall), core (application), advanced (analysis)
- Accessibility: keyboard operable, screen reader descriptions, color-blind safe

---

## 7. METRICS & SUCCESS CRITERIA

### Engagement
- Activity completion rate > 60% of journey starters
- Median activities per session > 3
- Return rate for spaced repetition > 40% at 7 days

### Learning Efficacy
- Pre/post knowledge check (embedded in first/last activity)
- Self-reported confidence increase > 30%
- Educator-reported student engagement > 4/5

### Revenue
- Premium journey attach rate > 15% of Plus subscribers
- Educator pack conversion > 5% of teacher signups
- Merchandise margin > 40% (print-on-demand)

---

## 8. LEGAL & COMPLIANCE

- **Student Data**: GDPR Art. 8 (parental consent <16), minimal collection
- **Educational Records**: FERPA-ready export/deletion
- **Content License**: All activities CC BY-SA 4.0 (educational use)
- **Accessibility**: WCAG 2.1 AA mandatory for all activities
- **Payments**: Paddle MoR, VAT handled, no card storage

---

## 9. FIRST VERTICAL SLICE (Implement Now)

**Goal**: One complete learning activity type integrated into the existing Austria journey, with progress tracking and a certificate on completion.

**Scope**:
1. `TimelineOrdering` activity for Chapter 1 (Revolution)
2. Progress table + API endpoint
3. JourneyPlayer "Learning Mode" toggle
4. Completion certificate (journey-level)
5. Unit + browser tests

**Files to Create/Modify**:
- `packages/historical-schemas/src/learning.ts` — Zod schemas
- `apps/api/src/routes/learning.ts` — API endpoints
- `apps/web/src/components/learning/TimelineOrdering.tsx`
- `apps/web/src/components/learning/ActivityRenderer.tsx`
- `apps/web/src/components/learning/LearningModeToggle.tsx`
- `apps/web/src/components/JourneyPlayer.tsx` — integrate toggle
- `apps/web/src/lib/learning.ts` — client-side progress helpers
- `tests/unit/learning.test.ts`
- `tests/e2e/learning.spec.ts`

---

## 10. MERCHANDISING INTEGRATION POINTS

### In-App Upsells (Non-Intrusive)
- "Unlock 12 more activities in Vienna Deep Dive" → Premium journey card
- "Create a class for your students" → Educator pack CTA (teachers only)
- "Print this journey as a workbook" → Merchandise link
- "Earn the Source Critic badge" → Skill tree progression

### Email/Lifecycle
- "Your review is due: 3 activities from Vienna 1848" (spaced repetition)
- "New premium journey: Habsburg Monarchy" (product launch)
- "Student progress report for Class 7B" (educator weekly digest)

### Partner Channels
- Museum gift shops → Physical timeline prints + QR to digital
- University bookstores → Educator pack bulk licenses
- History conference booths → Demo stations + trial codes

---

*This plan aligns with TIMEWISE Spec sections 8J (Learning mode), 10 (Commercial subscriptions), and 18 (Build milestones). All activities remain evidence-grounded per Spec sections 2B, 5C, 5D.*