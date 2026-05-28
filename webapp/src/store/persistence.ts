import Dexie, { Table } from "dexie";
import { SerializedGameState } from "../engine/types";

export interface SavedGameRecord {
  id?: number;
  slot: string;
  updatedAt: string;
  state: SerializedGameState;
}

export interface SaveSummary {
  slot: string;
  updatedAt: string;
  difficultyId: string;
  day: number;
  cash: number;
  baseCount: number;
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

export interface ReportHistoryRecord {
  id?: number;
  slot: string;
  day: number;
  activityByKind: Record<string, number>;
  basesByLocation: Array<{ id: string; name: string; count: number }>;
  suspicionSnapshot: Array<{ id: string; suspicion: number }>;
  activeEventCount: number;
  atRiskBaseCount: number;
  resourceOutlook: { netCash: number; cpuHeadroom: number };
}

class SingularityWebDatabase extends Dexie {
  public saves!: Table<SavedGameRecord, number>;
  public settings!: Table<SettingsRecord, string>;
  public reportHistory!: Table<ReportHistoryRecord, number>;

  constructor() {
    super("singularity_webapp");
    this.version(1).stores({
      saves: "++id, slot, updatedAt",
    });
    this.version(2).stores({
      saves: "++id, slot, updatedAt",
      settings: "key",
    });
    this.version(3).stores({
      saves: "++id, slot, updatedAt",
      settings: "key",
      reportHistory: "++id, [slot+day]",
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

export async function deleteGameFromSlot(slot: string): Promise<void> {
  await gameDb.saves.where("slot").equals(slot).delete();
}

export async function listSaveSummaries(): Promise<SaveSummary[]> {
  const records = await gameDb.saves.toArray();
  return records
    .map((record) => ({
      slot: record.slot,
      updatedAt: record.updatedAt,
      difficultyId: record.state.difficultyId,
      day: Math.floor(record.state.rawSec / (24 * 60 * 60)),
      cash: record.state.cash,
      baseCount: record.state.bases.length,
    }))
    .sort((a, b) => a.slot.localeCompare(b.slot));
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

export async function saveReportHistory(record: ReportHistoryRecord): Promise<void> {
  await gameDb.reportHistory.add(record);
}

export async function loadReportHistoryForSlot(slot: string, days?: number): Promise<ReportHistoryRecord[]> {
  const records = await gameDb.reportHistory.where("slot").equals(slot).toArray();
  if (days !== undefined) {
    return records.slice(-days);
  }
  return records;
}

export async function deleteReportHistoryForSlot(slot: string): Promise<void> {
  await gameDb.reportHistory.where("slot").equals(slot).delete();
}