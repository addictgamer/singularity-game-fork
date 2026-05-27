import Dexie, { Table } from "dexie";
import { SerializedGameState } from "../engine/types";

export interface SavedGameRecord {
  id?: number;
  slot: string;
  updatedAt: string;
  state: SerializedGameState;
}

export interface AppSettings {
  timeStepSeconds: number;
  autosaveEnabled: boolean;
  compactCards: boolean;
  confirmImport: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  timeStepSeconds: 12 * 60 * 60,
  autosaveEnabled: true,
  compactCards: false,
  confirmImport: true,
};

interface SettingsRecord {
  key: "app";
  value: AppSettings;
}

class SingularityWebDatabase extends Dexie {
  public saves!: Table<SavedGameRecord, number>;
  public settings!: Table<SettingsRecord, string>;

  constructor() {
    super("singularity_webapp");
    this.version(1).stores({
      saves: "++id, slot, updatedAt",
    });
    this.version(2).stores({
      saves: "++id, slot, updatedAt",
      settings: "key",
    });
  }
}

export const gameDb = new SingularityWebDatabase();

export async function saveGameToSlot(slot: string, state: SerializedGameState): Promise<void> {
  const existing = await gameDb.saves.where("slot").equals(slot).first();
  const updatedAt = new Date().toISOString();

  if (existing?.id !== undefined) {
    await gameDb.saves.update(existing.id, {
      updatedAt,
      state,
    });
    return;
  }

  await gameDb.saves.add({
    slot,
    updatedAt,
    state,
  });
}

export async function loadGameFromSlot(slot: string): Promise<SerializedGameState | null> {
  const record = await gameDb.saves.where("slot").equals(slot).first();
  return record?.state ?? null;
}

export async function loadAppSettings(): Promise<AppSettings> {
  const record = await gameDb.settings.get("app");
  if (!record) {
    return DEFAULT_APP_SETTINGS;
  }
  return {
    ...DEFAULT_APP_SETTINGS,
    ...record.value,
  };
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  await gameDb.settings.put({
    key: "app",
    value: settings,
  });
}