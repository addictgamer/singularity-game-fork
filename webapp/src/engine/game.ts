import {
  MAX_CASH,
  RESOURCE_CASH,
  RESOURCE_CPU,
  RESOURCE_LABOR,
  SECONDS_PER_DAY,
} from "./constants";
import {
  BaseDef,
  DifficultyDef,
  EventDef,
  GameData,
  LocationDef,
  MaintenanceSnapshot,
  PlayerBase,
  SerializedGameState,
  SerializedTechState,
  TaskDef,
} from "./types";
import { TechState } from "./tech";
import { prerequisitesAvailable } from "./prerequisite";

function getCurrentJobTask(tasks: TaskDef[], researchedTechs: Set<string>): TaskDef | undefined {
  const jobs = tasks.filter((task) => task.type === "jobs");
  for (let index = jobs.length - 1; index >= 0; index -= 1) {
    if (prerequisitesAvailable(jobs[index].prerequisites, researchedTechs)) {
      return jobs[index];
    }
  }
  return undefined;
}

type RuntimeGroupState = {
  suspicion: number;
  suspicionDecay: number;
  changedSuspicionDecay: number;
  baseDiscoverBonus: number;
  changedDiscoverBonus: number;
  baseDiscoverSuspicion: number;
  changedDiscoverSuspicion: number;
  isActivelyDiscoveringBases: boolean;
};

type RuntimeEventState = {
  triggered: boolean;
  triggeredAtSec: number;
};

export class GameState {
  public static readonly SAVE_VERSION = 2;

  public readonly difficulty: DifficultyDef;

  public readonly tasks: TaskDef[];

  public readonly techs: Map<string, TechState>;

  public readonly techDefs: Map<string, { effects: string[] }>;

  public readonly eventDefs: Map<string, EventDef>;

  public readonly baseDefs: Map<string, BaseDef>;

  public readonly locations: Map<string, LocationDef>;

  public readonly groups: Map<string, RuntimeGroupState>;

  public readonly events: Map<string, RuntimeEventState>;

  public readonly researchedTechs: Set<string>;

  public readonly cpuUsage: Map<string, number>;

  public availableCpus: number[];

  public bases: PlayerBase[];

  public cash: number;

  public partialCash: number;

  public rawSec: number;

  public rawMin: number;

  public rawHour: number;

  public rawDay: number;

  public usedCpu: number;

  public introShown: boolean;

  public interestRate: number;

  public income: number;

  public laborBonus: number;

  public jobBonus: number;

  public displayDiscover: string;

  public apotheosis: boolean;

  public hadGrace: boolean;

  private baseCounter: number;

  private readonly randomFloat: () => number;

  constructor(data: GameData, difficultyId: string, randomFloat?: () => number) {
    const difficulty = data.difficulties.find((entry) => entry.id === difficultyId);
    if (!difficulty) {
      throw new Error(`Unknown difficulty: ${difficultyId}`);
    }

    this.difficulty = difficulty;
    this.tasks = data.tasks;
    this.cash = difficulty.startingCash;
    this.partialCash = 0;
    this.rawSec = 0;
    this.rawMin = 0;
    this.rawHour = 0;
    this.rawDay = 0;
    this.usedCpu = 0;
    this.introShown = false;
    this.availableCpus = [0, 0, 0, 0, 0];
    this.bases = [];
    this.baseCounter = 1;
    this.randomFloat = randomFloat ?? Math.random;

    this.interestRate = difficulty.startingInterestRate;
    this.income = 0;
    this.laborBonus = difficulty.laborMultiplier;
    this.jobBonus = 10000;
    this.displayDiscover = "none";
    this.apotheosis = false;
    this.hadGrace = true;

    this.cpuUsage = new Map<string, number>();
    this.techs = new Map(data.techs.map((definition) => [definition.id, new TechState(definition)]));
    this.techDefs = new Map(data.techs.map((definition) => [definition.id, { effects: [...definition.effects] }]));
    this.baseDefs = new Map(data.bases.map((definition) => [definition.id, definition]));
    this.locations = new Map(data.locations.map((definition) => [definition.id, definition]));
    this.groups = new Map(
      data.groups.map((group) => [
        group.id,
        {
          suspicion: 0,
          suspicionDecay: group.suspicionDecay,
          changedSuspicionDecay: 0,
          baseDiscoverBonus: difficulty.discoverMultiplier,
          changedDiscoverBonus: 0,
          baseDiscoverSuspicion: difficulty.suspicionMultiplier,
          changedDiscoverSuspicion: 0,
          isActivelyDiscoveringBases: true,
        },
      ])
    );
    this.eventDefs = new Map((data.events ?? []).map((eventDef) => [eventDef.id, eventDef]));
    this.events = new Map((data.events ?? []).map((eventDef) => [eventDef.id, { triggered: false, triggeredAtSec: -1 }]));
    this.researchedTechs = new Set<string>(difficulty.techs);

    for (const techId of this.researchedTechs) {
      const tech = this.techs.get(techId);
      if (tech) {
        tech.done = true;
        tech.costLeft = [0, 0, 0];
      }
      this.applyTechEffects(techId);
    }

    this.createStartingBase();
  }

  private parseEffectInt(effectStack: string[], index: number): number {
    return Number.parseInt(effectStack[index] ?? "0", 10) || 0;
  }

  private getGroupSuspicionDecay(group: RuntimeGroupState): number {
    return Math.max(1, group.suspicionDecay + group.changedSuspicionDecay);
  }

  private getGroupDiscoverBonus(group: RuntimeGroupState): number {
    if (!group.isActivelyDiscoveringBases) {
      return 0;
    }
    return Math.max(1, group.baseDiscoverBonus + group.changedDiscoverBonus);
  }

  private getGroupDiscoverSuspicion(group: RuntimeGroupState): number {
    return Math.max(
      1,
      Math.floor((1000 * (group.baseDiscoverSuspicion + group.changedDiscoverSuspicion)) / 10000)
    );
  }

  private getGroupDecayRate(group: RuntimeGroupState): number {
    return Math.max(1, Math.floor((group.suspicion * this.getGroupSuspicionDecay(group)) / 10000));
  }

  private alterGroupSuspicion(groupId: string, change: number): void {
    const group = this.groups.get(groupId);
    if (!group) {
      return;
    }
    group.suspicion = Math.max(0, group.suspicion + change);
  }

  private applyEffectStack(effectStack: string[], options?: { undo?: boolean; loadingSavegame?: boolean }): void {
    const undo = options?.undo ?? false;
    const loadingSavegame = options?.loadingSavegame ?? false;
    const effectModifier = undo ? -1 : 1;

    for (let index = 0; index < effectStack.length; index += 1) {
      const action = effectStack[index];

      if (action === "interest") {
        this.interestRate += effectModifier * this.parseEffectInt(effectStack, index + 1);
        index += 1;
      } else if (action === "income") {
        this.income += effectModifier * this.parseEffectInt(effectStack, index + 1);
        index += 1;
      } else if (action === "cost_labor") {
        this.laborBonus -= effectModifier * this.parseEffectInt(effectStack, index + 1);
        index += 1;
      } else if (action === "job_profit") {
        this.jobBonus += effectModifier * this.parseEffectInt(effectStack, index + 1);
        index += 1;
      } else if (action === "display_discover") {
        if (!undo) {
          this.displayDiscover = effectStack[index + 1] ?? this.displayDiscover;
        }
        index += 1;
      } else if (action === "endgame") {
        if (!undo) {
          this.apotheosis = true;
          this.hadGrace = true;
          for (const group of this.groups.values()) {
            group.isActivelyDiscoveringBases = false;
          }
        }
      } else if (action === "suspicion") {
        const who = effectStack[index + 1] ?? "";
        const value = effectModifier * this.parseEffectInt(effectStack, index + 2);
        index += 2;

        const group = this.groups.get(who);
        if (group) {
          group.changedSuspicionDecay += value;
        } else if (who === "onetime") {
          if (!undo && !loadingSavegame) {
            for (const runtimeGroup of this.groups.values()) {
              runtimeGroup.suspicion = Math.max(0, runtimeGroup.suspicion - value);
            }
          }
        }
      } else if (action === "discover") {
        const who = effectStack[index + 1] ?? "";
        const value = effectModifier * this.parseEffectInt(effectStack, index + 2);
        index += 2;

        const group = this.groups.get(who);
        if (group) {
          group.changedDiscoverBonus -= value;
        }
      }
    }
  }

  private applyTechEffects(techId: string, loadingSavegame = false): void {
    const definition = this.techDefs.get(techId);
    if (!definition || definition.effects.length === 0) {
      return;
    }
    this.applyEffectStack(definition.effects, { loadingSavegame });
  }

  private applyEventEffects(eventId: string, options?: { undo?: boolean; loadingSavegame?: boolean }): void {
    const definition = this.eventDefs.get(eventId);
    if (!definition || definition.effects.length === 0) {
      return;
    }
    this.applyEffectStack(definition.effects, options);
  }

  private maybeTriggerEvents(seconds: number): void {
    for (const [eventId, definition] of this.eventDefs.entries()) {
      const state = this.events.get(eventId);
      if (!state) {
        continue;
      }
      if (state.triggered) {
        continue;
      }
      if (this.rollInterval(definition.chance / 10000, seconds)) {
        state.triggered = true;
        state.triggeredAtSec = this.rawSec;
        this.applyEventEffects(eventId);
        break;
      }
    }
  }

  private expireEvents(): void {
    for (const [eventId, definition] of this.eventDefs.entries()) {
      if (definition.durationDays === null) {
        continue;
      }
      const state = this.events.get(eventId);
      if (!state || !state.triggered) {
        continue;
      }
      const expireAt = state.triggeredAtSec + definition.durationDays * SECONDS_PER_DAY;
      if (this.rawSec > expireAt) {
        this.applyEventEffects(eventId, { undo: true });
        state.triggered = false;
        state.triggeredAtSec = -1;
      }
    }
  }

  private rollInterval(chancePerDay: number, seconds: number): boolean {
    const portionOfDay = seconds / SECONDS_PER_DAY;
    const intervalRate = chancePerDay * portionOfDay;
    const chance = 1 - Math.exp(-intervalRate);
    return this.randomFloat() < chance;
  }

  private inGracePeriod(): boolean {
    if (this.apotheosis) {
      return true;
    }
    if (!this.hadGrace) {
      return false;
    }
    if (this.rawDay >= 23) {
      return false;
    }
    if (this.difficulty.gracePeriodCpu < 0) {
      return true;
    }
    return this.usedCpu <= this.difficulty.gracePeriodCpu * SECONDS_PER_DAY;
  }

  private baseHasGrace(base: PlayerBase, definition: BaseDef): boolean {
    if (base.graceOver) {
      return false;
    }
    const startedAtMin = base.startedAtMin ?? 0;
    const age = this.rawMin - startedAtMin;
    const graceTime = (definition.cost[RESOURCE_LABOR] * this.difficulty.baseGraceMultiplier) / 10000;
    if (age > graceTime) {
      base.graceOver = true;
      return false;
    }
    return true;
  }

  private calcBaseDiscoveryChance(base: PlayerBase, definition: BaseDef): Record<string, number> {
    const result: Record<string, number> = {};
    const location = this.locations.get(base.locationId);
    const stealth = location?.modifiers.stealth ?? 1;
    const detectModifier = stealth > 0 ? 1 / stealth : 1;

    for (const [groupId, rawChance] of Object.entries(definition.detectChance)) {
      const group = this.groups.get(groupId);
      if (!group) {
        continue;
      }
      let chance = rawChance;
      chance = Math.floor((chance * (10000 + group.suspicion)) / 10000);
      chance = Math.floor((chance * this.getGroupDiscoverBonus(group)) / 10000);
      chance = Math.floor(chance * detectModifier);
      result[groupId] = Math.max(0, chance);
    }

    return result;
  }

  private destroyBase(baseId: string, reason: "maint" | "detected", detectedByGroupId?: string): void {
    const index = this.bases.findIndex((base) => base.id === baseId);
    if (index < 0) {
      return;
    }
    if (reason === "detected" && detectedByGroupId) {
      const group = this.groups.get(detectedByGroupId);
      if (group) {
        this.alterGroupSuspicion(detectedByGroupId, this.getGroupDiscoverSuspicion(group));
      }
    }
    this.bases.splice(index, 1);
    this.recalculateCpuFromBases();
  }

  private resolveBaseRisks(seconds: number, unpaidCpuMaintenance: number, unpaidCashMaintenance: number): void {
    const grace = this.inGracePeriod();

    for (const base of [...this.bases]) {
      const definition = this.getBaseDef(base);
      if (!definition || !base.done) {
        continue;
      }

      let dead = false;
      if (unpaidCpuMaintenance > 0 && definition.maintenance[RESOURCE_CPU] > 0) {
        if (this.rollInterval(0.015, seconds)) {
          this.destroyBase(base.id, "maint");
          dead = true;
        }
      }

      if (!dead && unpaidCashMaintenance > 0 && definition.maintenance[RESOURCE_CASH] > 0) {
        if (this.rollInterval(0.015, seconds)) {
          this.destroyBase(base.id, "maint");
          dead = true;
        }
      }

      if (dead || grace || this.baseHasGrace(base, definition)) {
        continue;
      }

      const detectChance = this.calcBaseDiscoveryChance(base, definition);
      for (const [groupId, groupChance] of Object.entries(detectChance)) {
        if (this.rollInterval(groupChance / 10000, seconds)) {
          this.destroyBase(base.id, "detected", groupId);
          break;
        }
      }
    }
  }

  private createStartingBase(): void {
    if (!this.locations.has("N AMERICA") || !this.baseDefs.has("Stolen Computer Time")) {
      this.availableCpus[0] = 1;
      return;
    }

    this.bases.push({
      id: `base-${this.baseCounter}`,
      name: "Initial Access",
      specId: "Stolen Computer Time",
      locationId: "N AMERICA",
      cpuProvided: 1,
      powerState: "active",
      done: true,
      startedAtMin: this.rawMin,
      graceOver: false,
    });
    this.baseCounter += 1;
    this.recalculateCpuFromBases();
  }

  private recalculateCpuFromBases(): void {
    const cpu = this.bases.reduce(
      (total, base) => total + (base.done && base.powerState === "active" ? base.cpuProvided : 0),
      0
    );
    this.availableCpus[0] = Math.max(0, cpu);
  }

  private getBaseDef(base: PlayerBase): BaseDef | undefined {
    return this.baseDefs.get(base.specId);
  }

  private getActiveBases(): PlayerBase[] {
    return this.bases.filter((base) => base.done && base.powerState === "active");
  }

  private applyMaintenance(cashAvailable: number, cpuPool: number, seconds: number): {
    cashAvailable: number;
    cpuPool: number;
    unpaidCashMaintenance: number;
    unpaidCpuMaintenance: number;
  } {
    let remainingCash = cashAvailable;
    let remainingCpuPool = cpuPool;

    const activeBases = this.getActiveBases();
    const cashMaintenance = activeBases.reduce((sum, base) => {
      const def = this.getBaseDef(base);
      if (!def) {
        return sum;
      }
      return sum + Math.floor((def.maintenance[RESOURCE_CASH] * seconds) / SECONDS_PER_DAY);
    }, 0);
    const cpuMaintenance = activeBases.reduce((sum, base) => {
      const def = this.getBaseDef(base);
      if (!def) {
        return sum;
      }
      return sum + def.maintenance[RESOURCE_CPU] * seconds;
    }, 0);

    remainingCash -= cashMaintenance;
    remainingCpuPool -= cpuMaintenance;

    if (remainingCash >= 0 && remainingCpuPool >= 0) {
      return {
        cashAvailable: remainingCash,
        cpuPool: remainingCpuPool,
        unpaidCashMaintenance: 0,
        unpaidCpuMaintenance: 0,
      };
    }

    const candidateBases = [...activeBases].sort((a, b) => {
      const defA = this.getBaseDef(a);
      const defB = this.getBaseDef(b);
      const scoreA = (defA?.maintenance[RESOURCE_CASH] ?? 0) + (defA?.maintenance[RESOURCE_CPU] ?? 0);
      const scoreB = (defB?.maintenance[RESOURCE_CASH] ?? 0) + (defB?.maintenance[RESOURCE_CPU] ?? 0);
      return scoreB - scoreA;
    });

    for (const base of candidateBases) {
      if (remainingCash >= 0 && remainingCpuPool >= 0) {
        break;
      }
      if (this.getActiveBases().length <= 1) {
        break;
      }
      base.powerState = "sleep";
      const def = this.getBaseDef(base);
      if (!def) {
        continue;
      }
      remainingCash += Math.floor((def.maintenance[RESOURCE_CASH] * seconds) / SECONDS_PER_DAY);
      remainingCpuPool += def.maintenance[RESOURCE_CPU] * seconds;
    }

    this.recalculateCpuFromBases();

    const unpaidCashMaintenance = Math.max(0, -remainingCash);
    const unpaidCpuMaintenance = Math.max(0, -remainingCpuPool);

    return {
      cashAvailable: Math.max(0, remainingCash),
      cpuPool: Math.max(0, remainingCpuPool),
      unpaidCashMaintenance,
      unpaidCpuMaintenance,
    };
  }

  getMaintenanceSnapshot(seconds = SECONDS_PER_DAY): MaintenanceSnapshot {
    const activeBases = this.getActiveBases();
    const cashMaintenance = activeBases.reduce((sum, base) => {
      const def = this.getBaseDef(base);
      if (!def) {
        return sum;
      }
      return sum + Math.floor((def.maintenance[RESOURCE_CASH] * seconds) / SECONDS_PER_DAY);
    }, 0);
    const cpuMaintenance = activeBases.reduce((sum, base) => {
      const def = this.getBaseDef(base);
      if (!def) {
        return sum;
      }
      return sum + def.maintenance[RESOURCE_CPU] * seconds;
    }, 0);

    const projectedCpuPool = Math.max(0, this.effectiveCpuPool()) * seconds;
    const projectedCashAfterMaintenance = this.cash - cashMaintenance;
    const projectedCpuAfterMaintenance = projectedCpuPool - cpuMaintenance;
    const cashDeficit = projectedCashAfterMaintenance < 0;
    const cpuDeficit = projectedCpuAfterMaintenance < 0;

    const atRiskBaseIds = [...activeBases]
      .sort((a, b) => {
        const defA = this.getBaseDef(a);
        const defB = this.getBaseDef(b);
        const scoreA = (defA?.maintenance[RESOURCE_CASH] ?? 0) + (defA?.maintenance[RESOURCE_CPU] ?? 0);
        const scoreB = (defB?.maintenance[RESOURCE_CASH] ?? 0) + (defB?.maintenance[RESOURCE_CPU] ?? 0);
        return scoreB - scoreA;
      })
      .map((base) => base.id);

    return {
      seconds,
      activeBaseCount: activeBases.length,
      cashMaintenance,
      cpuMaintenance,
      projectedCashAfterMaintenance,
      projectedCpuAfterMaintenance,
      cashDeficit,
      cpuDeficit,
      atRiskBaseIds,
    };
  }

  locationAvailable(locationId: string): boolean {
    const location = this.locations.get(locationId);
    if (!location) {
      return false;
    }
    return prerequisitesAvailable(location.prerequisites, this.researchedTechs);
  }

  getBasesAtLocation(locationId: string): PlayerBase[] {
    return this.bases.filter((base) => base.locationId === locationId);
  }

  canBuildBaseAt(baseId: string, locationId: string): boolean {
    const baseDef = this.baseDefs.get(baseId);
    const location = this.locations.get(locationId);
    if (!baseDef || !location) {
      return false;
    }
    if (!this.locationAvailable(locationId)) {
      return false;
    }
    if (!prerequisitesAvailable(baseDef.prerequisites, this.researchedTechs)) {
      return false;
    }

    const allowedRegions = new Set(baseDef.allowedRegions);
    if (
      allowedRegions.size > 0 &&
      !allowedRegions.has(location.id) &&
      !location.regions.some((regionId) => allowedRegions.has(regionId))
    ) {
      return false;
    }

    return this.cash >= baseDef.cost[RESOURCE_CASH];
  }

  buildBase(baseId: string, locationId: string): boolean {
    const baseDef = this.baseDefs.get(baseId);
    if (!baseDef || !this.canBuildBaseAt(baseId, locationId)) {
      return false;
    }

    this.cash -= baseDef.cost[RESOURCE_CASH];
    const cpuProvided = baseDef.forceCpu ? Math.max(1, baseDef.size) : 0;

    this.bases.push({
      id: `base-${this.baseCounter}`,
      name: `${baseDef.name} ${this.baseCounter}`,
      specId: baseDef.id,
      locationId,
      cpuProvided,
      powerState: "active",
      done: true,
      startedAtMin: this.rawMin,
      graceOver: false,
    });
    this.baseCounter += 1;
    this.recalculateCpuFromBases();
    return true;
  }

  toggleBasePower(baseId: string): boolean {
    const base = this.bases.find((entry) => entry.id === baseId);
    if (!base || !base.done) {
      return false;
    }

    if (base.powerState === "active") {
      base.powerState = "sleep";
    } else if (base.powerState === "sleep") {
      base.powerState = "active";
    } else {
      base.powerState = "active";
    }

    this.recalculateCpuFromBases();
    return true;
  }

  effectiveCpuPool(): number {
    let effective = this.availableCpus[0];
    for (const [taskId, assignedCpu] of this.cpuUsage) {
      if (taskId === "cpu_pool") {
        continue;
      }
      effective -= assignedCpu;
    }
    return effective;
  }

  setAllocatedCpuFor(taskId: string, amount: number): void {
    if (amount < 0) {
      throw new Error(`Cannot assign negative cpu to ${taskId}`);
    }

    if (taskId !== "jobs" && taskId !== "cpu_pool") {
      const tech = this.techs.get(taskId);
      if (!tech) {
        throw new Error(`Unknown task ${taskId}`);
      }
      if (!tech.available(this)) {
        throw new Error(`Tech ${taskId} is not available`);
      }
    }

    this.cpuUsage.set(taskId, amount);
  }

  getAllocatedCpuFor(taskId: string): number {
    return this.cpuUsage.get(taskId) ?? 0;
  }

  getInterest(): number {
    return Math.floor((this.interestRate * this.cash) / 10000);
  }

  private doInterest(secs: number): void {
    const rawCash = this.partialCash + this.getInterest() * secs;
    const earned = Math.floor(rawCash / SECONDS_PER_DAY);
    this.partialCash = rawCash % SECONDS_PER_DAY;
    this.cash += earned;
  }

  private doIncome(secs: number): void {
    const rawCash = this.partialCash + this.income * secs;
    const earned = Math.floor(rawCash / SECONDS_PER_DAY);
    this.partialCash = rawCash % SECONDS_PER_DAY;
    this.cash += earned;
  }

  private getJobValue(): number {
    const current = getCurrentJobTask(this.tasks, this.researchedTechs);
    if (!current) {
      return 0;
    }
    return Math.floor((current.value * this.jobBonus) / 10000);
  }

  private doJobs(cpuSeconds: number): void {
    const rawCash = this.partialCash + this.getJobValue() * cpuSeconds;
    const earned = Math.floor(rawCash / SECONDS_PER_DAY);
    this.partialCash = rawCash % SECONDS_PER_DAY;
    this.cash += earned;
  }

  private processDailyTransitions(daysPassed: number): void {
    for (let day = 0; day < daysPassed; day += 1) {
      for (const group of this.groups.values()) {
        group.suspicion = Math.max(0, group.suspicion - this.getGroupDecayRate(group));
      }
      this.expireEvents();
    }
  }

  private updateTimes(): void {
    this.rawMin = Math.floor(this.rawSec / 60);
    this.rawHour = Math.floor(this.rawMin / 60);
    this.rawDay = Math.floor(this.rawHour / 24);
  }

  giveTime(seconds: number): void {
    if (seconds <= 0) {
      if (seconds < 0) {
        throw new Error("giveTime cannot go backwards");
      }
      return;
    }

    const previousDay = this.rawDay;

    this.rawSec += seconds;
    this.updateTimes();

    this.doInterest(seconds);
    this.doIncome(seconds);

    const jobsCpu = this.getAllocatedCpuFor("jobs") * seconds;
    if (jobsCpu > 0) {
      this.doJobs(jobsCpu);
    }

    let cpuPool = Math.max(0, this.availableCpus[0]) * seconds;

    for (const [taskId, assignedCpu] of this.cpuUsage) {
      if (taskId === "jobs") {
        cpuPool -= assignedCpu * seconds;
        continue;
      }
      if (taskId === "cpu_pool") {
        continue;
      }
      cpuPool -= assignedCpu * seconds;
      const tech = this.techs.get(taskId);
      if (!tech || tech.done) {
        continue;
      }
      const workBudget = Math.max(0, assignedCpu * seconds);
      const result = tech.workOn(this.cash, workBudget);
      this.cash -= result.spentCash;
      if (result.completed) {
        this.researchedTechs.add(taskId);
        this.applyTechEffects(taskId);
      }
    }

    const maintenanceResult = this.applyMaintenance(this.cash, cpuPool, seconds);
    this.cash = maintenanceResult.cashAvailable;
    cpuPool = maintenanceResult.cpuPool;

    if (cpuPool > 0) {
      this.doJobs(cpuPool);
    }

    this.usedCpu += this.availableCpus[0] * seconds;

    const currentlyInGrace = this.inGracePeriod();
    if (this.hadGrace && !currentlyInGrace) {
      this.hadGrace = false;
    }

    this.resolveBaseRisks(
      seconds,
      maintenanceResult.unpaidCpuMaintenance,
      maintenanceResult.unpaidCashMaintenance
    );

    if (!this.inGracePeriod()) {
      this.maybeTriggerEvents(seconds);
    }

    const daysPassed = this.rawDay - previousDay;
    if (daysPassed > 0) {
      this.processDailyTransitions(daysPassed);
    }

    this.cash = Math.min(this.cash, MAX_CASH);
  }

  computeFutureResourceFlow(secondsForwarded = SECONDS_PER_DAY): {
    jobs: number;
    interest: number;
  } {
    const projected = new GameState(
      {
        meta: { source: "projected", generatedBy: "runtime" },
        difficulties: [this.difficulty],
        tasks: this.tasks,
        techs: Array.from(this.techs.values()).map((tech) => ({
          id: tech.id,
          name: tech.name,
          cost: [
            Math.floor(tech.totalCost[RESOURCE_CPU] / SECONDS_PER_DAY),
            tech.totalCost[RESOURCE_CASH],
            0,
          ],
          prerequisites: [...tech.prerequisites],
          danger: tech.danger,
          effects: [...(this.techDefs.get(tech.id)?.effects ?? [])],
        })),
        bases: Array.from(this.baseDefs.values()),
        regions: [],
        locations: Array.from(this.locations.values()),
        groups: Array.from(this.groups.entries()).map(([id, group]) => ({
          id,
          name: id,
          suspicionDecay: group.suspicionDecay,
        })),
        events: Array.from(this.eventDefs.values()),
        internalIds: {},
      },
      this.difficulty.id,
      this.randomFloat
    );

    projected.cash = this.cash;
    projected.partialCash = this.partialCash;
    projected.availableCpus = [...this.availableCpus];
    projected.bases = this.bases.map((base) => ({
      ...base,
      powerState: base.powerState ?? "active",
      startedAtMin: base.startedAtMin ?? this.rawMin,
      graceOver: base.graceOver ?? false,
    }));
    projected.baseCounter = this.baseCounter;

    projected.interestRate = this.interestRate;
    projected.income = this.income;
    projected.laborBonus = this.laborBonus;
    projected.jobBonus = this.jobBonus;
    projected.displayDiscover = this.displayDiscover;
    projected.apotheosis = this.apotheosis;
    projected.hadGrace = this.hadGrace;

    projected.cpuUsage.clear();
    for (const [taskId, amount] of this.cpuUsage) {
      projected.cpuUsage.set(taskId, amount);
    }

    for (const [groupId, group] of this.groups) {
      const target = projected.groups.get(groupId);
      if (!target) {
        continue;
      }
      target.suspicion = group.suspicion;
      target.changedSuspicionDecay = group.changedSuspicionDecay;
      target.changedDiscoverBonus = group.changedDiscoverBonus;
      target.changedDiscoverSuspicion = group.changedDiscoverSuspicion;
      target.isActivelyDiscoveringBases = group.isActivelyDiscoveringBases;
    }

    for (const [eventId, state] of this.events) {
      const target = projected.events.get(eventId);
      if (!target) {
        continue;
      }
      target.triggered = state.triggered;
      target.triggeredAtSec = state.triggeredAtSec;
    }

    for (const [techId, tech] of this.techs) {
      const target = projected.techs.get(techId);
      if (target) {
        target.done = tech.done;
        target.costLeft = [...tech.costLeft] as [number, number, number];
      }
    }
    projected.researchedTechs.clear();
    for (const techId of this.researchedTechs) {
      projected.researchedTechs.add(techId);
    }

    const cashBefore = projected.cash;
    projected.giveTime(secondsForwarded);
    return {
      jobs: projected.cash - cashBefore,
      interest: this.getInterest(),
    };
  }

  serialize(): SerializedGameState {
    const serializedTechs: SerializedTechState[] = Array.from(this.techs.values()).map((tech) => ({
      id: tech.id,
      done: tech.done,
      costLeft: [...tech.costLeft] as [number, number, number],
    }));

    const cpuUsage: Record<string, number> = {};
    for (const [taskId, amount] of this.cpuUsage) {
      cpuUsage[taskId] = amount;
    }

    const groups: NonNullable<SerializedGameState["groups"]> = {};
    for (const [groupId, group] of this.groups) {
      groups[groupId] = {
        suspicion: group.suspicion,
        changedSuspicionDecay: group.changedSuspicionDecay,
        changedDiscoverBonus: group.changedDiscoverBonus,
        changedDiscoverSuspicion: group.changedDiscoverSuspicion,
        isActivelyDiscoveringBases: group.isActivelyDiscoveringBases,
      };
    }

    const events: NonNullable<SerializedGameState["events"]> = {};
    for (const [eventId, event] of this.events) {
      events[eventId] = {
        triggered: event.triggered,
        triggeredAtSec: event.triggeredAtSec,
      };
    }

    return {
      version: GameState.SAVE_VERSION,
      createdAt: new Date().toISOString(),
      difficultyId: this.difficulty.id,
      cash: this.cash,
      partialCash: this.partialCash,
      rawSec: this.rawSec,
      usedCpu: this.usedCpu,
      introShown: this.introShown,
      availableCpus: [...this.availableCpus],
      bases: this.bases.map((base) => ({
        ...base,
        powerState: base.powerState ?? "active",
        startedAtMin: base.startedAtMin ?? this.rawMin,
        graceOver: base.graceOver ?? false,
      })),
      cpuUsage,
      researchedTechs: Array.from(this.researchedTechs),
      techs: serializedTechs,
      groups,
      events,
      effects: {
        interestRate: this.interestRate,
        income: this.income,
        laborBonus: this.laborBonus,
        jobBonus: this.jobBonus,
        displayDiscover: this.displayDiscover,
        apotheosis: this.apotheosis,
        hadGrace: this.hadGrace,
      },
    };
  }

  static deserialize(data: GameData, saved: SerializedGameState, randomFloat?: () => number): GameState {
    if (saved.version !== 1 && saved.version !== GameState.SAVE_VERSION) {
      throw new Error(`Unsupported save version ${saved.version}`);
    }

    const game = new GameState(data, saved.difficultyId, randomFloat);
    game.cash = saved.cash;
    game.partialCash = saved.partialCash;
    game.rawSec = saved.rawSec;
    game.usedCpu = saved.usedCpu;
    game.introShown = saved.introShown;
    game.availableCpus = [...saved.availableCpus];
    game.bases = saved.bases.map((base) => ({
      ...base,
      powerState: base.powerState ?? "active",
      startedAtMin: base.startedAtMin ?? 0,
      graceOver: base.graceOver ?? false,
    }));
    game.baseCounter =
      game.bases
        .map((base) => {
          const parts = base.id.split("-");
          const suffix = parts.length > 1 ? parts[1] : undefined;
          return suffix ? Number.parseInt(suffix, 10) : 0;
        })
        .reduce((max, value) => Math.max(max, Number.isFinite(value) ? value : 0), 0) + 1;
    game.updateTimes();

    game.cpuUsage.clear();
    for (const [taskId, amount] of Object.entries(saved.cpuUsage)) {
      game.cpuUsage.set(taskId, amount);
    }

    game.researchedTechs.clear();
    for (const techId of saved.researchedTechs) {
      game.researchedTechs.add(techId);
    }

    for (const serializedTech of saved.techs) {
      const tech = game.techs.get(serializedTech.id);
      if (!tech) {
        continue;
      }
      tech.done = serializedTech.done;
      tech.costLeft = [...serializedTech.costLeft] as [number, number, number];
    }

    if (saved.effects) {
      game.interestRate = saved.effects.interestRate;
      game.income = saved.effects.income;
      game.laborBonus = saved.effects.laborBonus;
      game.jobBonus = saved.effects.jobBonus;
      game.displayDiscover = saved.effects.displayDiscover;
      game.apotheosis = saved.effects.apotheosis;
      game.hadGrace = saved.effects.hadGrace;
    } else {
      game.interestRate = game.difficulty.startingInterestRate;
      game.income = 0;
      game.laborBonus = game.difficulty.laborMultiplier;
      game.jobBonus = 10000;
      game.displayDiscover = "none";
      game.apotheosis = false;
      game.hadGrace = true;
      for (const techId of game.researchedTechs) {
        game.applyTechEffects(techId, true);
      }
    }

    for (const [groupId, group] of game.groups) {
      const savedGroup = saved.groups?.[groupId];
      if (!savedGroup) {
        continue;
      }
      group.suspicion = savedGroup.suspicion;
      group.changedSuspicionDecay = savedGroup.changedSuspicionDecay;
      group.changedDiscoverBonus = savedGroup.changedDiscoverBonus;
      group.changedDiscoverSuspicion = savedGroup.changedDiscoverSuspicion;
      group.isActivelyDiscoveringBases = savedGroup.isActivelyDiscoveringBases;
    }

    if (saved.events) {
      for (const [eventId, state] of Object.entries(saved.events)) {
        const event = game.events.get(eventId);
        if (!event) {
          continue;
        }
        event.triggered = state.triggered;
        event.triggeredAtSec = state.triggeredAtSec;
      }
    }

    game.recalculateCpuFromBases();
    return game;
  }
}
