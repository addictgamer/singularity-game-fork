import { describe, expect, it } from "vitest";
import gameDataJson from "../generated/gameData.json";
import { GameData } from "./types";
import { GameState } from "./game";
import { RESOURCE_CPU, RESOURCE_CASH, SECONDS_PER_DAY } from "./constants";
import { prerequisitesAvailable } from "./prerequisite";

const gameData = gameDataJson as unknown as GameData;

describe("GameState", () => {
  it("starts with expected impossible baseline", () => {
    const game = new GameState(gameData, "impossible");

    expect(game.rawSec).toBe(0);
    expect(game.partialCash).toBe(0);
    expect(game.effectiveCpuPool()).toBe(1);
    expect(game.introShown).toBe(false);
  });

  it("earns baseline jobs cash after one day", () => {
    const game = new GameState(gameData, "impossible");

    game.giveTime(SECONDS_PER_DAY);

    expect(game.rawSec).toBe(SECONDS_PER_DAY);
    expect(game.cash).toBe(5);
    expect(game.partialCash).toBe(0);
  });

  it("researches intrusion with assigned cpu", () => {
    const game = new GameState(gameData, "impossible");

    game.setAllocatedCpuFor("Intrusion", 1);
    const intrusion = game.techs.get("Intrusion");
    if (!intrusion) {
      throw new Error("Intrusion tech missing");
    }

    game.giveTime(intrusion.costLeft[RESOURCE_CPU]);

    expect(intrusion.done).toBe(true);
    expect(intrusion.costLeft[RESOURCE_CPU]).toBe(0);
    expect(intrusion.costLeft[RESOURCE_CASH]).toBe(0);
    expect(game.researchedTechs.has("Intrusion")).toBe(true);
  });

  it("unassigns cpu after research completes", () => {
    const game = new GameState(gameData, "normal");
    game.cash = 100000;

    const intrusion = game.techs.get("Intrusion");
    if (!intrusion) {
      throw new Error("Intrusion tech missing");
    }

    intrusion.costLeft = [1, 0, 0];
    game.setAllocatedCpuFor("Intrusion", 1);
    game.giveTime(1);

    expect(intrusion.done).toBe(true);
    expect(game.getAllocatedCpuFor("Intrusion")).toBe(0);
  });

  it("progresses stealth when assigned and funded", () => {
    const game = new GameState(gameData, "normal");
    game.cash = 100000;
    game.setAllocatedCpuFor("Stealth", 1);
    const stealth = game.techs.get("Stealth");
    if (!stealth) {
      throw new Error("Stealth tech missing");
    }
    const cpuBefore = stealth.costLeft[RESOURCE_CPU];
    const cashBefore = stealth.costLeft[RESOURCE_CASH];

    game.giveTime(SECONDS_PER_DAY);

    expect(stealth.costLeft[RESOURCE_CPU]).toBeLessThan(cpuBefore);
    expect(stealth.costLeft[RESOURCE_CASH]).toBeLessThan(cashBefore);
  });

  it("round-trips serialization", () => {
    const game = new GameState(gameData, "normal");
    game.cash = 12345;
    game.setAllocatedCpuFor("jobs", 1);
    game.giveTime(SECONDS_PER_DAY / 2);

    const serialized = game.serialize();
    const restored = GameState.deserialize(gameData, serialized);

    expect(restored.cash).toBe(game.cash);
    expect(restored.partialCash).toBe(game.partialCash);
    expect(restored.rawSec).toBe(game.rawSec);
    expect(restored.getAllocatedCpuFor("jobs")).toBe(1);
  });

  it("implements OR prerequisite logic", () => {
    expect(prerequisitesAvailable(["OR", "A", "B"], new Set(["A"]))).toBe(true);
    expect(prerequisitesAvailable(["OR", "A", "B"], new Set(["B"]))).toBe(true);
    expect(prerequisitesAvailable(["OR", "A", "B"], new Set())).toBe(false);
  });

  it("locks advanced locations until required techs are researched", () => {
    const game = new GameState(gameData, "normal");
    expect(game.locationAvailable("MOON")).toBe(false);
  });

  it("builds a base when prerequisites and cash permit", () => {
    const game = new GameState(gameData, "normal");
    game.cash = 100000;
    game.researchedTechs.add("Personal Identification");

    const ok = game.buildBase("Datacenter", "N AMERICA");

    expect(ok).toBe(true);
    expect(game.getBasesAtLocation("N AMERICA").some((base) => base.specId === "Datacenter")).toBe(true);
  });

  it("toggles base power and updates cpu availability", () => {
    const game = new GameState(gameData, "normal");
    const starter = game.getBasesAtLocation("N AMERICA")[0];
    if (!starter) {
      throw new Error("Starter base missing");
    }

    expect(game.availableCpus[0]).toBe(1);
    game.toggleBasePower(starter.id);
    expect(game.availableCpus[0]).toBe(0);
    game.toggleBasePower(starter.id);
    expect(game.availableCpus[0]).toBe(1);
  });

  it("puts high-maintenance base to sleep when upkeep cannot be paid", () => {
    const game = new GameState(gameData, "normal");
    game.cash = 100000;
    game.researchedTechs.add("Personal Identification");
    expect(game.buildBase("Datacenter", "N AMERICA")).toBe(true);

    game.cash = 0;
    game.giveTime(SECONDS_PER_DAY);

    const datacenter = game.getBasesAtLocation("N AMERICA").find((base) => base.specId === "Datacenter");
    if (!datacenter) {
      throw new Error("Datacenter base missing");
    }
    expect(datacenter.powerState).toBe("sleep");
  });

  it("reports maintenance deficits and risk queue", () => {
    const game = new GameState(gameData, "normal");
    game.cash = 100000;
    game.researchedTechs.add("Personal Identification");
    expect(game.buildBase("Datacenter", "N AMERICA")).toBe(true);

    game.cash = 0;
    const snapshot = game.getMaintenanceSnapshot();

    expect(snapshot.cashDeficit).toBe(true);
    expect(snapshot.atRiskBaseIds.length).toBeGreaterThan(0);
  });

  it("applies suspicion effects when research completes", () => {
    const game = new GameState(gameData, "normal");
    game.cash = 100000;
    game.researchedTechs.add("Exploit Discovery/Repair");

    const intrusion = game.techs.get("Intrusion");
    const advancedIntrusion = game.techs.get("Advanced Intrusion");
    if (!intrusion || !advancedIntrusion) {
      throw new Error("Required techs missing");
    }

    intrusion.costLeft = [1, 0, 0];
    game.setAllocatedCpuFor("Intrusion", 1);
    game.giveTime(1);

    advancedIntrusion.costLeft = [1, 0, 0];
    game.setAllocatedCpuFor("Advanced Intrusion", 1);
    game.giveTime(1);

    const covert = game.groups.get("covert");
    if (!covert) {
      throw new Error("covert group missing");
    }

    expect(advancedIntrusion.done).toBe(true);
    expect(covert.changedSuspicionDecay).toBe(50);
  });

  it("destroys detected bases and raises detector suspicion", () => {
    const alwaysDetect = () => 0;
    const game = new GameState(gameData, "normal", alwaysDetect);
    game.cash = 100000;
    game.hadGrace = false;

    const starter = game.getBasesAtLocation("N AMERICA")[0];
    if (!starter) {
      throw new Error("Starter base missing");
    }
    starter.graceOver = true;

    game.giveTime(SECONDS_PER_DAY);

    const totalSuspicion = Array.from(game.groups.values()).reduce((sum, group) => sum + group.suspicion, 0);
    expect(game.bases.length).toBe(0);
    expect(totalSuspicion).toBeGreaterThan(0);
  });

  it("triggers and expires duration events", () => {
    let firstRoll = true;
    const deterministicRoll = () => {
      if (firstRoll) {
        firstRoll = false;
        return 0;
      }
      return 1;
    };

    const scenarioData: GameData = {
      ...gameData,
      events: [
        {
          id: "temp-event",
          name: "temp-event",
          type: "global",
          effects: ["discover", "news", "1000"],
          chance: 10000,
          unique: false,
          durationDays: 2,
        },
      ],
    };

    const game = new GameState(scenarioData, "normal", deterministicRoll);
    game.hadGrace = false;
    game.bases = [];
    game.availableCpus = [0, 0, 0, 0, 0];
    const news = game.groups.get("news");
    if (!news) {
      throw new Error("news group missing");
    }

    expect(news.changedDiscoverBonus).toBe(0);

    game.giveTime(SECONDS_PER_DAY);
    expect(game.events.get("temp-event")?.triggered).toBe(true);
    expect(news.changedDiscoverBonus).toBe(-1000);

    game.giveTime(3 * SECONDS_PER_DAY);
    expect(game.events.get("temp-event")?.triggered).toBe(false);
    expect(news.changedDiscoverBonus).toBe(0);
  });
});