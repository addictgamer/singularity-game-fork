# Singularity Webapp (Implementation Slice)

This folder contains the first implemented vertical slice of the webapp rewrite plan:

- Browser-native TypeScript + React + Vite app scaffold
- Build-time data conversion from `singularity/data/*.dat` into JSON
- Initial simulation engine for time, cash, CPU allocation, and early tech research
- Location availability and base construction flow (engine + UI)
- IndexedDB persistence via Dexie
- JSON import/export for web savegames
- Basic multi-screen shell for Map/Research/Location/Reports/Options navigation
- PWA plugin wiring and manifest setup
- Vitest coverage for core engine behavior and save roundtrip

## Commands

Run from this folder:

```bash
python3 ./scripts/convert_game_data.py
npm install
npm run test
npm run dev
```

## Notes

- The engine currently focuses on parity for behaviors covered by early game tests (new game, CPU assignment, cash progression, and initial research flow).
- The map is a styled placeholder. The full Pixi.js map rendering pass is the next major implementation milestone.
- The location tab now supports selecting locations, checking availability, and building eligible bases.
- Save compatibility currently targets the new web format only (`version: 1`).
