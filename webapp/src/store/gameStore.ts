import { create } from "zustand";
import gameData from "../generated/gameData.json";
import { GameData } from "../engine/types";
import { GameState } from "../engine/game";
import { SECONDS_PER_DAY } from "../engine/constants";
import { exportGameToJson, importGameFromJson } from "../engine/save";
import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
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
  setDifficulty: (id: string) => void;
  setSelectedLocation: (id: string) => void;
  initializeSettings: () => Promise<void>;
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
  game: null,
  setDifficulty: (id) => set({ selectedDifficultyId: id }),
  setSelectedLocation: (id) => set({ selectedLocationId: id }),
  initializeSettings: async () => {
    const settings = await loadAppSettings();
    set({ settings, settingsLoaded: true });
  },
  updateSettings: async (patch) => {
    const state = get();
    const settings = { ...state.settings, ...patch };
    await saveAppSettings(settings);
    set({ settings });
  },
  startNewGame: () => {
    const state = get();
    set({
      game: new GameState(typedGameData, state.selectedDifficultyId),
      lastAutosaveDay: 0,
    });
  },
  assignCpu: (taskId, amount) => {
    const state = get();
    if (!state.game) {
      return;
    }
    state.game.setAllocatedCpuFor(taskId, amount);
    set({ game: state.game });
  },
  buildBaseAtSelectedLocation: (baseId) => {
    const state = get();
    if (!state.game) {
      return false;
    }
    const built = state.game.buildBase(baseId, state.selectedLocationId);
    set({ game: state.game });
    return built;
  },
  toggleBasePower: (baseId) => {
    const state = get();
    if (!state.game) {
      return false;
    }
    const toggled = state.game.toggleBasePower(baseId);
    set({ game: state.game });
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

    set({ game: state.game, lastAutosaveDay: newLastAutosaveDay });
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
  },
  loadFromSlot: async (slot) => {
    const saved = await loadGameFromSlot(slot);
    if (!saved) {
      return;
    }
    const game = GameState.deserialize(typedGameData, saved);
    set({ game, lastAutosaveDay: game.rawDay });
  },
  exportCurrentGame: () => {
    const state = get();
    if (!state.game) {
      return null;
    }
    return exportGameToJson(state.game);
  },
  importCurrentGame: (serialized) => {
    const game = importGameFromJson(typedGameData, serialized);
    set({ game, lastAutosaveDay: game.rawDay });
  },
}));