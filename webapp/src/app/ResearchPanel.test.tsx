// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { render, within } from "@testing-library/react";
import gameDataJson from "../generated/gameData.json";
import { GameData } from "../engine/types";
import { GameState } from "../engine/game";
import { SECONDS_PER_DAY } from "../engine/constants";
import { ResearchPanel } from "./ResearchPanel";

const gameData = gameDataJson as unknown as GameData;

describe("ResearchPanel", () => {
  it("refreshes displayed research progress after time advancement without filter changes", () => {
    const game = new GameState(gameData, "normal");
    game.cash = 100000;
    game.setAllocatedCpuFor("Stealth", 1);

    const stealth = game.techs.get("Stealth");
    if (!stealth) {
      throw new Error("Stealth tech missing");
    }

    const cpuBefore = stealth.costLeft[1];
    const { rerender, getAllByRole } = render(<ResearchPanel game={game} onAssignCpu={() => {}} />);

    // Find the Stealth row by matching the header strong element
    const articles = getAllByRole("article");
    const rowBefore = articles.find((article) => {
      const strong = article.querySelector("header strong");
      return strong?.textContent === "Stealth";
    });
    if (!rowBefore) {
      throw new Error("Stealth row missing");
    }
    expect(within(rowBefore).getByText(`CPU left: ${stealth.costLeft[1]}`)).toBeTruthy();

    game.giveTime(SECONDS_PER_DAY);
    rerender(<ResearchPanel game={game} onAssignCpu={() => {}} />);

    const cpuAfter = stealth.costLeft[1];
    expect(cpuAfter).toBeLessThan(cpuBefore);

    const articlesAfter = getAllByRole("article");
    const rowAfter = articlesAfter.find((article) => {
      const strong = article.querySelector("header strong");
      return strong?.textContent === "Stealth";
    });
    if (!rowAfter) {
      throw new Error("Stealth row missing after rerender");
    }
    expect(within(rowAfter).getByText(`CPU left: ${cpuAfter}`)).toBeTruthy();
  });

  it("disables +CPU buttons that would exceed available budget", () => {
    const game = new GameState(gameData, "impossible");
    game.setAllocatedCpuFor("jobs", 1);

    const { getAllByRole } = render(<ResearchPanel game={game} onAssignCpu={() => {}} />);

    const articles = getAllByRole("article");
    const row = articles.find((article) => {
      const strong = article.querySelector("header strong");
      return strong?.textContent === "Intrusion";
    });
    if (!row) {
      throw new Error("Intrusion row missing");
    }

    const add1 = within(row).getByRole("button", { name: "+1 CPU" }) as HTMLButtonElement;
    const add5 = within(row).getByRole("button", { name: "+5 CPU" }) as HTMLButtonElement;
    const add10 = within(row).getByRole("button", { name: "+10 CPU" }) as HTMLButtonElement;

    expect(add1.disabled).toBe(true);
    expect(add5.disabled).toBe(true);
    expect(add10.disabled).toBe(true);
    expect(within(row).getByText("CPU assigned: 0")).toBeTruthy();
  });

  it("shows idle cpu indicator for research", () => {
    const game = new GameState(gameData, "impossible");
    game.setAllocatedCpuFor("jobs", 1);

    const { getAllByText } = render(<ResearchPanel game={game} onAssignCpu={() => {}} />);
    expect(getAllByText("Idle CPUs available for research: 0").length).toBeGreaterThan(0);
  });
});
