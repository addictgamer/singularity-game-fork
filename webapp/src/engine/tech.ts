import { Cost, TechDef } from "./types";
import { prerequisitesAvailable } from "./prerequisite";
import { RESOURCE_CPU, RESOURCE_CASH, RESOURCE_LABOR } from "./constants";

export class TechState {
  public readonly id: string;

  public readonly name: string;

  public readonly danger: number;

  public readonly prerequisites: string[];

  public readonly totalCost: Cost;

  public costLeft: Cost;

  public done: boolean;

  constructor(definition: TechDef) {
    this.id = definition.id;
    this.name = definition.name;
    this.danger = definition.danger;
    this.prerequisites = [...definition.prerequisites];
    this.totalCost = [...definition.cost] as Cost;
    this.totalCost[RESOURCE_CPU] = this.totalCost[RESOURCE_CPU] * 86400;
    this.totalCost[RESOURCE_LABOR] = 0;
    this.costLeft = [...this.totalCost] as Cost;
    this.done = false;
  }

  available(game: { researchedTechs: Set<string> }): boolean {
    return prerequisitesAvailable(this.prerequisites, game.researchedTechs);
  }

  workOn(cashAvailable: number, cpuAvailable: number): { spentCash: number; spentCpu: number; completed: boolean } {
    if (this.done) {
      return { spentCash: 0, spentCpu: 0, completed: true };
    }

    const cpuSpent = Math.min(cpuAvailable, this.costLeft[RESOURCE_CPU]);
    this.costLeft[RESOURCE_CPU] -= cpuSpent;

    const cashNeeded = this.costLeft[RESOURCE_CASH];
    const cashSpent = Math.min(cashAvailable, cashNeeded);
    this.costLeft[RESOURCE_CASH] -= cashSpent;

    this.done =
      this.costLeft[RESOURCE_CPU] <= 0 &&
      this.costLeft[RESOURCE_CASH] <= 0 &&
      this.costLeft[RESOURCE_LABOR] <= 0;

    return {
      spentCash: cashSpent,
      spentCpu: cpuSpent,
      completed: this.done,
    };
  }
}