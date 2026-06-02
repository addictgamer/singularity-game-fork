# Singularity Webapp Rewrite Milestones

## Purpose
This file tracks:
- Current progress completed in the web rewrite
- In-flight work that is partially complete
- All remaining work required for full-scope delivery

Scope target remains full gameplay parity in a browser-native webapp with desktop and mobile support, offline support, and no dependency on legacy desktop save import.

## Current Snapshot
Status date: 2026-06-01 (session 3 continued)

Overall completion estimate: 90%

High-level status:
- Foundation and multiple vertical slices implemented
- Engine parity remains partial but now includes power/maintenance lifecycle scaffolding
- UI parity remains partial but now includes dedicated research/location/reports/options panels with CPU assignment guardrails
- Data conversion is partial with comprehensive validation test harness (22 validation tests)
- Validation harness has grown and is actively maintained (40 tests total)
- Release hardening has not started

## Completed Milestones

### M0. Webapp Foundation
Status: done

Completed:
- TypeScript + React + Vite workspace scaffold under webapp
- Initial PWA manifest/plugin setup with Node-version gating for build compatibility
- Core styling and responsive shell baseline
- npm workflows verified in this environment

Key outputs:
- webapp/package.json
- webapp/vite.config.ts
- webapp/tsconfig.json
- webapp/tsconfig.node.json
- webapp/src/main.tsx

### M1. Build-Time Data Conversion (Initial)
Status: done (partial coverage)

Completed:
- Python conversion pipeline from desktop ConfigParser data files to JSON
- Generated game data consumed by frontend engine

Included conversion domains:
- difficulties
- tasks
- techs
- bases
- regions
- locations
- groups
- internal IDs

Key outputs:
- webapp/scripts/convert_game_data.py
- webapp/src/generated/gameData.json

### M2. Engine Vertical Slice
Status: done (partial parity)

Completed:
- Core GameState model
- Time advancement baseline
- CPU assignment baseline
- Job and interest cash flow baseline
- Tech progression baseline for early flow
- Location availability checks
- Base construction checks and placement flow
- Base-derived CPU recalculation
- Base power state toggling (active/sleep)
- Maintenance application and sleep fallback behavior
- Maintenance risk forecasting snapshot API

Key outputs:
- webapp/src/engine/constants.ts
- webapp/src/engine/types.ts
- webapp/src/engine/prerequisite.ts
- webapp/src/engine/tech.ts
- webapp/src/engine/game.ts

### M3. Web Save System Baseline
Status: done (partial parity)

Completed:
- Engine serialize/deserialize for web save format v1
- IndexedDB persistence with slot save/load
- JSON export/import through UI
- Persisted app settings in IndexedDB
- Autosave slot behavior (every 3 in-game days when enabled)

Key outputs:
- webapp/src/engine/save.ts
- webapp/src/store/persistence.ts
- webapp/src/store/gameStore.ts

### M4. UI Shell and Interaction Slice
Status: done (partial parity)

Completed:
- Multi-tab shell for map/research/location/reports/options
- Simulation control panel
- Tech snapshot panel
- Interactive world map with real location markers and click-to-select behavior
- Dedicated Research panel with progress and CPU assignment controls
- Dedicated Location panel with base build and power-state controls
- Dedicated Reports panel with metrics and maintenance warnings
- Dedicated Options panel with persisted settings

Key outputs:
- webapp/src/app/App.tsx
- webapp/src/app/styles.css

### M5. Initial Test Harness
Status: done (partial)

Completed:
- Engine unit tests for implemented behavior
- npm test passing

Covered now:
- new game baseline
- one-day cash flow
- intrusion research flow
- stealth progress flow
- save roundtrip
- prerequisite OR logic
- location lock behavior
- base construction happy path
- base power toggle behavior
- maintenance-triggered sleep fallback
- maintenance snapshot risk signaling

Key outputs:
- webapp/src/engine/game.test.ts

### M6. Toolchain Validation
Status: done

Completed:
- npm install succeeded
- npm test succeeded
- npm build succeeded in current environment (with compatibility adjustments)

## In Progress Milestones

### M7. Data and Engine Parity Expansion
Status: in progress

Partially done:
- location/base flow integrated
- base power states integrated at runtime
- maintenance drain + sleep fallback integrated
- maintenance risk reporting API integrated

Not yet done:
- full base lifecycle parity (detection/discovery outcomes, destruction/escalation paths)
- item system and item slots in bases
- group suspicion evolution and decay loops
- event/effect full trigger pipeline
- full task system behavior parity beyond current job baseline
- region modifier assignment parity behavior and serialization nuances

## Remaining Milestones (Entire Remaining Scope)

### M8. Complete Data Conversion Coverage
Status: not started

Remaining work:
- Convert remaining gameplay data domains not yet integrated into runtime behavior
- Add schema validation for generated JSON
- Add deterministic hash/checksum verification for generated datasets
- Add conversion tests to detect source drift and parser regressions
- Add conversion of translation catalogs and language metadata for runtime i18n
- Add extraction of theme tokens from desktop themes for web theming

Deliverables:
- Extended convert_game_data.py outputs
- Generated translation/theme artifacts under webapp/src/generated
- Conversion test suite

### M9. Complete Engine Parity
Status: in progress

Completed in this phase:
- Runtime effect stack processing for tech and event effects (interest, income, job profit, suspicion/discover modifiers, display mode, endgame state)
- Group runtime state model (suspicion, decay modifiers, discover modifiers, active discovery flag)
- Daily suspicion decay loop and event expiry handling
- Event runtime state machine with trigger/expire semantics
- Base grace-period handling and discovery risk checks
- Base destruction outcomes for maintenance failure and detection outcomes
- Save format v2 additions for effect, group, and event runtime state
- Backward-compatible load path for save version 1

Remaining work:
- Deeper parity fixture validation against desktop reference scenarios
- Region/location modifier edge-case matching and serialization parity checks
- Task and base lifecycle corner-case parity validation beyond currently covered scenarios
- Restore original research/task allocation parity for `cpu_pool` and `jobs` targets where the desktop research screen exposes them directly alongside tech research
- Revisit desktop-style danger-tier CPU budgeting (`available_cpus[0..3]`) instead of the current single-pool simplification
- Complete endgame parity polish for win presentation once audio/story systems are in place (desktop applies effect plus win music/story response)

Deliverables:
- Expanded engine modules in webapp/src/engine
- Updated store integration and deterministic state transitions

### M10. Map Renderer Implementation
Status: done (phase 2 complete)

Completed:
- Replaced DOM marker map with a Canvas-based interactive renderer
- Kept location click-to-select behavior through canvas hit-testing
- Added simulation-time-linked day/night shading (solar terminator progression)
- Added map HUD overlays for day, solar position, node count, and hovered location status
- Verified build/runtime integration and frame-stable rendering in current environment

Deliverables:
- Map rendering module(s)
- UI integration in App and related components

### M11. Screen-by-Screen UI Parity
Status: in progress

**Completed Layout Redesign: Main Menu + Game View Separation**
Implemented full redesign with proper visual hierarchy:
  - Main menu screen: Full-screen entry point (difficulty selection, new game, load game, continue)
  - Game view screen: Map-hero layout with persistent sidebar + modal dialogs
    - Sidebar (left, 280px): Navigation buttons, quick status (day/cash/CPU/suspicion), simulation controls
    - Map hero (center, fills): Full-viewport canvas-based world map
    - Modal dialogs: Research, reports, save/load, activity log, knowledge/story, options (click-to-close)
    - Location/base panel: Optional right sidebar (when location selected)
  - New appScreen state in store tracks "main-menu" vs "game" mode
  - startNewGame/loadFromSlot automatically switch to game view
  - Return-to-menu button in sidebar for session end

Completed in this phase slice (previous work):
- Added dedicated Main Menu panel with difficulty selection and continue/new game actions
- Added dedicated Base Management panel with per-base upkeep and power controls
- Added dedicated Activity Log panel backed by runtime session log entries
- Added dedicated Knowledge/Story panel for researched techs, known locations, active events, and world-state summary
- Expanded tab navigation to include main-menu/base/log/knowledge screens
- Added explicit build-action cost and upkeep metadata in location build controls
- Added save-slot metadata cards for slot-1/autosave in main menu
- Added research filtering and sorting controls
- Added log filtering by entry type
- Added dedicated Save Manager screen with slot-1/slot-2/slot-3/autosave workflows
- Added slot actions for save/load/delete with synchronized metadata refresh
- Consolidated import/export workflows under the Save Manager screen
- Expanded reports with activity breakdowns, per-day timeline rollups, and suspicion/event watch summaries
- Expanded log workflows with kind filter, text search, and minimum-day filtering
- Deepened base management workflows with location/power filters, grace/risk visibility, and quick location focus actions
- Deepened research screen with prerequisite visibility showing tech dependency chains
- Deepened location operations view with per-base grace timers, risk indicators, and maintenance breakdowns
- Deepened main menu with difficulty parameter details and new game confirmation flow
- Deepened knowledge/story screen with tech progress metrics, researched/available/locked categorization, and expanded world state details
- Deepened options panel with organized settings sections (simulation, display) and help text
- Cleaned app shell screen routing so each tab renders only relevant panels (removed always-on setup/simulation/snapshot/map/location cards)
- Deepened save/load UX with current session summary, quick save/load actions, and guarded overwrite/delete/load confirmations
- Deepened log workflows with semantic categories, day-group timeline rendering, archival controls, and filtered export
- Deepened knowledge/story with story phases, milestone tracking, narrative journal, and tech dossiers
- Deepened reports with operational pressure details, resource outlook, CPU allocation breakdown, and event-duration insight
- Updated new-game flow to jump directly to Map tab after start for immediate gameplay feedback
- Added reports historical persistence so deeper insights survive save/load cycles
- Redesigned entire app layout to make map the hero viewport with persistent sidebar and modal dialogs (fixes "looks like web forms" issue)
- Separated main menu into dedicated full-screen view distinct from gameplay
- Implemented app-screen state machine to manage main-menu vs game transitions
- Transformed main menu into cinematic title screen with earth background image and two-column layout (new game / continue)
- Integrated art assets (earth.jpg, earth-night.jpg) from original game to enhance UI visual hierarchy
- Added earth imagery as subtle textured backgrounds to sidebar, location panel, and modal dialogs for visual cohesion
- Enhanced map viewport with earth.jpg background imagery and subtle radial gradient lighting effects for visual depth
- Rendered earth.jpg on canvas map as base layer with overlay gradient (removes bland programmer-art appearance)
- Changed new game default difficulty from "very easy" to "normal"
- Added continent polygon extraction pipeline with seeded splitting for gameplay-aligned regions (North/South America, Europe, Asia, Africa, Australia)
- Unified map interaction geometry so click/hover/render share the same region source
- Removed non-selectable region outlines from map rendering for interaction clarity
- Added loading UX for menu -> game transition with full-screen blocking loader until map assets decode
- Added initial app bootstrap loader (black screen + spinner/text) before React mount to replace blank white startup
- Added Escape-key modal dismissal in both gameplay modals and main-menu confirmation dialog
- Added dedicated "+1h" simulation control in game sidebar
- Added Vite dev/preview server request logging (client connection + resource access visibility)
- Added bottom-docked event console and first-pass collapsible left/right gameplay sidebars
- Added tech narrative fields (description and result) from original game data:
  - Updated TechDef schema to include description and result strings
  - Enhanced data conversion pipeline to read narrative strings from techs_str.dat
  - Updated ResearchPanel to display description and result alongside unlock metadata
  - Verified parity with original game tech display (Intrusion example: "By researching current techniques..." + "I can now take over many computer systems.")
  - All 49 tests passing (data validation, engine parity, UI component tests)
- Added research completion reward popup with richer unlock detail cards:
  - GameView now opens a completion modal when new research log entries arrive
  - Popup shows the completed tech result string plus newly unlocked research, bases, locations, and jobs
  - Unlock detection uses live prerequisite evaluation against before/after researched-tech state
  - Popup cards now include original narrative copy for unlocked bases and job tiers via bases_str.dat and tasks_str.dat
  - Added focused GameView regression coverage for completion popup content and non-tech unlock presentation
- Added original location flavor to unlock cards:
  - Extended converted location data with hotkeys and notable site/city lists from locations_str.dat
  - Research completion popup location cards now show original-game location flavor instead of generic placeholder copy
  - Added focused GameView coverage for location unlock presentation (example: ANTARCTIC via Advanced Database Manipulation)
- **Restored research screen parity with original game (2026-06-01):**
  - ✅ Mirrored danger-tier CPU budgeting from original game (`getCpuLeftByDanger()`)
  - ✅ Restored CPU Pool and Jobs as research panel allocation targets alongside techs
  - ✅ Implemented cumulative safety-tier CPU restrictions (affects at danger tier affect all higher tiers)
  - ✅ Restored dangerous-tech blocking when safe CPU unavailable
  - ✅ Automatic CPU rebalancing when allocations exceed danger-tier budgets
  - ✅ All 51 tests passing (23 data + 22 engine + 2 game view + 4 research panel)
  - ✅ Full build validates cleanly, 395.08 kB gzip
  - ✅ Unlock domains now include: research techs, bases, jobs, and locations all surfaced in completion modal
- **Fixed event log layout stability (2026-06-01):**
  - ✅ Changed event console CSS from `max-height` to fixed `height: 140px`
  - ✅ Event log now starts at full display size on screen load
  - ✅ Prevents dynamic layout growth that reshapes the world map
  - ✅ Content scrolls within fixed container instead of container resizing
  - ✅ All 51 tests passing after CSS change
  - ✅ Build clean: 392.14 kB gzip
- **Redesigned tech tree as branch-linked strategy graph (2026-06-01):**
  - ✅ Replaced canvas dots with full tech cards (name, narrative description, and progress tracking)
  - ✅ Added branch lines between prerequisites and unlocked dependents
  - ✅ Enforced requested status colors: yellow (in progress), gray (locked), red (dangerous unlocked), green (done)
  - ✅ Added per-tech tracking data in each card: CPU progress, cash progress, CPU assignment, and ETA state
  - ✅ Improved selection flow: clicking a card highlights connected branches and opens detailed requires/unlocks context
  - ✅ Follow-up polish: stronger branch contrast with halo strokes for easier dependency scanning
  - ✅ Follow-up polish: clearer card hierarchy with explicit status badges and labeled CPU/Cash progress bars
  - ✅ Follow-up polish: adaptive compact layout mode for large trees to keep dense graphs readable
  - ✅ Interaction update: tech click now opens a dedicated popup modal instead of expanding inline details
  - ✅ Detail modal supports close button, backdrop click, and Escape key dismissal
  - ✅ Added full per-tech research controls directly inside popup modal (−1/+1/+5/+10, max, clear, exact set)
  - ✅ Tech popup allocation logic now matches main research panel budget and lock/completion guardrails
  - ✅ Status behavior update: "In Progress" now requires active CPU assignment
  - ✅ Added explicit "Paused" status for partially researched techs with 0 assigned CPUs
  - ✅ Cash progress display update: zero-cash techs now show "N/A" instead of "100%"
  - ✅ Fixed stale tech-tree status rendering after popup CPU changes (tree now refreshes without reopening)
  - ✅ Dangerous-tech visual rule update: dangerous techs now render red in both locked and unlocked states
  - ✅ Dangerous threshold update: any positive danger level now counts as dangerous for red tech-tree rendering
  - ✅ Upgraded modal sizing for a proper wide tech-tree screen feel
  - ✅ Modal accessible from Research panel via "📊 View Tech Tree" button
  - ✅ Modal accessible from Knowledge panel via "📊 View Tech Tree" button
  - ✅ All 51 tests passing after redesign
  - ✅ Build clean: 405.30 kB gzip (59 modules), DOM/SVG branch graph visualization

Remaining work:
- Main menu flow additional depth (submenus, campaign story intro, credits/help)
- Loss/game-over narrative parity: replace current generic game-over modal with desktop-aligned loss flow using story sections for both "Lost No Bases" and "Lost Suspicion"
- Loss flow polish: support multi-step story dialog progression/skip behavior instead of single-message dead-end modal
- Loss-state trigger parity: add suspicion-based defeat presentation (not just no-bases defeat), including correct branching into the matching loss narrative
- Full tooltip coverage pass across all gameplay and menu surfaces (status stats, controls, map overlays, modals, form fields, and destructive actions)
- Tooltip content standardization (what it means, why it matters, and side effects where applicable)
- Tooltip consistency and discoverability pass (desktop hover + keyboard focus, mobile-safe alternatives)
- Research screen parity gaps: expose `CPU Pool` and `Jobs` as first-class allocation targets like the desktop research screen
- Research screen parity gaps: revisit desktop slider-style feedback, danger help affordances, and live CPU-budget visualization where useful
- Cross-panel research parity: keep Research and Knowledge screens aligned on narrative/result/effect wording and unlock presentation
- Location screen actions depth (additional base lifecycle operations)
- Base screen deep parity for item construction and management
- Sidebar compact/expand toggle for responsive narrow screens
- Location/base card visual previews with thematic imagery (location-specific maps/icons)
- Tech/research visual indicators and danger-level color coding
- Reports additional parity polish (desktop fixture alignment)
- Log screen additional parity polish (persistent archival storage behavior)
- Knowledge/story additional parity polish (desktop narrative trigger alignment)
- Options additional features (audio volume, language selection, performance tuning)
- Save/load UX additional parity polish (slot sorting/grouping, richer archival semantics)

Deliverables:
- Dedicated components/routes for each screen
- Shared UI primitives for lists/dialogs/sliders/tooltips
- Tooltip coverage checklist and content map for all major UI labels/buttons/indicators
- Accessibility-aligned tooltip behavior notes (focus, timing, and fallback text)

Recently completed implementation notes:
- Map fidelity and interaction pass:
  - Canvas region boundaries now derive from shared click-region geometry
  - Region extraction script updated to split connected landmasses via seeded assignment
  - Non-interactive islands/regions hidden from render path
- Loading and transition UX pass:
  - App bootstrap loader added at static HTML layer
  - Game-entry loader blocks GameView until key map assets are decoded
  - Decode-aware preload path added for Edge timing stability
- Input and control polish:
  - Escape-to-close across gameplay/main-menu modals
  - New "+1h" control added without removing existing timestep controls
- Tooling visibility:
  - Dev server logs now show first-seen client connections and resource requests
- CPU assignment lifecycle fixes (2026-05-28):
  - Added validation to prevent allocation to completed techs
  - Added error handling in store to prevent invalid assignments from reaching UI
  - Improved ResearchPanel buttons: +1/+5/+10 CPU instead of single "Assign 1 CPU"
  - Added allocation persistence across UI states (buttons use row.allocation as base)
  - Added helpful tooltips explaining why buttons are disabled
  - Clear button now only enabled when there's actually an allocation to clear
- Tooltip foundation pass (2026-05-28):
  - Added tooltip help text for CPU Availability semantics (idle vs owned)
  - Added tooltip hint on idle CPUs in research context (idle CPUs can run jobs for cash)
  - Established baseline pattern for expanding tooltip coverage to all major controls
- Data conversion validation harness (2026-05-28):
  - Created 22 comprehensive data validation tests covering schema, references, and ranges
  - Validates all core domains: difficulties, techs, bases, locations, groups, events
  - Validates cost/maintenance structures have correct dimensions
  - Validates prerequisites reference chain consistency
  - Validates group/region references in bases and locations
  - Validates danger levels and grace period settings
  - Tests include: 30+ techs, 5+ bases, 10+ locations, 8+ groups verified
  - All 40 tests passing (22 data + 17 game engine + 1 UI)

### M12. Mobile and Accessibility Parity
Status: not started

Remaining work:
- Touch-first interactions for map and controls
- Responsive layout tuning across breakpoints
- Replace keyboard-only patterns with mobile-safe alternatives
- Focus handling, ARIA semantics, and keyboard navigation
- Contrast and text-size accessibility checks

Deliverables:
- Accessibility improvements
- Mobile interaction patterns and testing notes

### M13. i18n Integration
Status: not started

Remaining work:
- Integrate runtime i18n library
- Load converted translation resources
- Add language switching and persistence
- Validate translated layout behavior and overflow
- Recreate key translation-sensitive UI semantics

Deliverables:
- i18n runtime wiring
- Language selector and translated UI content

### M14. Audio Integration
Status: not started

Remaining work:
- Add browser-safe audio manager
- Implement music and sound effect playback controls
- Recreate desktop loss-audio behavior by supporting a dedicated "lose" music cue/class in the web runtime
- Integrate with options/preferences
- Validate browser autoplay restrictions and user-gesture handling

Deliverables:
- Audio subsystem module
- UI controls and persistence integration

### M15. Offline and PWA Hardening
Status: not started

Remaining work:
- Full service worker generation in standard runtime target
- Asset/data caching strategy
- Save behavior under offline/online transitions
- PWA install behavior validation
- Node/tooling compatibility policy for build environments

Deliverables:
- Stable PWA configuration
- Offline verification checklist and results

### M16. Regression and Parity Testing Expansion
Status: not started

Remaining work:
- Expand unit tests to cover full engine behavior
- Add fixture parity tests against desktop reference scenarios
- Add regression coverage for both desktop defeat paths (all bases lost, suspicion threshold reached) and verify the correct loss narrative/audio branch is selected
- Add E2E browser tests for full gameplay loops
- Add cross-browser test matrix
- Add CI workflow for conversion + test + build

Deliverables:
- Expanded Vitest suite
- Playwright or equivalent E2E suite
- CI configuration

### M17. Performance and Stability Hardening
Status: not started

Remaining work:
- Profile long sessions for memory growth
- Profile map and simulation update cost
- Optimize serialization and IndexedDB performance
- Optimize rendering hotspots
- Add crash-safe recovery behaviors and diagnostics

Deliverables:
- Performance baseline report
- Optimization patches and monitoring hooks

### M18. Release Readiness
Status: not started

Remaining work:
- Define release criteria and QA checklist
- Freeze save format versioning policy
- Create migration notes and player documentation
- Package deployment target and rollout process
- Define rollback procedure

Deliverables:
- Release checklist
- Deployment and rollback docs

## Validation Status Matrix

Current validated:
- npm install: pass
- npm test: pass (49 tests: 23 data validation + 22 game engine + 4 UI component)
- focused popup regression: pass (`src/app/GameView.test.tsx`)
- npm build: pass (58 modules, 381.31 kB, gzip 119.37 kB)
- data generation command: pass
- CPU allocation prevention: working (prevents allocation to completed techs)
- Research completion cleanup: working (auto-clears CPU allocation)
- Data schema validation: working (verified 22 schemas including costs, prerequisites, group references, etc.)
- Tech narrative fields: working (description and result strings loaded from techs_str.dat and displayed in ResearchPanel)
- Base/task narrative fields: working (descriptions loaded from bases_str.dat and tasks_str.dat and surfaced in completion popup cards)
- Research completion popup: working (result string plus newly unlocked research, bases, locations, and jobs)
- Location flavor fields: working (hotkeys and notable site lists loaded from locations_str.dat and surfaced in location unlock cards)

Validation test coverage (M8/M16):
- Difficulties: startingCash, gracePeriodCpu, baseGraceMultiplier verified
- Techs: 30+ techs, cost/danger ranges, prerequisites chain validation
- Bases: 5+ bases, cost/maintenance structure, prerequisite validation
- Locations: 10+ locations, region references, position data
- Groups: covert and other groups, suspicion decay values
- Events: effect structure, chance values, duration tracking
- Internal IDs: mapping consistency validation

Not yet validated:
- Full gameplay parity scenarios with different difficulty modes
- Research/task allocation parity for `cpu_pool`/`jobs` UI targets versus the original desktop behavior
- Danger-tier CPU budgeting parity versus the original desktop `available_cpus[0..3]` model
- Cross-browser runtime behavior
- Mobile UX parity
- Offline end-to-end user flows
- Accessibility conformance
- Tooltip coverage completeness and wording consistency across all screens

## Immediate Next Priorities

1. Complete remaining M11 screen-parity workflows (deep research/base/location panel interactions, report refinements)
2. Close research parity gaps called out by the audit (`CPU Pool`/`Jobs` UI targets, danger-tier CPU budgeting, cross-panel wording consistency)
3. Add conversion validation and parity fixtures in automated tests (M8 + M16)
4. Integrate translations and audio systems (M13 + M14)
5. Expand cross-browser/mobile/offline verification and CI hardening (M12 + M15 + M16)
6. Performance profiling and optimization (M17)
7. Complete full tooltip coverage pass for all major UI labels/buttons/indicators and document coverage checklist (M11 + M12)

## Execution Checklist To 100% Port (Ordered + Estimated)

Assumptions:
- Estimates are for one primary engineer working continuously.
- Ranges include implementation + tests + bugfix pass for each phase.
- Some phases can overlap, but ordering below reflects lowest-risk critical path.

### Phase 1. Engine Parity Core (M9)
Status: completed 2026-05-27

Delivered:
- Event/effect runtime pipeline with trigger, undo, and save semantics
- Group suspicion dynamics and discover-bonus modifiers integrated into runtime
- Base lifecycle outcomes now include detection and maintenance-destruction paths
- Grace-period logic integrated into base risk flow
- Engine save schema extended for groups/events/effects with v1 compatibility
- Deterministic tests added for effect application, base detection outcomes, and duration event expiry

Follow-up moved to later phases:
- Desktop parity fixture matrix (M8 + M16)
- Region/location modifier edge-case parity validation (M8 + M16)

### Phase 2. Renderer and Map Fidelity (M10)
Status: completed 2026-05-27

Delivered:
- Replaced DOM marker map with Canvas renderer
- Preserved location selection through canvas hit-testing
- Added simulation-time day/night shading via solar terminator progression
- Added map HUD overlays (day, solar position, node count, hover status)
- Integrated renderer into app flow and validated stable build/test in current environment

Follow-up moved to later phases:
- High-fidelity visual polish and optional Pixi upgrade exploration (M11 + M17)
- Cross-device frame pacing and memory profiling matrix (M12 + M17)

### Phase 3. Screen Parity Completion (M11)
Status: in progress

Delivered so far:
- Main menu panel and start/continue flow skeleton
- Save-slot metadata cards for primary continue workflows
- Dedicated save manager workflows (slot save/load/delete + import/export)
- Reports screen with activity analytics and watch summaries
- Log screen with multi-factor filtering controls
- Base management screen with upkeep and power actions
- Base management screen with operational filters and risk/grace monitoring details
- Log screen with runtime action feed and type filtering
- Knowledge/story screen with researched techs, locations, active events, and world-state summary
- Research screen filtering and sorting controls
- Expanded app tab structure to include all above screens
- Location build actions now display cash/upkeep cost metadata

Checklist:
- Deepen main menu/new game flow to full parity
- Implement base management depth (items/construction/actions)
- Deepen log screen parity (categories, filtering, archival behavior)
- Deepen knowledge/story parity with narrative flow
- Deepen research/location/reports/options behavior details (sorting, metadata, workflows)
- Restore desktop research-screen allocation targets for `CPU Pool` and `Jobs`
- Decide whether to match desktop danger-tier CPU budgeting exactly or keep the simplified single-pool model as an intentional divergence
- Align Research and Knowledge tech presentation so narrative/result/effect wording stays consistent across both surfaces
- Finalize save/load UX parity with slot metadata and management flows

Definition of done:
- Every major legacy screen has a web counterpart with matching core workflows
- No screen-level blockers remain for full campaign playthrough

### Phase 4. Data Conversion and Parity Fixtures (M8 + M16)
Estimated effort: 1-2 weeks

Checklist:
- Finish conversion of all gameplay-relevant data domains
- Add schema validation and deterministic dataset checksums
- Build desktop-reference fixture suite for high-risk scenarios
- Wire conversion + parity tests into CI

Definition of done:
- Conversion is reproducible and validated
- Fixture suite catches drift between source data and runtime interpretation

### Phase 5. i18n + Audio + Offline (M13 + M14 + M15)
Estimated effort: 1-2 weeks

Checklist:
- Integrate runtime i18n and language persistence
- Verify layout/overflow for major translated locales
- Integrate music/SFX with browser-safe playback rules
- Harden service worker caching, offline behavior, and install flow

Definition of done:
- App is fully playable with translations, audio, and offline support enabled

### Phase 6. Stability, Performance, Release (M17 + M18)
Estimated effort: 1-2 weeks

Checklist:
- Run long-session profiling and memory-leak checks
- Optimize serialization, persistence, and render hotspots
- Add crash-safe recovery behaviors and diagnostics
- Finalize release checklist, migration notes, and rollback plan

Definition of done:
- Release checklist passes with no P0/P1 defects
- Web build is ready for tagged release

## Critical Path Summary

1. M11 screen parity
2. M8 + M16 conversion/fixture confidence
3. M13 + M14 + M15 feature-complete platform parity
4. M12 mobile/accessibility verification
5. M9 edge-case parity hardening
6. M17 + M18 release hardening

Total estimated remaining effort: 6-11 weeks (single primary engineer).

## Change Log For This Tracker

- 2026-05-27: Initial milestone tracker created with completed progress and full remaining scope.
- 2026-05-27: Updated milestones to reflect interactive map, dedicated panels, options/settings persistence, maintenance risk forecasting, autosave behavior, and expanded test coverage.
- 2026-05-27: Completed phase 1 engine parity implementation (effects/events/group dynamics/base detection-destruction flow), added save v2 compatibility fields, converted events.dat into generated data, and expanded engine tests to 14 passing cases.
- 2026-05-27: Completed phase 2 map renderer implementation by replacing DOM markers with a Canvas map, adding time-linked day/night shading and map HUD overlays, and validating test/build in current environment.
- 2026-05-27: Began phase 3 screen parity implementation by adding dedicated main-menu/base/log/knowledge panels, wiring session activity logs, expanding screen tabs, and surfacing build-action cash/upkeep costs in location operations.
- 2026-05-27: Extended phase 3 workflow parity with save-slot metadata cards, research filtering/sorting controls, log filtering, and richer knowledge/world-state summaries; validated test/build in current environment.
- 2026-05-27: Fixed research panel refresh bug where project status could appear stale after time advancement until filter/sort interaction.
- 2026-05-27: Completed quick stale-state sweep and removed additional mutable-game memoization risk in app-level derived UI state.
- 2026-05-27: Added component regression test for research panel live progress updates after time advancement to prevent stale-status regressions.
- 2026-05-27: Fixed engine bug where completed research tasks could retain CPU assignment; added regression coverage to ensure CPU auto-unassign on research completion.
- 2026-05-27: Expanded phase 3 save/load UX with a dedicated Save Manager screen, multi-slot actions (save/load/delete), and centralized import/export workflows.
- 2026-05-27: Expanded phase 3 reports/log parity with activity breakdowns, timeline summaries, suspicion/event watch reporting, and richer log filtering/search workflows.
- 2026-05-27: Expanded phase 3 base-management depth with location/power filtering, maintenance risk visibility, grace tracking, and quick location focus actions.
- 2026-05-27: Fixed base management table headers rendering so column labels are visible on desktop layouts.
- 2026-05-27: Deepened phase 3 research screen with prerequisite visibility badges showing tech dependency chains and completion status.
- 2026-05-27: Deepened phase 3 location operations view with per-base grace timers, risk indicators, and filtered maintenance breakdown stats.
- 2026-06-01: Audited webapp research/tech behavior against the original desktop implementation; confirmed effect and narrative data parity, and recorded remaining gaps around `CPU Pool`/`Jobs` research targets, danger-tier CPU budgeting, cross-panel wording consistency, and endgame presentation polish.
- 2026-05-27: Deepened phase 3 main menu with difficulty parameter details (starting cash, interest rate, grace period, discovery risk) and new game confirmation modal.
- 2026-05-27: Deepened phase 3 knowledge/story screen with tech research progress metrics, researched/available/locked tech categorization, and richer world state summaries.
- 2026-05-27: Deepened phase 3 options panel with organized setting sections (simulation, display) and descriptive help text for each option.
- 2026-05-27: Added research danger rating display with color-coded badges (low/medium/high threat levels) for each tech to enhance player decision-making.
- 2026-05-27: Cleaned phase 3 app shell composition so each tab only shows its intended panel(s), removing persistent cross-screen scaffolding.
- 2026-05-27: Deepened phase 3 save/load workflows with current-session metadata, quick recovery actions, empty-slot filtering, and confirm guards for destructive/overwrite operations.
- 2026-05-27: Deepened phase 3 log workflows with semantic category filters, day-group timeline view, archive-before-day controls, archived preview block, and filtered JSON export.
- 2026-05-27: Deepened phase 3 knowledge/story with narrative phase progression, milestone checklist, story journal from meaningful session events, and researched tech dossiers.
- 2026-05-27: Deepened phase 3 reports with risk-base details, net cash/CPU outlook, CPU allocation breakdown, and active-event remaining-duration reporting.
- 2026-05-27: Updated new-game UX flow to switch to the Map tab immediately after starting a run.
- 2026-05-27: Added report history persistence to IndexedDB so operational insights (activity, base distribution, suspicion trends, resource outlook) persist across save/load cycles and rebuild on game reload.
- 2026-05-28: Completed UI/UX refinement phase 3 with CPU allocation safety guardrails: engine enforcement in setAllocatedCpuFor(), maxAssignableCpuFor() for dynamic button disabling, and effectiveCpuPool() cap-checking to prevent negative pool scenarios.
- 2026-05-28: Resolved grace period messaging contradiction by documenting two independent systems: global grace (hadGrace flag) and per-base grace (graceOver flag with duration calculation), added comprehensive tooltips to BasePanel, LocationPanel, and KnowledgePanel distinguishing the systems.
- 2026-05-28: Restored BasePanel modal as callable screen with 🏢 Bases button in sidebar navigation (missing in prior phase).
- 2026-05-28: Enhanced BasePanel with comprehensive tooltip coverage across all stats and table columns explaining CPU contribution, maintenance costs, power status semantics, grace windows, and risk thresholds.
- 2026-05-28: Implemented base abandonment feature with abandonBase() engine method calling internal destroyBase(), integrated through gameStore, and added confirm dialogs in both LocationPanel and BasePanel to prevent accidental deletions.
- 2026-05-28: Restructured right sidebar layout using flexbox to enable LocationPanel scrolling while keeping Story Watch card fixed at bottom, preventing unreachable story/alert information.
- 2026-05-28: Verified full build success with 0 TypeScript errors, 44/44 tests passing, and 58 modules compiled (356.96 kB JS / 111.35 kB gzip, 25.32 kB CSS / 5.67 kB gzip).
- 2026-05-28: Audited original desktop loss flow and recorded remaining parity work: desktop uses story-section-based loss presentation for both no-base and suspicion defeat states plus an optional "lose" music cue, with no dedicated bundled loss image assets in this checkout.
- 2026-05-28: Reworked gameplay layout controls with a bottom-docked collapsible event console and map-edge sidebar hide/show nubs, then followed up to fix the first-pass collapse behavior so sidebars release layout space instead of only hiding their contents.
- 2026-06-01: Added a research completion reward popup in GameView that triggers from completed-research log entries, shows result text, and groups newly unlocked research, bases, locations, and jobs using live prerequisite checks.
- 2026-06-01: Extended the data conversion pipeline to load narrative descriptions for bases and job tiers from bases_str.dat and tasks_str.dat, then surfaced that copy inside the research completion reward cards.
- 2026-06-01: Extended converted location data with original-game hotkeys and site/city lists from locations_str.dat, then replaced generic location unlock copy with actual location flavor in the research completion reward cards.
