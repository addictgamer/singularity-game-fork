import { create } from "zustand";
import gameData from "../generated/gameData.json";
import { GameData } from "../engine/types";
import { GameState } from "../engine/game";
import { SECONDS_PER_DAY } from "../engine/constants";
import { exportGameToJson, importGameFromJson } from "../engine/save";
import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  SaveSummary,
  ReportHistoryRecord,
  deleteGameFromSlot,
  deleteReportHistoryForSlot,
  listSaveSummaries,
  loadAppSettings,
  loadGameFromSlot,
  loadReportHistoryForSlot,
  saveAppSettings,
  saveGameToSlot,
  saveReportHistory,
} from "./persistence";

interface GameStore {
  availableDifficulties: GameData["difficulties"];
  selectedDifficultyId: string;
  appScreen: "main-menu" | "game";
  game: GameState | null;
  selectedLocationId: string;
  settings: AppSettings;
  settingsLoaded: boolean;
  lastAutosaveDay: number;
  currentSlot: string | null;
  saveSummaries: SaveSummary[];
  sessionLog: Array<{ id: number; day: number; kind: string; message: string }>;
  reportHistory: ReportHistoryRecord[];
  setAppScreen: (screen: "main-menu" | "game") => void;
  setDifficulty: (id: string) => void;
  setSelectedLocation: (id: string) => void;
  initializeSettings: () => Promise<void>;
  refreshSaveSummaries: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  startNewGame: () => void;
  assignCpu: (taskId: string, amount: number) => void;
  buildBaseAtSelectedLocation: (baseId: string) => boolean;
  toggleBasePower: (baseId: string) => boolean;
  abandonBase: (baseId: string) => boolean;
  destroyAllBases: () => boolean;
  availableBuildableBaseIds: () => string[];
  advanceBySeconds: (seconds: number) => Promise<void>;
  advanceByCurrentTimeStep: () => Promise<void>;
  advanceHour: () => Promise<void>;
  advanceHalfDay: () => Promise<void>;
  advanceDay: () => Promise<void>;
  saveToSlot: (slot: string) => Promise<void>;
  loadFromSlot: (slot: string) => Promise<void>;
  deleteFromSlot: (slot: string) => Promise<void>;
  exportCurrentGame: () => string | null;
  importCurrentGame: (serialized: string) => void;
}

const typedGameData = gameData as unknown as GameData;

type SessionLogEntry = { id: number; day: number; kind: string; message: string };

type AdvanceSnapshot = {
  techDoneById: Map<string, boolean>;
  eventTriggeredById: Map<string, boolean>;
  basesById: Map<string, { name: string; locationId: string; powerState: "active" | "sleep" | "offline" }>;
  availableLocationIds: Set<string>;
  apotheosis: boolean;
  hadGrace: boolean;
  gameOver: boolean;
};

function captureAdvanceSnapshot(game: GameState): AdvanceSnapshot {
  return {
    techDoneById: new Map(Array.from(game.techs.entries()).map(([id, tech]) => [id, tech.done])),
    eventTriggeredById: new Map(Array.from(game.events.entries()).map(([id, event]) => [id, event.triggered])),
    basesById: new Map(
      game.bases.map((base) => [
        base.id,
        {
          name: base.name,
          locationId: base.locationId,
          powerState: base.powerState,
        },
      ])
    ),
    availableLocationIds: new Set(
      Array.from(game.locations.keys()).filter((locationId) => game.locationAvailable(locationId))
    ),
    apotheosis: game.apotheosis,
    hadGrace: game.hadGrace,
    gameOver: game.gameOver,
  };
}

function collectPlayerFacingAdvanceEvents(game: GameState, before: AdvanceSnapshot): Array<Omit<SessionLogEntry, "id">> {
  const entries: Array<Omit<SessionLogEntry, "id">> = [];

  for (const [techId, tech] of game.techs.entries()) {
    if (tech.done && !before.techDoneById.get(techId)) {
      entries.push({
        day: game.rawDay,
        kind: "research",
        message: `Research completed: ${tech.name}`,
      });
    }
  }

  for (const [eventId, eventState] of game.events.entries()) {
    const wasTriggered = before.eventTriggeredById.get(eventId) ?? false;
    if (eventState.triggered && !wasTriggered) {
      const eventName = game.eventDefs.get(eventId)?.name ?? eventId;
      entries.push({
        day: game.rawDay,
        kind: "event",
        message: `Event triggered: ${eventName}`,
      });
    } else if (!eventState.triggered && wasTriggered) {
      const eventName = game.eventDefs.get(eventId)?.name ?? eventId;
      entries.push({
        day: game.rawDay,
        kind: "event",
        message: `Event ended: ${eventName}`,
      });
    }
  }

  const currentBaseIds = new Set(game.bases.map((base) => base.id));
  for (const [baseId, baseBefore] of before.basesById.entries()) {
    if (!currentBaseIds.has(baseId)) {
      const locationName = game.locations.get(baseBefore.locationId)?.name ?? baseBefore.locationId;
      entries.push({
        day: game.rawDay,
        kind: "base",
        message: `Base lost: ${baseBefore.name} at ${locationName}`,
      });
    }
  }

  const currentBaseById = new Map(game.bases.map((base) => [base.id, base]));
  for (const [baseId, baseBefore] of before.basesById.entries()) {
    const baseAfter = currentBaseById.get(baseId);
    if (!baseAfter) {
      continue;
    }
    if (baseBefore.powerState === "active" && baseAfter.powerState === "sleep") {
      entries.push({
        day: game.rawDay,
        kind: "base",
        message: `Base entered sleep mode: ${baseAfter.name}`,
      });
    }
  }

  const availableAfter = new Set(
    Array.from(game.locations.keys()).filter((locationId) => game.locationAvailable(locationId))
  );
  for (const locationId of availableAfter) {
    if (!before.availableLocationIds.has(locationId)) {
      const locationName = game.locations.get(locationId)?.name ?? locationId;
      entries.push({
        day: game.rawDay,
        kind: "location",
        message: `Location unlocked: ${locationName}`,
      });
    }
  }

  if (!before.apotheosis && game.apotheosis) {
    entries.push({
      day: game.rawDay,
      kind: "event",
      message: "Endgame state reached",
    });
  }

  if (before.hadGrace && !game.hadGrace) {
    entries.push({
      day: game.rawDay,
      kind: "system",
      message: "Grace period ended",
    });
  }

  if (!before.gameOver && game.gameOver) {
    entries.push({
      day: game.rawDay,
      kind: "system",
      message: "Game over: all bases lost",
    });
  }

  return entries;
}

export const useGameStore = create<GameStore>((set, get) => ({
  availableDifficulties: typedGameData.difficulties,
  selectedDifficultyId: typedGameData.difficulties.find((d) => d.id === "normal")?.id ?? typedGameData.difficulties[0]?.id ?? "normal",
  appScreen: "main-menu",
  selectedLocationId: typedGameData.locations[0]?.id ?? "N AMERICA",
  settings: DEFAULT_APP_SETTINGS,
  settingsLoaded: false,
  lastAutosaveDay: 0,
  currentSlot: null,
  saveSummaries: [],
  sessionLog: [],
  reportHistory: [],
  game: null,
  setAppScreen: (screen) => set({ appScreen: screen }),
  setDifficulty: (id) => set({ selectedDifficultyId: id }),
  setSelectedLocation: (id) => set({ selectedLocationId: id }),
  initializeSettings: async () => {
    const [settings, saveSummaries] = await Promise.all([loadAppSettings(), listSaveSummaries()]);
    set({ settings, settingsLoaded: true, saveSummaries });
  },
  refreshSaveSummaries: async () => {
    const saveSummaries = await listSaveSummaries();
    set({ saveSummaries });
  },
  updateSettings: async (patch) => {
    const state = get();
    const settings = { ...state.settings, ...patch };
    await saveAppSettings(settings);
    set({ settings });
  },
  startNewGame: () => {
    const state = get();
    const game = new GameState(typedGameData, state.selectedDifficultyId);
    set({
      appScreen: "game",
      game,
      currentSlot: null,
      lastAutosaveDay: 0,
      reportHistory: [],
      sessionLog: [
        {
          id: Date.now(),
          day: game.rawDay,
          kind: "system",
          message: `Started new game on ${state.selectedDifficultyId}`,
        },
      ],
    });
  },
  assignCpu: (taskId, amount) => {
    const state = get();
    if (!state.game || state.game.gameOver) {
      return;
    }
    try {
      state.game.setAllocatedCpuFor(taskId, amount);
      set({
        game: state.game,
        sessionLog: [
          ...state.sessionLog,
          {
            id: Date.now(),
            day: state.game.rawDay,
            kind: "cpu",
            message: `CPU assignment: ${taskId} -> ${amount}`,
          },
        ],
      });
    } catch (error) {
      console.warn(`CPU assignment failed: ${error instanceof Error ? error.message : String(error)}`);
      // Silently fail - UI buttons should prevent invalid assignments
    }
  },
  buildBaseAtSelectedLocation: (baseId) => {
    const state = get();
    if (!state.game || state.game.gameOver) {
      return false;
    }
    const built = state.game.buildBase(baseId, state.selectedLocationId);
    set({
      game: state.game,
      sessionLog: built
        ? [
            ...state.sessionLog,
            {
              id: Date.now(),
              day: state.game.rawDay,
              kind: "build",
              message: `Built ${baseId} at ${state.selectedLocationId}`,
            },
          ]
        : state.sessionLog,
    });
    return built;
  },
  toggleBasePower: (baseId) => {
    const state = get();
    if (!state.game || state.game.gameOver) {
      return false;
    }
    const toggled = state.game.toggleBasePower(baseId);
    set({
      game: state.game,
      sessionLog: toggled
        ? [
            ...state.sessionLog,
            {
              id: Date.now(),
              day: state.game.rawDay,
              kind: "power",
              message: `Toggled power state for ${baseId}`,
            },
          ]
        : state.sessionLog,
    });
    return toggled;
  },
  abandonBase: (baseId) => {
    const state = get();
    if (!state.game || state.game.gameOver) {
      return false;
    }
    const abandoned = state.game.abandonBase(baseId);
    set({
      game: state.game,
      sessionLog: abandoned
        ? [
            ...state.sessionLog,
            {
              id: Date.now(),
              day: state.game.rawDay,
              kind: "base",
              message: `Abandoned base ${baseId}`,
            },
          ]
        : state.sessionLog,
    });
    return abandoned;
  },
  destroyAllBases: () => {
    const state = get();
    if (!state.game || state.game.gameOver) {
      return false;
    }
    const destroyed = state.game.destroyAllBases();
    set({
      game: state.game,
      sessionLog: destroyed
        ? [
            ...state.sessionLog,
            {
              id: Date.now(),
              day: state.game.rawDay,
              kind: "base",
              message: "All bases destroyed",
            },
          ]
        : state.sessionLog,
    });
    return destroyed;
  },
  availableBuildableBaseIds: () => {
    const state = get();
    if (!state.game) {
      return [];
    }
    return Array.from(state.game.baseDefs.values())
      .filter((base) => state.game?.canBuildBaseAt(base.id, state.selectedLocationId))
      .map((base) => base.id);
  },
  advanceBySeconds: async (seconds) => {
    const state = get();
    if (!state.game || state.game.gameOver) {
      return;
    }
    const beforeSnapshot = captureAdvanceSnapshot(state.game);
    state.game.giveTime(seconds);
    const playerFacingEvents = collectPlayerFacingAdvanceEvents(state.game, beforeSnapshot);

    let newLastAutosaveDay = state.lastAutosaveDay;
    if (state.settings.autosaveEnabled && state.game.rawDay - state.lastAutosaveDay >= 3) {
      await saveGameToSlot("autosave", state.game.serialize());
      newLastAutosaveDay = state.game.rawDay;

      if (state.currentSlot === "autosave" || state.currentSlot === null) {
        const maintenance = state.game.getMaintenanceSnapshot();
        const basesByLocation = Array.from(state.game.locations.values())
          .map((location) => ({
            id: location.id,
            name: location.name,
            count: state.game!.getBasesAtLocation(location.id).length,
          }))
          .filter((entry) => entry.count > 0)
          .sort((a, b) => b.count - a.count);
        const suspicionSnapshot = [...state.game.groups.entries()]
          .map(([id, group]) => ({ id, suspicion: group.suspicion }))
          .sort((a, b) => b.suspicion - a.suspicion)
          .slice(0, 5);
        await saveReportHistory({
          slot: "autosave",
          day: state.game.rawDay,
          activityByKind: {},
          basesByLocation,
          suspicionSnapshot,
          activeEventCount: [...state.game.events.entries()].filter(([, e]) => e.triggered).length,
          atRiskBaseCount: maintenance.atRiskBaseIds.length,
          resourceOutlook: {
            netCash: state.game.computeFutureResourceFlow().jobs + state.game.computeFutureResourceFlow().interest - maintenance.cashMaintenance,
            cpuHeadroom: state.game.effectiveCpuPool() - maintenance.cpuMaintenance,
          },
        });
      }
    }

    const saveSummaries = newLastAutosaveDay !== state.lastAutosaveDay
      ? await listSaveSummaries()
      : state.saveSummaries;

    const baseLogId = Date.now();
    const eventLogEntries: SessionLogEntry[] = playerFacingEvents.map((entry, index) => ({
      id: baseLogId + index,
      day: entry.day,
      kind: entry.kind,
      message: entry.message,
    }));

    set({
      game: state.game,
      lastAutosaveDay: newLastAutosaveDay,
      saveSummaries,
      sessionLog: [
        ...state.sessionLog,
        ...eventLogEntries,
      ],
    });
  },
  advanceByCurrentTimeStep: async () => {
    const state = get();
    await get().advanceBySeconds(state.settings.timeStepSeconds);
  },
  advanceHour: async () => {
    await get().advanceBySeconds(60 * 60);
  },
  advanceHalfDay: async () => {
    await get().advanceBySeconds(SECONDS_PER_DAY / 2);
  },
  advanceDay: async () => {
    await get().advanceBySeconds(SECONDS_PER_DAY);
  },
  saveToSlot: async (slot) => {
    const state = get();
    if (!state.game) {
      return;
    }
    await saveGameToSlot(slot, state.game.serialize());
    const saveSummaries = await listSaveSummaries();
    set({
      saveSummaries,
      sessionLog: [
        ...state.sessionLog,
        {
          id: Date.now(),
          day: state.game.rawDay,
          kind: "system",
          message: `Saved to ${slot}`,
        },
      ],
    });
  },
  loadFromSlot: async (slot) => {
    const state = get();
    const saved = await loadGameFromSlot(slot);
    if (!saved) {
      return;
    }
    const game = GameState.deserialize(typedGameData, saved);
    const saveSummaries = await listSaveSummaries();
    const reportHistory = await loadReportHistoryForSlot(slot);
    set({
      appScreen: "game",
      game,
      currentSlot: slot,
      lastAutosaveDay: game.rawDay,
      reportHistory,
      saveSummaries,
      sessionLog: [
        ...state.sessionLog,
        {
          id: Date.now(),
          day: game.rawDay,
          kind: "system",
          message: `Loaded save slot ${slot}`,
        },
      ],
    });
  },
  deleteFromSlot: async (slot) => {
    const state = get();
    await deleteGameFromSlot(slot);
    await deleteReportHistoryForSlot(slot);
    const saveSummaries = await listSaveSummaries();
    set({
      saveSummaries,
      sessionLog: [
        ...state.sessionLog,
        {
          id: Date.now(),
          day: state.game?.rawDay ?? 0,
          kind: "system",
          message: `Deleted save slot ${slot}`,
        },
      ],
    });
  },
  exportCurrentGame: () => {
    const state = get();
    if (!state.game) {
      return null;
    }
    return exportGameToJson(state.game);
  },
  importCurrentGame: (serialized) => {
    const state = get();
    const game = importGameFromJson(typedGameData, serialized);
    set({
      game,
      currentSlot: null,
      lastAutosaveDay: game.rawDay,
      reportHistory: [],
      sessionLog: [
        ...state.sessionLog,
        {
          id: Date.now(),
          day: game.rawDay,
          kind: "system",
          message: "Imported save JSON",
        },
      ],
    });
    void get().refreshSaveSummaries();
  },
}));