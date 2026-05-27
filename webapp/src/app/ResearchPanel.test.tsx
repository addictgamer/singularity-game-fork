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
    const { rerender, getByText } = render(<ResearchPanel game={game} onAssignCpu={() => {}} />);

    const rowBefore = getByText("Stealth").closest("article");
    if (!rowBefore) {
      throw new Error("Stealth row missing");
    }
    expect(within(rowBefore).getByText(`CPU left: ${stealth.costLeft[1]}`)).toBeTruthy();

    game.giveTime(SECONDS_PER_DAY);
    rerender(<ResearchPanel game={game} onAssignCpu={() => {}} />);

    const cpuAfter = stealth.costLeft[1];
    expect(cpuAfter).toBeLessThan(cpuBefore);

    const rowAfter = getByText("Stealth").closest("article");
    if (!rowAfter) {
      throw new Error("Stealth row missing after rerender");
    }
    expect(within(rowAfter).getByText(`CPU left: ${cpuAfter}`)).toBeTruthy();
  });
});
