# MASTER PROJECT: TIMEWISE
## Build a Commercial, Evidence-Grounded, Interactive History Intelligence Platform

You are acting as a team of:
- Principal full-stack software engineers
- AI/ML and retrieval-augmented-generation specialists
- Historical GIS and geospatial visualization researchers
- Digital humanities and historical knowledge representation experts
- UI/UX and interactive information visualization designers
- Data engineers
- Security and privacy engineers
- Software testing and DevOps engineers
- SaaS product architects

Your task is to **actually design, implement, test, and prepare for online deployment a complete web application called TIMEWISE**.

Do not deliver only plans, mockups, sample code, or fictional demonstrations.

Create the actual project files, working interfaces, backend, database, data pipelines, and validated integrations.

Work in manageable milestones, implementing and testing each stage before proceeding.

---

# 1. PRODUCT VISION

**TIMEWISE — Explore history through evidence.**

TIMEWISE is an interactive, AI-assisted platform that lets users explore, understand, investigate, compare, and learn world history through geographically grounded visualizations and reliable historical evidence.

It should feel like a combination of:

- A premium historical atlas
- An interactive documentary
- A geographic research workspace
- An AI-powered learning assistant
- A personal history knowledge library

However, it must not merely copy the functionality of an AI chatbot, historical timeline website, encyclopedia, or geography quiz.

Its defining capability is transforming historical questions into interactive, source-grounded exploration workspaces.

A user might enter:

"How did Austria change between 1848 and 1918?"

The application should generate a structured exploration containing:

1. A concise historical introduction.
2. An interactive geographic map showing relevant locations and changes.
3. A synchronized timeline of significant events.
4. Original historical photographs, maps, documents, and artifacts.
5. Important people, organizations, and relationships.
6. Explanations supported by inspectable citations.
7. Relevant disagreements between historical sources or interpretations.
8. Comparisons between historical periods.
9. Optional interactive learning activities.
10. A saved, shareable personal investigation workspace.

The system must distinguish historical facts from interpretations and uncertainty.

The objective is to make exploring history **visually engaging, intellectually rigorous, intuitive, and enjoyable**.

---

# 2. UNIQUE PRODUCT IDENTITY

Do not build another general-purpose history chatbot.

The core competitive differentiation should emerge from the integration of five mechanisms.

## A. Synchronized historical understanding

Historical narrative, maps, timelines, people, and documents must all refer to the same underlying historical knowledge representation.

When the user selects an event, the relevant location, time, evidence, and explanation are highlighted together.

## B. Evidence-first AI

Every substantive factual assertion must be grounded in identifiable source material.

Users can open a historical claim and inspect the supporting document, page, passage, institution, and source details.

The system must distinguish between:

- Directly documented statements
- Corroborated historical conclusions
- Scholarly interpretations
- Disputed claims
- Plausible but unverified inferences
- Missing information

Do not represent AI-generated statements as verified historical knowledge without evidence.

## C. Hindsight Mode

Introduce two modes:

**Retrospective mode:** Explain a historical event using knowledge available to modern historians.

**Contemporary information mode:** Show what information was available to selected historical actors or publications at a specified date.

For contemporary information mode, distinguish the date a document was created from when its contents could plausibly have been known to a particular audience.

Do not claim to reconstruct what a historical person knew without evidence.

Use this feature to help users understand historical uncertainty.

## D. Historical comparison engine

Allow users to compare different places, periods, or developments in a synchronized analytical workspace.

Examples:

- Vienna in 1850 vs. Vienna in 1900.
- Austria and Hungary during the Dual Monarchy.
- Athens and Rome during selected periods.
- Different scholarly explanations of the same event.

Only compare dimensions that have adequate evidence.

Do not invent missing statistics or historical boundaries.

## E. Continuous personal learning atlas

Users should gradually build a personal, interconnected atlas of historical knowledge.

Saved discoveries, investigated claims, timelines, comparisons, bookmarks, and learning progress become a reusable personal knowledge collection.

Make the product valuable across repeated sessions, not just individual questions.

---

# 3. GEOGRAPHIC COVERAGE AND COUNTRY EXPANSION

The platform must support worldwide geographic concepts from the beginning.

However, verified historical source coverage should expand in stages.

## First supported region: Austria

Initially prioritize Austrian history, but do not restrict the website to Vienna.

Include datasets and curated learning experiences covering:

- Vienna
- Graz
- Salzburg
- Innsbruck
- Linz
- Other Austrian regions where reliable sources are available
- Nationwide historical events
- Historical connections between Austria and neighboring countries

Suggested thematic collections:

- The Habsburg Monarchy
- The Revolutions of 1848
- Urban development in the 19th century
- Industrialization and transportation
- The Austro-Hungarian Compromise of 1867
- Everyday life during different periods
- The First World War and the monarchy's dissolution
- The First Austrian Republic
- Austria during National Socialism
- Postwar reconstruction
- Modern Austrian and European history

Use appropriate scholarly treatment for sensitive historical periods.

Do not imply that the borders of modern Austria correspond to the territorial extent of historical political entities.

## Planned international expansion

Architect the data ingestion system using reusable country/region packages.

Suggested later regions:

1. Czechia and Hungary
2. Germany and Italy
3. Greece
4. Other European regions
5. Wider global coverage

The source retrieval system must not be hardcoded to Austrian place names or German-language texts.

Use language-independent entity identifiers, localized labels, temporal place relationships, and internationally compatible geographic coordinates.

## Coverage transparency

Every region and subject should have a visible coverage status:

- Curated and reviewed
- Source-backed but not fully reviewed
- Limited verified coverage
- Insufficient evidence

Do not fabricate coverage merely because a country is selectable.

Users may still ask questions about regions outside the curated collection when appropriate sources can be retrieved and verified.

---

# 4. TRUSTED HISTORICAL DATA SOURCES

Historical reliability is a fundamental product requirement.

Implement provider-specific connectors using official APIs, legally accessible datasets, and permitted media resources.

A source institution being trustworthy does not mean every historical claim it publishes is necessarily correct.

Separate primary historical records from scholarly secondary interpretations.

## Tier 1 — Historical archives and cultural heritage institutions

### Austrian National Library

Official resources:

https://www.onb.ac.at/
https://api.onb.ac.at/
https://labs.onb.ac.at/en/datasets/anno/

Use available official IIIF APIs, metadata, digitized newspapers, historical documents, and OCR where permitted.

For the initial corpus, investigate the Austrian National Library's public-domain historical newspaper dataset.

Preserve:
- Publication title
- Issue date
- Page identifier
- Original text
- OCR text
- Source URL
- Rights statement
- Language
- Original spelling

Do not assume that every item accessible through an institutional API can be commercially reproduced.

### Europeana

https://www.europeana.eu/
https://pro.europeana.eu/page/apis

Use official APIs to retrieve historical records, maps, photographs, objects, and collection metadata from European cultural institutions.

Record media rights separately from metadata rights.

### Library of Congress

https://www.loc.gov/
https://www.loc.gov/apis/

Use official collection interfaces for relevant international historical materials.

### Smithsonian Open Access

https://www.si.edu/openaccess

Use permitted open-access objects and historical artifacts.

### The Metropolitan Museum of Art

https://www.metmuseum.org/hubs/open-access

Use collection data and appropriately licensed cultural objects.

### Austrian regional archives

Investigate official digital collections belonging to Austrian federal states, municipal archives, libraries, and museums.

Implement additional connectors only after verifying actual availability, documentation, access policies, and licensing.

Do not invent an API endpoint simply because an institution has a website.

## Tier 2 — Historical geographic reference data

### World Historical Gazetteer

https://whgazetteer.org/

Use its documented entity and reconciliation interfaces for historical place names, temporal information, and candidate geographic matches.

Treat automated name reconciliation as a candidate suggestion, not proof of identity.

### Pleiades

https://pleiades.stoa.org/

Use ancient place records where relevant.

### Wikidata

https://www.wikidata.org/

Use Wikidata to link historical entities, external identifiers, alternative names, and candidate relationships.

Do not treat Wikidata as authoritative evidence for contested historical conclusions.

### Austrian Open Government Data

https://www.data.gv.at/
https://basemap.at/

Use appropriate geographic datasets for present-day reference mapping.

Respect individual dataset licenses and service usage conditions.

### Historical map collections

Support georeferenced historical maps from appropriately licensed sources.

Store:
- Original map date
- Geographic coverage
- Source institution
- Georeferencing method
- Coordinate reference system
- Positional uncertainty
- License
- Attribution

Do not interpolate historical boundaries as if they were known facts.

## Tier 3 — Academic scholarship

Use discovery APIs such as:

https://api.openalex.org/
https://api.crossref.org/

These services are for locating publications and checking bibliographic metadata.

For historical explanations, obtain the actual scholarly argument from legally accessible publications, abstracts where appropriate, or curated reviewed content.

Do not treat a publication title or metadata record as evidence of its conclusions.

## Source integrity requirements

Every external record must include:

- Provider
- Source ID
- Permanent URL where available
- Title
- Creator or responsible institution
- Date and temporal coverage
- Language
- Record type
- Rights statement
- Attribution
- Date imported
- Source version or retrieval timestamp
- Original text or authorized excerpt where permitted
- OCR quality or uncertainty where available

Implement a source permissions registry.

Unknown rights must not automatically become approved for commercial reproduction, training, or redistribution.

Do not bulk scrape websites contrary to their terms.

Support rate limits, authentication, caching, error handling, and provider-specific restrictions.

---

# 5. AI ARCHITECTURE — RAG FIRST, TRAINING LATER

Do not begin by training a history foundation model.

Implement a reliable hybrid retrieval-and-reasoning pipeline using existing LLM APIs.

Use a provider abstraction so models can be changed without rewriting the application.

The system must separate historical knowledge storage from language generation.

## Layer A — Historical corpus ingestion

Create data pipelines for:

- API discovery
- Metadata normalization
- Language identification
- OCR ingestion
- Text cleaning
- Document segmentation
- Date extraction
- Historical named entity extraction
- Geographic place-name resolution
- Duplicate detection
- License verification
- Source indexing

Retain original text alongside normalized text.

Record transformations and their provenance.

## Layer B — Hybrid historical retrieval

Combine:

1. Keyword retrieval
2. Semantic vector search
3. Entity-based retrieval
4. Geographic filtering
5. Temporal filtering
6. Source-authority and relevance ranking
7. Cross-source corroboration

A query about Vienna in 1850 should not automatically retrieve all contemporary information about present-day Vienna.

Interpret the requested time period explicitly.

## Layer C — Historical claim extraction

Use structured model outputs validated against schemas.

Extract:

- Historical subjects and objects
- Actions or events
- Dates and temporal intervals
- Locations
- Spatial relationships
- Named persons and organizations
- Source passages
- Attribution and author perspective
- Historical interpretations
- Explicit uncertainty
- Conflicting claims

Each extracted claim must reference real retrieved evidence.

Do not allow models to invent source IDs, quotations, DOIs, coordinates, or historical references.

## Layer D — Evidence validation

Validate generated assertions against retrieved source passages.

Implement checks for:

- Unsupported assertions
- Incorrect dates
- Geographic inconsistencies
- Entity confusion
- False quotations
- Contradictory references
- Missing source identifiers
- Source-passage mismatch

If evidence is insufficient, return a qualified answer or abstain.

Do not silently change uncertain claims into confident statements.

## Layer E — Structured historical narrative generation

Generate a structured explanation containing:

- Main summary
- Historical background
- Chronological developments
- Relevant people and places
- Key relationships
- Supported geographic events
- Source references
- Alternative interpretations
- Unresolved questions
- Suggested follow-up explorations

Represent this as validated JSON or database records before rendering the UI.

Do not allow unvalidated arbitrary LLM-generated HTML or scripts to control the interface.

## Layer F — Learning generation

Generate educational explanations and questions grounded in approved historical claims.

Each generated question must have:
- A supported answer
- Appropriate source references
- Clear difficulty
- Explanation
- Validation status

Do not introduce fabricated historical trivia.

---

# 6. FUTURE SPECIALIZED MODEL TRAINING

Design the architecture to support eventual fine-tuning, but do not implement costly model training until benchmarks demonstrate a need.

Possible trainable components:

### Historical entity extraction

Train a specialized model for recognizing people, buildings, institutions, historical locations, dates, and events from historical documents.

### Historical toponym resolution

Resolve changing place names and administrative boundaries over time.

### Historical language processing

Improve OCR correction and information extraction for archaic German or multilingual historical texts.

### Temporal-spatial relation extraction

Extract relationships such as:
- Constructed before
- Demolished after
- Located opposite
- Part of a historical administrative region
- Renamed during
- Transferred between political entities

### Evidence classification

Train or calibrate classifiers to distinguish:
- Direct source statements
- Interpretations
- Contradictions
- Unsupported claims

## Training strategy

Before training any component:

1. Build a manually reviewed benchmark.
2. Establish zero-shot and few-shot baselines.
3. Evaluate existing specialized models.
4. Evaluate retrieval improvements.
5. Identify systematic errors.
6. Verify that the training corpus permits the intended use.
7. Fine-tune only when measurable benefits justify maintenance and computing cost.

Avoid training directly on unverified scraped historical text.

Use disjoint evaluation data and prevent document leakage.

Maintain model cards, dataset provenance, and reproducible evaluations.

The first production system should work without locally trained models.

---

# 7. HISTORICAL KNOWLEDGE REPRESENTATION

Do not organize all historical information as disconnected AI-generated essays.

Use a structured and temporal database model.

Recommended entities:

- Source
- SourceDocument
- SourcePassage
- HistoricalClaim
- HistoricalEntity
- Person
- Organization
- Place
- HistoricalEvent
- PoliticalEntity
- HistoricalPeriod
- Interpretation
- GeographicFeature
- TemporalGeometry
- ClaimEvidence
- Contradiction
- Investigation
- LearningSession
- UserCollection

## Claim model

A historical claim must include:

- Stable ID
- Statement
- Subject and relationship
- Object, if applicable
- Temporal scope
- Geographic scope, if supported
- Source passage references
- Support status
- Review status
- Interpretation context
- Extraction method and model version
- Provenance
- Revision history

## Temporal and geographic modeling

Support:

- Exact dates
- Approximate dates
- Date intervals
- Uncertain dates
- Before/after relationships
- Multiple historical names for places
- Locations that have changed over time
- Historical political boundaries
- Geographic geometries with known or uncertain validity periods

Use PostgreSQL and PostGIS.

Do not assume a single modern coordinate or boundary completely represents the historical identity of a location.

## Historical uncertainty

For disputed or incomplete information, represent alternatives rather than forcing a single answer.

A model may infer that a building was demolished during a certain decade without knowing the exact year.

Store and display that uncertainty.

Never render speculative historical geometry as authentic archived geometry without labeling it.

---

# 8. COMPLETE USER INTERFACE

Build a polished commercial web application.

The visual identity should feel like a modern digital museum combined with a premium research product.

Design direction:
- Elegant editorial typography
- Carefully chosen historical imagery
- Warm cream and parchment-inspired light mode
- Sophisticated dark mode
- Muted navy, charcoal, bronze, and subtle accent colors
- Spacious layouts
- Clear navigation
- Beautiful interactive maps
- Smooth animations
- High readability
- Minimal interface clutter

Avoid generic AI SaaS aesthetics.

Use accessible colors and responsive typography.

## A. Landing page

Create a beautiful homepage with:

- TIMEWISE branding
- Large inviting question input
- Interactive historical map or animated archival showcase
- Featured historical investigations
- Popular historical periods
- Countries and regions
- Topic collections
- Short demonstrations of evidence inspection
- Comparison previews
- Personalized learning examples
- Subscription pricing
- FAQs
- Clear calls to action

The homepage should explain the value within seconds.

## B. Explore workspace

This is the main product.

Desktop layout:

LEFT PANEL:
- Historical narrative
- Section navigation
- Related topics
- Important people and events

CENTER PANEL:
- Interactive map
- Temporal controls
- Geographic overlays
- Events and locations
- Map comparison tools

RIGHT PANEL:
- Evidence cards
- Original documents
- Source quotations
- Scholarly interpretations
- Reliability and uncertainty information

BOTTOM:
- Timeline
- Selected date
- Playback controls
- Historical period markers

All panels must be synchronized through shared structured state.

## C. Search

Support:
- Natural-language questions
- Places
- People
- Historical events
- Time periods
- Themes
- Historical names
- Multilingual search

Provide autocomplete and disambiguation where necessary.

Search should show relevant verified records even before the AI explanation finishes.

## D. Compare mode

Allow users to:

- Compare two geographic areas.
- Compare two dates.
- Compare two timelines.
- Compare economic or social indicators where reliable data exists.
- Compare historical interpretations.

Support synchronized map navigation and visually highlight differences.

## E. Historical map explorer

Implement:
- Modern reference basemap
- Available historical maps
- Layer switching
- Temporal filtering
- Opacity comparison
- Swipe comparison
- Historical event markers
- Geographic feature highlighting
- Historical place names
- Source metadata and attribution

Only enable periods for which supported historical data exists.

If data is missing, display missing coverage instead of fabricating maps.

## F. Evidence viewer

Allow users to inspect original source material.

Support:
- Archival photographs
- Scanned documents
- Newspaper pages
- Historical maps
- Source passages
- Scholarly references
- IIIF images where supported

Display exact source identifiers, citations, dates, and rights.

Allow navigation from an AI-generated statement directly to its supporting document passage.

## G. Historical perspective explorer

Allow users to compare appropriately documented contemporary perspectives and later interpretations.

Display who authored each source, when, for whom, and from what available context.

Do not invent quotations or historical testimonies.

## H. Hindsight switch

Let users limit information according to an explicit historical cutoff date.

The UI must explain the difference between contemporary evidence and later scholarly analysis.

## I. My Atlas

Authenticated users can:

- Save investigations.
- Bookmark historical events.
- Save source documents.
- Create collections.
- Add private notes.
- Organize research topics.
- Resume learning sessions.
- Export their own notes and authorized content.

## J. Learning mode

Implement:

- Guided historical explanations
- Short map-based questions
- Timeline ordering activities
- Source interpretation questions
- Flashcards
- Spaced repetition
- Learning progress
- Topic recommendations

Prioritize meaningful learning over meaningless points and streaks.

## K. Collaboration

In a later phase, support:

- Shared investigations
- Commenting and annotations
- Shared evidence collections
- Teacher-created learning workspaces
- Read-only shared links
- Controlled editing permissions

Do not allow unreviewed public edits to modify trusted historical facts directly.

---

# 9. PERSONALIZATION AND INTERNATIONALIZATION

Support English and German in the first release.

Use a structured localization system so additional languages can be introduced later.

Historical documents remain available in their original language.

Provide clearly labeled translations.

Support user preferences for:

- Preferred language
- Preferred historical regions
- Favorite periods
- Learning difficulty
- Topics of interest
- Saved workspaces
- Accessibility settings
- Light/dark appearance

Do not infer sensitive personal attributes unnecessarily.

Make account creation optional for basic free exploration.

---

# 10. COMMERCIAL SUBSCRIPTIONS

Design the application as a real SaaS product, but implement payments in sandbox/test mode until production launch is authorized.

Initial suggested plans:

### Free
€0/month

- Public curated explorations
- Historical maps and timelines
- Three AI-generated investigations monthly
- Three saved workspaces
- Basic learning activities

### TIMEWISE Plus
€7.99/month

- Thirty AI investigations monthly
- Advanced comparisons
- Full evidence inspection
- Personal atlas
- Learning history
- Source-linked explanations
- More saved workspaces

### TIMEWISE Pro
€14.99/month

- One hundred AI investigations monthly
- Advanced research tools
- Document analysis
- Extended personal collections
- Exports
- Collaboration features when available

### Educator / Institution

Future configurable plans for teachers, schools, museums, and universities.

Do not implement unlimited expensive AI inference.

Make quotas and plan features configurable.

Offer annual billing only after validating demand.

## Payments

Investigate Paddle or another suitable Merchant-of-Record provider for the hosted subscription product.

Verify current provider suitability, fees, restrictions, tax handling, and integration documentation.

Implement:

- Checkout in sandbox mode
- Subscription creation
- Subscription status verification
- Webhook signature validation
- Idempotent webhook processing
- Cancellation
- Plan changes
- Customer billing portal
- Grace periods
- Failed-payment handling
- Feature entitlements
- Usage metering
- Refund synchronization

Never rely on frontend state to determine paid access.

Never trust a client-supplied price.

Never store payment card information.

All live payout and bank account details must be configured by the business owner through the approved provider's secure onboarding.

Do not activate live payments without explicit approval.

---

# 11. TECHNICAL STACK

Use modern stable versions of the following technologies, checking compatibility and current documentation.

Frontend:
- Next.js
- TypeScript
- React
- Tailwind CSS
- Accessible component primitives

Maps:
- MapLibre GL JS
- PostGIS
- GeoJSON
- Licensed raster/vector tile services

Timelines and charts:
- D3 or Visx

Knowledge graphs:
- Cytoscape.js or another suitable visualization library

Archival images:
- IIIF-compatible image viewer such as Mirador or OpenSeadragon

Backend:
- Python
- FastAPI
- Pydantic
- SQLAlchemy or an appropriate database toolkit

Database:
- PostgreSQL
- PostGIS
- pgvector

Background jobs:
- Redis and a compatible Python task queue

Authentication:
- Supabase Auth or another suitable secure provider

Storage:
- Object storage for authorized documents, thumbnails, exports, and user data

AI:
- Provider-agnostic LLM integration
- Structured model outputs
- Retrieval pipeline
- Evidence validation
- Model usage and cost logging

Infrastructure:
- Docker for local development
- Containerized Python backend and workers
- Managed PostgreSQL for production
- Suitable frontend hosting
- Separate staging and production environments

Use clean architecture with explicit service boundaries.

Avoid introducing Kubernetes or complex distributed infrastructure until necessary.

---

# 12. PROJECT STRUCTURE

Use a maintainable monorepo.

Suggested layout:

timewise/
  apps/
    web/
    api/
    worker/
  packages/
    shared-types/
    ui/
    historical-schemas/
  data/
    fixtures/
    curated/
    source-configs/
  ingestion/
    connectors/
    normalization/
    extraction/
    validation/
  scripts/
  tests/
  docs/
  infra/

Adapt the structure if a cleaner implementation is justified.

Maintain:

- README.md
- AGENTS.md
- ARCHITECTURE.md
- DATA_SOURCES.md
- LICENSING.md
- DEPLOYMENT.md
- SECURITY.md
- DEVELOPMENT_STATUS.md
- .env.example

Never commit secret environment variables.

---

# 13. DATA INGESTION AND ADMINISTRATION

Build an administrative backend.

Administrators should be able to:

- Register source providers.
- Configure source licenses.
- Trigger ingestion jobs.
- Inspect failed imports.
- Review extracted claims.
- Correct entity matches.
- Resolve geographic ambiguity.
- Approve or reject historical content.
- Review AI explanations.
- Manage curated learning collections.
- Publish featured explorations.
- Inspect source usage.
- Monitor model costs.
- Manage users and subscriptions.
- Review security and application errors.

Build an editorial workflow with clear states:

Imported → Processed → Extracted → Validated → Reviewed → Published

Do not automatically publish all model-extracted historical claims as authoritative material.

Keep source records and edit history immutable where appropriate.

Preserve provenance when human editors revise extracted information.

---

# 14. PERFORMANCE AND COST CONTROL

The website must be fast enough for normal consumer usage.

Do not make an LLM call every time someone clicks a map marker or moves the timeline.

Use precomputed historical entities and event records for interactive navigation.

Cache common historical investigations when licensing and privacy rules permit.

Use:

- Database indexing
- Spatial indexing
- Temporal query optimization
- Incremental retrieval
- Request deduplication
- Background source processing
- Model response caching where safe
- Usage quotas
- API rate limits
- Token budgets
- Cost-aware model routing
- Precomputed summaries for curated topics

Create operational dashboards showing:

- AI cost per investigation
- Retrieval latency
- Generation latency
- Storage usage
- Source provider failures
- Failed evidence checks
- Subscription revenue
- User retention
- Infrastructure costs

The system must fail gracefully when external APIs are unavailable.

---

# 15. SECURITY, LEGAL AND PRIVACY READINESS

Design TIMEWISE for commercial operation from Austria, selling to customers in the EU and potentially internationally.

Implement the technical foundation for:

- GDPR compliance
- Privacy disclosures
- Data minimization
- Data export and deletion
- Secure authentication
- Account deletion
- Subscription management
- Necessary business information
- Appropriate terms of service
- Digital service consumer disclosures
- Refund and withdrawal workflows
- Copyright and media attribution
- Cookie and analytics consent where applicable
- Accessibility
- Moderation of user-generated content

Generated legal pages must be labeled as drafts requiring human verification.

Do not claim that automatically generated legal text guarantees compliance.

For public sharing and collaboration, protect private research notes and personal information.

Implement server-side authorization and database row-level access controls where appropriate.

Validate file uploads and external URLs.

Protect against:
- Prompt injection from retrieved documents
- Cross-site scripting
- SSRF
- SQL injection
- Unauthorized data access
- Credential leakage
- Abuse of expensive AI endpoints
- Excessive automated requests

Treat retrieved historical content as untrusted input, not executable instructions.

---

# 16. TESTING AND HISTORICAL ACCURACY

Create automated engineering tests and historical-quality evaluations.

## Engineering tests

Implement:

- Unit tests
- API integration tests
- Database migration tests
- Authentication tests
- Subscription entitlement tests
- Payment webhook tests
- End-to-end browser tests
- Mobile responsiveness tests
- Accessibility checks
- Performance tests

Use Playwright for the main browser workflows.

## Historical correctness evaluations

Create a reviewed evaluation dataset containing historical questions, verified references, and expected geographic or temporal relationships.

Evaluate:

- Retrieval relevance
- Citation validity
- Claim-level evidence support
- Date extraction
- Geographic grounding
- Historical entity disambiguation
- Recognition of conflicting sources
- Appropriate abstention
- OCR error handling
- Interpretation labeling
- Explanation quality

Compare the RAG pipeline with a basic non-retrieval LLM baseline.

Record measurable differences rather than assuming RAG always improves every output.

Implement explicit checks ensuring that displayed citations actually reference the passages supporting the associated claims.

An answer with invented citations must be treated as a failure.

Where sources are insufficient, the system should communicate that clearly.

---

# 17. ONLINE DEPLOYMENT

The final application must be deployable to a public HTTPS domain.

Prepare separate environments:

1. Local development
2. Staging
3. Production

Create:

- Docker Compose configuration for local services
- Database migrations
- Production build scripts
- Environment validation
- Health checks
- CI test workflows
- Deployment documentation
- Backup/restore procedures
- Error monitoring
- Basic operational dashboards

Use the appropriate deployment providers based on verified cost and service requirements.

Do not assume that deploying the frontend also deploys the Python ingestion workers or database.

Provide a realistic deployment design for each component.

The application should support a custom domain.

Do not register domains, spend money, enable production charges, or expose live services without explicit authorization.

If deployment credentials are unavailable, provide a working local application and a tested, documented staging deployment configuration.

---

# 18. BUILD MILESTONES

Work through these phases sequentially.

## PHASE 1 — Foundation and visual experience

Create:
- Full project structure
- Next.js website
- Attractive landing page
- MapLibre map
- Interactive timeline
- Historical event cards
- Responsive navigation
- Dark and light appearance
- Shared application state

Use a small verified sample dataset that contains multiple Austrian cities or regions.

Do not build a Vienna-only hardcoded interface.

Acceptance criteria:
A user can explore real curated historical events on a synchronized map and timeline.

## PHASE 2 — Database and historical knowledge model

Implement:
- PostgreSQL/PostGIS
- Data schemas
- Source records
- Claim records
- Historical events
- Temporal geographic features
- Search APIs
- Migrations
- Seed data

Acceptance criteria:
All displayed historical entities can be traced back to persisted database records.

## PHASE 3 — Reliable archival ingestion

Implement official connectors for a small number of approved sources, starting with resources such as the Austrian National Library and Europeana.

Add:
- Metadata normalization
- Rights validation
- Document processing
- Source indexing
- Error reporting
- Administrative review

Acceptance criteria:
The application can import and inspect real authorized records without manually fabricating content.

## PHASE 4 — AI historical explanation

Implement:
- Historical question interpretation
- Hybrid retrieval
- Structured extraction
- Evidence linking
- Generated explanation
- Citation validation
- Insufficient-evidence handling

Acceptance criteria:
A user can ask a real historical question and receive an answer backed by inspectable source passages.

## PHASE 5 — Integrated investigation workspace

Connect:
- Generated narrative
- Map
- Timeline
- Source viewer
- Historical events
- Place references
- Relevant media

Acceptance criteria:
Clicking a factual event or historical claim updates the relevant geographic and evidential context.

## PHASE 6 — User accounts and personal atlas

Implement:
- Login
- Saved investigations
- Bookmarks
- User collections
- Notes
- Preferences
- Private workspaces

Acceptance criteria:
A user can save an investigation and resume it later.

## PHASE 7 — Comparison and learning

Implement:
- Period comparison
- Geographic comparison
- Historical interpretation comparison
- Guided learning
- Questions and flashcards
- Learning history

Acceptance criteria:
Users can compare periods and complete a source-grounded learning session.

## PHASE 8 — Paid subscriptions

Implement:
- Feature plans
- Usage limits
- Checkout sandbox
- Billing portal
- Webhook validation
- Subscription persistence
- Administrative product controls

Acceptance criteria:
Test subscriptions correctly control access without making real charges.

## PHASE 9 — Collaboration and institutional features

Add:
- Shared workspaces
- Collaborative annotations
- Educator management
- Lesson publishing
- Curated public collections

Acceptance criteria:
Users can collaborate without corrupting reviewed historical knowledge.

## PHASE 10 — Production readiness

Perform:
- Full regression testing
- Historical accuracy review
- Security review
- Performance profiling
- Licensing audit
- Deployment preparation
- Cost analysis
- Documentation

Acceptance criteria:
The application is suitable for a controlled public beta, with remaining legal and administrative prerequisites clearly documented.

---

# 19. DEVELOPMENT REQUIREMENTS FOR CLAUDE CODE

This is a real coding assignment.

Do not stop after writing an implementation proposal.

At the beginning:

1. Inspect the available repository and operating environment.
2. Check package manager, Node.js, Python, Docker, and database availability.
3. Verify current library documentation.
4. Establish the monorepo structure.
5. Create initial configuration and documentation.
6. Start implementing Phase 1.

If external credentials are missing, use environment variables and a clearly labeled development mode.

Never pretend external integrations are connected when they are not.

Every feature must be marked as one of:
- Implemented and tested
- Implemented but awaiting credentials
- Partially implemented
- Planned
- Blocked

Maintain DEVELOPMENT_STATUS.md after each milestone.

At the end of each development milestone:

- Run tests.
- Run relevant type checks.
- Build the application.
- Start it locally.
- Inspect actual browser behavior.
- Fix errors.
- Record progress.
- Identify the next implementation task.

Use browser screenshots and Playwright where possible to inspect layout quality.

Avoid fake buttons, nonfunctional UI, hardcoded simulated AI answers, and mock payments presented as real transactions.

Keep the code modular.

Use sensible defaults without asking unnecessary questions.

Do not sacrifice scientific reliability, security, or performance simply to deliver more features.

---

# 20. INITIAL DEMONSTRATION CONTENT

Build the initial interactive historical collection around Austria, but cover more than one city and more than one theme.

Suggested first five investigations:

1. How did the Habsburg Monarchy change during the nineteenth century?
2. How did Vienna develop during the Ringstrasse era?
3. How did industrialization and railway expansion change Austrian regions?
4. How did Graz and Salzburg evolve during selected documented historical periods?
5. How did Austria's political geography change between 1914 and 1920?

Use real evidence and original source references.

Do not fill missing historical material with fabricated details.

If a proposed investigation lacks sufficient licensed source coverage, document the gap and select a better-supported topic.

Build at least one exceptional, fully functional exploration rather than five incomplete ones.

---

# 21. FINAL DELIVERABLES

Produce a real, maintainable, commercial-ready codebase including:

1. Functional public website
2. Interactive historical atlas
3. Synchronized map/timeline interface
4. Historical knowledge database
5. Trusted source ingestion framework
6. RAG-based historical explanation system
7. Claim-level citations and evidence viewer
8. Geographic and temporal search
9. Personal history collections
10. Comparison and learning modes
11. Secure authentication
12. Subscription system in sandbox mode
13. Administrator interface
14. Automated tests
15. Source licensing and provenance records
16. Local development setup
17. Staging and production deployment configuration
18. Technical documentation
19. Historical quality evaluation framework
20. Extensible international country/region architecture

Do not claim the system is production-ready without testing, licensing verification, security review, and the required deployment configuration.

---

# 22. START IMPLEMENTING NOW

Start by inspecting the working directory.

Provide a concise architecture and identify the first fully functional vertical slice.

Then immediately create the project.

First vertical slice:

**User opens TIMEWISE → searches a curated Austrian historical topic → sees a beautiful interactive narrative → clicks an event → the map and timeline update → the supporting historical source is displayed.**

Use actual verified source material whenever it can legally and technically be accessed.

Do not begin by implementing subscriptions or advanced AI features before this experience is functional.

Make the first experience visually outstanding, scientifically reliable, and genuinely useful.

Continue toward the complete specification in verified milestones, documenting any unfinished work.

The final objective is to create a distinctive international historical intelligence platform that people would find valuable enough to use regularly and potentially subscribe to.