# Singularity Webapp Rewrite Milestones

## Purpose
This file tracks:
- Current progress completed in the web rewrite
- In-flight work that is partially complete
- All remaining work required for full-scope delivery

Scope target remains full gameplay parity in a browser-native webapp with desktop and mobile support, offline support, and no dependency on legacy desktop save import.

## Current Snapshot
Status date: 2026-05-27

Overall completion estimate: 67%

High-level status:
- Foundation and multiple vertical slices implemented
- Engine parity remains partial but now includes power/maintenance lifecycle scaffolding
- UI parity remains partial but now includes dedicated research/location/reports/options panels
- Data conversion is partial (core gameplay domains converted)
- Validation harness has grown and is actively maintained
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

Completed in this phase slice:
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

Remaining work:
- Main menu flow deep parity (submenus, campaign start messaging, credits/help flows)
- Research screen deep parity (advanced sorting/filtering/metadata)
- Location screen deep parity (full base lifecycle actions and warnings)
- Base screen deep parity for item construction and management
- Reports deep parity and detailed data views
- Log screen deep parity (persistent archival behavior and richer categorization semantics)
- Knowledge/story deep parity (story progression sections and narrative triggers)
- Options deep parity with full settings coverage
- Save/load UX parity around slots, metadata, and management workflows

Deliverables:
- Dedicated components/routes for each screen
- Shared UI primitives for lists/dialogs/sliders/tooltips

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
- npm test: pass
- npm build: pass
- data generation command: pass

Not yet validated:
- Full gameplay parity scenarios
- Cross-browser runtime behavior
- Mobile UX parity
- Offline end-to-end user flows
- Accessibility conformance

## Immediate Next Priorities

1. Deepen M11 screens to full workflow parity (research/location/base/log/knowledge/options)
2. Add conversion validation and parity fixtures in automated tests (M8 + M16)
3. Integrate translations and audio systems (M13 + M14)
4. Expand cross-browser/mobile/offline verification and CI hardening (M12 + M15 + M16)
5. Continue engine edge-case parity validation and regression hardening (M9 + M16)

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
