export type Cost = [number, number, number];

export interface DifficultyDef {
  id: string;
  name: string;
  startingCash: number;
  startingInterestRate: number;
  laborMultiplier: number;
  discoverMultiplier: number;
  suspicionMultiplier: number;
  baseGraceMultiplier: number;
  gracePeriodCpu: number;
  oldDifficultyValue: number;
  techs: string[];
}

export interface TaskDef {
  id: string;
  name: string;
  type: string;
  value: number;
  prerequisites: string[];
}

export interface TechDef {
  id: string;
  name: string;
  cost: Cost;
  prerequisites: string[];
  danger: number;
  effects: string[];
}

export interface BaseDef {
  id: string;
  name: string;
  size: number;
  forceCpu: string | null;
  allowedRegions: string[];
  detectChance: Record<string, number>;
  cost: Cost;
  prerequisites: string[];
  maintenance: Cost;
}

export interface RegionDef {
  id: string;
  name: string;
  modifiers: Array<Record<string, number>>;
}

export interface LocationDef {
  id: string;
  name: string;
  position: {
    absolute: boolean;
    x: number;
    y: number;
  };
  safety: number;
  regions: string[];
  modifiers: Record<string, number>;
  prerequisites: string[];
}

export interface GroupDef {
  id: string;
  name: string;
  suspicionDecay: number;
}

export interface EventDef {
  id: string;
  name: string;
  type: string;
  effects: string[];
  chance: number;
  unique: boolean;
  durationDays: number | null;
}

export interface GameData {
  meta: {
    source: string;
    generatedBy: string;
  };
  difficulties: DifficultyDef[];
  tasks: TaskDef[];
  techs: TechDef[];
  bases: BaseDef[];
  regions: RegionDef[];
  locations: LocationDef[];
  groups: GroupDef[];
  events: EventDef[];
  internalIds: Record<string, Record<string, string>>;
}

export interface PlayerBase {
  id: string;
  name: string;
  specId: string;
  locationId: string;
  cpuProvided: number;
  powerState: "active" | "sleep" | "offline";
  done: boolean;
  startedAtMin?: number;
  graceOver?: boolean;
}

export interface SerializedTechState {
  id: string;
  done: boolean;
  costLeft: Cost;
}

export interface SerializedGameState {
  version: number;
  createdAt: string;
  difficultyId: string;
  cash: number;
  partialCash: number;
  rawSec: number;
  usedCpu: number;
  introShown: boolean;
  availableCpus: number[];
  bases: PlayerBase[];
  cpuUsage: Record<string, number>;
  researchedTechs: string[];
  techs: SerializedTechState[];
  groups?: Record<
    string,
    {
      suspicion: number;
      changedSuspicionDecay: number;
      changedDiscoverBonus: number;
      changedDiscoverSuspicion: number;
      isActivelyDiscoveringBases: boolean;
    }
  >;
  events?: Record<
    string,
    {
      triggered: boolean;
      triggeredAtSec: number;
    }
  >;
  effects?: {
    interestRate: number;
    income: number;
    laborBonus: number;
    jobBonus: number;
    displayDiscover: string;
    apotheosis: boolean;
    hadGrace: boolean;
  };
}

export interface MaintenanceSnapshot {
  seconds: number;
  activeBaseCount: number;
  cashMaintenance: number;
  cpuMaintenance: number;
  projectedCashAfterMaintenance: number;
  projectedCpuAfterMaintenance: number;
  cashDeficit: boolean;
  cpuDeficit: boolean;
  atRiskBaseIds: string[];
}