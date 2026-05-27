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
  deleteGameFromSlot,
  listSaveSummaries,
  loadAppSettings,
  loadGameFromSlot,
  saveAppSettings,
  saveGameToSlot,
} from "./persistence";

interface GameStore {
  availableDifficulties: GameData["difficulties"];
  selectedDifficultyId: string;
  game: GameState | null;
  selectedLocationId: string;
  settings: AppSettings;
  settingsLoaded: boolean;
  lastAutosaveDay: number;
  saveSummaries: SaveSummary[];
  sessionLog: Array<{ id: number; day: number; kind: string; message: string }>;
  setDifficulty: (id: string) => void;
  setSelectedLocation: (id: string) => void;
  initializeSettings: () => Promise<void>;
  refreshSaveSummaries: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  startNewGame: () => void;
  assignCpu: (taskId: string, amount: number) => void;
  buildBaseAtSelectedLocation: (baseId: string) => boolean;
  toggleBasePower: (baseId: string) => boolean;
  availableBuildableBaseIds: () => string[];
  advanceBySeconds: (seconds: number) => Promise<void>;
  advanceByCurrentTimeStep: () => Promise<void>;
  advanceHalfDay: () => Promise<void>;
  advanceDay: () => Promise<void>;
  saveToSlot: (slot: string) => Promise<void>;
  loadFromSlot: (slot: string) => Promise<void>;
  deleteFromSlot: (slot: string) => Promise<void>;
  exportCurrentGame: () => string | null;
  importCurrentGame: (serialized: string) => void;
}

const typedGameData = gameData as unknown as GameData;

export const useGameStore = create<GameStore>((set, get) => ({
  availableDifficulties: typedGameData.difficulties,
  selectedDifficultyId: typedGameData.difficulties[0]?.id ?? "normal",
  selectedLocationId: typedGameData.locations[0]?.id ?? "N AMERICA",
  settings: DEFAULT_APP_SETTINGS,
  settingsLoaded: false,
  lastAutosaveDay: 0,
  saveSummaries: [],
  sessionLog: [],
  game: null,
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
      game,
      lastAutosaveDay: 0,
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
    if (!state.game) {
      return;
    }
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
  },
  buildBaseAtSelectedLocation: (baseId) => {
    const state = get();
    if (!state.game) {
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
    if (!state.game) {
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
    if (!state.game) {
      return;
    }
    const beforeDay = state.game.rawDay;
    state.game.giveTime(seconds);

    let newLastAutosaveDay = state.lastAutosaveDay;
    if (state.settings.autosaveEnabled && state.game.rawDay - state.lastAutosaveDay >= 3) {
      await saveGameToSlot("autosave", state.game.serialize());
      newLastAutosaveDay = state.game.rawDay;
    }

    const saveSummaries = newLastAutosaveDay !== state.lastAutosaveDay
      ? await listSaveSummaries()
      : state.saveSummaries;

    set({
      game: state.game,
      lastAutosaveDay: newLastAutosaveDay,
      saveSummaries,
      sessionLog: [
        ...state.sessionLog,
        {
          id: Date.now(),
          day: state.game.rawDay,
          kind: "time",
          message: `Advanced simulation by ${seconds} seconds`,
        },
      ],
    });
  },
  advanceByCurrentTimeStep: async () => {
    const state = get();
    await get().advanceBySeconds(state.settings.timeStepSeconds);
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
    set({
      game,
      lastAutosaveDay: game.rawDay,
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
      lastAutosaveDay: game.rawDay,
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