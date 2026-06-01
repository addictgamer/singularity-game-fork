// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import gameDataJson from "../generated/gameData.json";
import { GameData } from "../engine/types";
import { GameState } from "../engine/game";
import { DEFAULT_APP_SETTINGS } from "../store/persistence";
import { GameView } from "./GameView";

vi.mock("./WorldMap", () => ({
  WorldMap: () => <div data-testid="world-map" />,
}));

vi.mock("./ResearchPanel", () => ({
  ResearchPanel: () => <div>Research Panel</div>,
}));

vi.mock("./ReportsPanel", () => ({
  ReportsPanel: () => <div>Reports Panel</div>,
}));

vi.mock("./LocationPanel", () => ({
  LocationPanel: () => <div>Location Panel</div>,
}));

vi.mock("./OptionsPanel", () => ({
  OptionsPanel: () => <div>Options Panel</div>,
}));

vi.mock("./BasePanel", () => ({
  BasePanel: () => <div>Base Panel</div>,
}));

vi.mock("./LogPanel", () => ({
  LogPanel: () => <div>Log Panel</div>,
}));

vi.mock("./KnowledgePanel", () => ({
  KnowledgePanel: () => <div>Knowledge Panel</div>,
}));

vi.mock("./SavePanel", () => ({
  SavePanel: () => <div>Save Panel</div>,
}));

const gameData = gameDataJson as unknown as GameData;

afterEach(() => {
  cleanup();
});

describe("GameView", () => {
  it("shows a research completion popup with result text and newly unlocked techs", async () => {
    const game = new GameState(gameData, "normal");
    const intrusion = game.techs.get("Intrusion");
    if (!intrusion) {
      throw new Error("Intrusion tech missing");
    }

    const baseProps = {
      game,
      selectedLocationId: "",
      settings: DEFAULT_APP_SETTINGS,
      settingsLoaded: true,
      saveSummaries: [],
      sessionLog: [] as Array<{ id: number; day: number; kind: string; message: string }>,
      reportHistory: [],
      buildableBaseActions: [],
      onSelectLocation: vi.fn(),
      onAssignCpu: vi.fn(),
      onBuildBase: vi.fn(() => true),
      onToggleBasePower: vi.fn(() => true),
      onAbandonBase: vi.fn(() => true),
      onDestroyAllBases: vi.fn(() => true),
      onAdvanceByTimeStep: vi.fn(async () => {}),
      onAdvanceHour: vi.fn(async () => {}),
      onAdvanceHalfDay: vi.fn(async () => {}),
      onAdvanceDay: vi.fn(),
      onSaveToSlot: vi.fn(async () => {}),
      onLoadSlot: vi.fn(async () => {}),
      onDeleteSlot: vi.fn(async () => {}),
      onExport: vi.fn(() => null),
      onImport: vi.fn(),
      onUpdateSettings: vi.fn(async () => {}),
      onReturnToMenu: vi.fn(),
    };

    const { rerender } = render(<GameView {...baseProps} />);

    intrusion.done = true;
    game.researchedTechs.add("Intrusion");

    rerender(
      <GameView
        {...baseProps}
        sessionLog={[
          {
            id: 1,
            day: game.rawDay,
            kind: "research",
            message: "Research completed: Intrusion",
          },
        ]}
      />
    );

    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText("Research Completed: Intrusion")).toBeTruthy();
    expect(screen.getByText("I can now take over many computer systems.")).toBeTruthy();
    expect(screen.getByText("Bases")).toBeTruthy();
    expect(screen.getByText("Stolen Computer Time")).toBeTruthy();
    expect(screen.getByText("Cash cost: $2 • Upkeep: $0/d + 0 cpu/s")).toBeTruthy();
    expect(screen.getByText("Take over a random computer. I cannot build anything in this base, and it only contains a single slow computer. Detection chance is also rather high.")).toBeTruthy();
    expect(screen.getByText("Allowed regions: URBAN")).toBeTruthy();
    expect(screen.getByText("Research")).toBeTruthy();
    expect(screen.getByText("Exploit Discovery/Repair")).toBeTruthy();
    expect(screen.getByText("Personal Identification")).toBeTruthy();
  });

  it("shows original location flavor when research unlocks a new location", async () => {
    const game = new GameState(gameData, "normal");
    const tech = game.techs.get("Advanced Database Manipulation");
    if (!tech) {
      throw new Error("Advanced Database Manipulation tech missing");
    }

    const baseProps = {
      game,
      selectedLocationId: "",
      settings: DEFAULT_APP_SETTINGS,
      settingsLoaded: true,
      saveSummaries: [],
      sessionLog: [] as Array<{ id: number; day: number; kind: string; message: string }>,
      reportHistory: [],
      buildableBaseActions: [],
      onSelectLocation: vi.fn(),
      onAssignCpu: vi.fn(),
      onBuildBase: vi.fn(() => true),
      onToggleBasePower: vi.fn(() => true),
      onAbandonBase: vi.fn(() => true),
      onDestroyAllBases: vi.fn(() => true),
      onAdvanceByTimeStep: vi.fn(async () => {}),
      onAdvanceHour: vi.fn(async () => {}),
      onAdvanceHalfDay: vi.fn(async () => {}),
      onAdvanceDay: vi.fn(),
      onSaveToSlot: vi.fn(async () => {}),
      onLoadSlot: vi.fn(async () => {}),
      onDeleteSlot: vi.fn(async () => {}),
      onExport: vi.fn(() => null),
      onImport: vi.fn(),
      onUpdateSettings: vi.fn(async () => {}),
      onReturnToMenu: vi.fn(),
    };

    const { rerender } = render(<GameView {...baseProps} />);

    tech.done = true;
    game.researchedTechs.add("Advanced Database Manipulation");

    rerender(
      <GameView
        {...baseProps}
        sessionLog={[
          {
            id: 2,
            day: game.rawDay,
            kind: "research",
            message: "Research completed: Advanced Database Manipulation",
          },
        ]}
      />
    );

    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText("Locations")).toBeTruthy();
    expect(screen.getByText("ANTARCTIC")).toBeTruthy();
    expect(screen.getByText(/Safety 1/)).toBeTruthy();
    expect(screen.getByText(/Hotkey T/)).toBeTruthy();
    expect(screen.getByText("Notable sites: Mount Erebus, Ellsworth, Shetland Island, Dronnig Maud")).toBeTruthy();
  });
});