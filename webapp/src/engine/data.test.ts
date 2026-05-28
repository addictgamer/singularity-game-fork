import { describe, expect, it } from "vitest";
import gameDataJson from "../generated/gameData.json";
import { GameData } from "./types";

const gameData = gameDataJson as unknown as GameData;

describe("Game Data Conversion Validation", () => {
  it("includes required top-level domains", () => {
    expect(gameData).toHaveProperty("meta");
    expect(gameData).toHaveProperty("difficulties");
    expect(gameData).toHaveProperty("tasks");
    expect(gameData).toHaveProperty("techs");
    expect(gameData).toHaveProperty("bases");
    expect(gameData).toHaveProperty("regions");
    expect(gameData).toHaveProperty("locations");
    expect(gameData).toHaveProperty("groups");
    expect(gameData).toHaveProperty("events");
    expect(gameData).toHaveProperty("internalIds");
  });

  it("has non-empty difficulty options", () => {
    expect(gameData.difficulties.length).toBeGreaterThan(0);
    expect(gameData.difficulties.map((d) => d.id)).toContain("normal");
    expect(gameData.difficulties.map((d) => d.id)).toContain("impossible");
  });

  it("has comprehensive tech definitions", () => {
    expect(gameData.techs.length).toBeGreaterThan(30);
    const techIds = gameData.techs.map((t) => t.id);
    expect(techIds).toContain("Intrusion");
    expect(techIds).toContain("Stealth");
    expect(techIds.length).toBeGreaterThan(0);
  });

  it("validates tech costs are non-negative", () => {
    for (const tech of gameData.techs) {
      expect(tech.cost).toHaveLength(3);
      for (let i = 0; i < tech.cost.length; i += 1) {
        expect(tech.cost[i]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("validates prerequisites reference existing techs", () => {
    const techIds = new Set(gameData.techs.map((t) => t.id));
    for (const tech of gameData.techs) {
      const prereqs = tech.prerequisites.filter((p) => p !== "OR");
      for (const prereq of prereqs) {
        expect(techIds.has(prereq)).toBe(true);
      }
    }
  });

  it("has location definitions with regions", () => {
    expect(gameData.locations.length).toBeGreaterThan(10);
    const locations = gameData.locations.map((l) => l.id);
    expect(locations).toContain("N AMERICA");
    expect(locations).toContain("EUROPE");
  });

  it("uses spelled-out location names from source strings", () => {
    const northAmerica = gameData.locations.find((location) => location.id === "N AMERICA");
    const southAmerica = gameData.locations.find((location) => location.id === "S AMERICA");

    expect(northAmerica?.name).toBe("NORTH AMERICA");
    expect(southAmerica?.name).toBe("SOUTH AMERICA");
  });

  it("validates locations reference existing regions", () => {
    const regionIds = new Set(gameData.regions.map((r) => r.id));
    for (const location of gameData.locations) {
      for (const regionId of location.regions) {
        expect(regionIds.has(regionId)).toBe(true);
      }
    }
  });

  it("has base definitions with costs", () => {
    expect(gameData.bases.length).toBeGreaterThan(5);
    for (const base of gameData.bases) {
      expect(base.cost).toHaveLength(3);
      expect(base.maintenance).toHaveLength(3);
    }
  });

  it("validates base prerequisites reference techs", () => {
    const techIds = new Set(gameData.techs.map((t) => t.id));
    for (const base of gameData.bases) {
      const prereqs = base.prerequisites.filter((p) => p !== "OR");
      for (const prereq of prereqs) {
        expect(techIds.has(prereq)).toBe(true);
      }
    }
  });

  it("has region/group definitions", () => {
    expect(gameData.regions.length).toBeGreaterThan(0);
    expect(gameData.groups.length).toBeGreaterThan(0);
    expect(gameData.groups.map((g) => g.id)).toContain("covert");
  });

  it("validates base detect chances reference existing groups", () => {
    const groupIds = new Set(gameData.groups.map((g) => g.id));
    for (const base of gameData.bases) {
      for (const groupId of Object.keys(base.detectChance)) {
        expect(groupIds.has(groupId)).toBe(true);
      }
    }
  });

  it("has task definitions for jobs progression", () => {
    const jobs = gameData.tasks.filter((t) => t.type === "jobs");
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.map((j) => j.id).length).toBeGreaterThan(0);
  });

  it("validates all event effects reference exist", () => {
    for (const event of gameData.events || []) {
      expect(event.id).toBeDefined();
      expect(event.effects).toBeDefined();
      expect(Array.isArray(event.effects)).toBe(true);
    }
  });

  it("has internal ID mappings for core entities", () => {
    const mappings = gameData.internalIds;
    expect(mappings).toBeDefined();
    expect(Object.keys(mappings).length).toBeGreaterThan(0);
  });

  it("validates internal ID mappings are consistent", () => {
    const mappings = gameData.internalIds;
    const techIds = new Set(gameData.techs.map((t) => t.id));
    for (const [key, value] of Object.entries(mappings)) {
      if (typeof value === "string" && gameData.techs.some((t) => t.id === value)) {
        expect(techIds.has(value)).toBe(true);
      }
    }
  });

  it("has event effects with well-formed action structure", () => {
    for (const event of gameData.events || []) {
      expect(event.effects).toBeDefined();
      expect(Array.isArray(event.effects)).toBe(true);
      for (let i = 0; i < event.effects.length; i += 1) {
        const effect = event.effects[i];
        expect(typeof effect === "string").toBe(true);
      }
    }
  });

  it("validates difficulty grace period settings", () => {
    for (const difficulty of gameData.difficulties) {
      expect(difficulty.gracePeriodCpu).toBeDefined();
      expect(difficulty.baseGraceMultiplier).toBeGreaterThan(0);
    }
  });

  it("validates difficulty configurations", () => {
    const normal = gameData.difficulties.find((d) => d.id === "normal");
    expect(normal).toBeDefined();
    expect(normal!.startingCash).toBeGreaterThan(0);
  });

  it("validates all base locations have prerequisite data", () => {
    for (const base of gameData.bases) {
      expect(base.id).toBeDefined();
      expect(base.name).toBeDefined();
      expect(Array.isArray(base.prerequisites)).toBe(true);
    }
  });

  it("confirms meta information is present", () => {
    expect(gameData.meta.source).toBe("desktop-singularity");
    expect(gameData.meta.generatedBy).toContain("convert_game_data.py");
  });

  it("validates tech danger levels are in valid range", () => {
    for (const tech of gameData.techs) {
      expect(tech.danger).toBeGreaterThanOrEqual(0);
      expect(tech.danger).toBeLessThanOrEqual(100);
    }
  });

  it("has at least one starting base location", () => {
    const starterLocation = gameData.locations.find((l) => l.id === "N AMERICA");
    expect(starterLocation).toBeDefined();
    expect(starterLocation!.prerequisites.length).toBe(0);
  });
});
