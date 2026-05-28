import { useEffect, useState } from "react";
import { useGameStore } from "../store/gameStore";
import { WorldMap } from "./WorldMap";
import { ResearchPanel } from "./ResearchPanel";
import { ReportsPanel } from "./ReportsPanel";
import { LocationPanel } from "./LocationPanel";
import { OptionsPanel } from "./OptionsPanel";
import { MainMenuPanel } from "./MainMenuPanel";
import { BasePanel } from "./BasePanel";
import { LogPanel } from "./LogPanel";
import { KnowledgePanel } from "./KnowledgePanel";
import { SavePanel } from "./SavePanel";

type ScreenId = "main-menu" | "map" | "research" | "location" | "base" | "reports" | "save" | "log" | "knowledge" | "options";

export function App() {
  const {
    availableDifficulties,
    selectedDifficultyId,
    game,
    selectedLocationId,
    settings,
    settingsLoaded,
    saveSummaries,
    sessionLog,
    reportHistory,
    setDifficulty,
    setSelectedLocation,
    initializeSettings,
    updateSettings,
    startNewGame,
    assignCpu,
    buildBaseAtSelectedLocation,
    toggleBasePower,
    availableBuildableBaseIds,
    advanceByCurrentTimeStep,
    advanceHalfDay,
    advanceDay,
    saveToSlot,
    loadFromSlot,
    deleteFromSlot,
    exportCurrentGame,
    importCurrentGame,
  } = useGameStore();

  const [screen, setScreen] = useState<ScreenId>("main-menu");

  useEffect(() => {
    void initializeSettings();
  }, [initializeSettings]);

  const buildableBaseActions = !game
    ? []
    : availableBuildableBaseIds().map((baseId) => {
        const base = game.baseDefs.get(baseId);
        return {
          id: baseId,
          label: base?.name ?? baseId,
          cashCost: base?.cost[0] ?? 0,
          maintenanceCash: base?.maintenance[0] ?? 0,
          maintenanceCpu: base?.maintenance[1] ?? 0,
        };
      });

  const handleStartNewGame = () => {
    startNewGame();
    setScreen("map");
  };

  return (
    <div className={`app-shell ${settings.compactCards ? "compact" : ""}`}>
      <header className="hero">
        <p className="eyebrow">Endgame: Singularity</p>
        <h1>Webapp Engine Prototype</h1>
        <p className="subtitle">
          Engine-first rewrite with generated game data, deterministic simulation,
          and responsive browser UI groundwork.
        </p>
      </header>

      <nav className="screen-tabs" aria-label="Screens">
        <button className={screen === "main-menu" ? "active" : ""} onClick={() => setScreen("main-menu")}>Main Menu</button>
        <button className={screen === "map" ? "active" : ""} onClick={() => setScreen("map")}>Map</button>
        <button className={screen === "research" ? "active" : ""} onClick={() => setScreen("research")}>Research</button>
        <button className={screen === "location" ? "active" : ""} onClick={() => setScreen("location")}>Location</button>
        <button className={screen === "base" ? "active" : ""} onClick={() => setScreen("base")}>Base</button>
        <button className={screen === "reports" ? "active" : ""} onClick={() => setScreen("reports")}>Reports</button>
        <button className={screen === "save" ? "active" : ""} onClick={() => setScreen("save")}>Save</button>
        <button className={screen === "log" ? "active" : ""} onClick={() => setScreen("log")}>Log</button>
        <button className={screen === "knowledge" ? "active" : ""} onClick={() => setScreen("knowledge")}>Knowledge</button>
        <button className={screen === "options" ? "active" : ""} onClick={() => setScreen("options")}>Options</button>
      </nav>

      <main className="grid">
        {screen === "main-menu" ? (
          <MainMenuPanel
            availableDifficulties={availableDifficulties}
            selectedDifficultyId={selectedDifficultyId}
            saveSummaries={saveSummaries}
            onSetDifficulty={setDifficulty}
            onStartNewGame={handleStartNewGame}
            onLoadSlot={async (slot) => {
              await loadFromSlot(slot);
            }}
          />
        ) : null}

        {game && screen === "map" ? (
          <>
            <section className="card card-span-2">
              <h2>World Map</h2>
              <WorldMap
                locations={Array.from(game.locations.values())}
                selectedLocationId={selectedLocationId}
                isLocationAvailable={(locationId) => game.locationAvailable(locationId)}
                rawSec={game.rawSec}
                onSelect={setSelectedLocation}
              />
              <p className="muted">
                Click markers to select a location. Locked locations require additional technologies.
              </p>
            </section>
            <section className="card card-span-2">
              <h2>Simulation</h2>
              <dl className="stats">
                <div>
                  <dt>Difficulty</dt>
                  <dd>{game.difficulty.id}</dd>
                </div>
                <div>
                  <dt>Day</dt>
                  <dd>{game.rawDay}</dd>
                </div>
                <div>
                  <dt>Cash</dt>
                  <dd>{game.cash}</dd>
                </div>
                <div>
                  <dt>CPU Pool</dt>
                  <dd>{game.availableCpus[0]}</dd>
                </div>
              </dl>
              <div className="actions">
                <button onClick={() => void advanceByCurrentTimeStep()}>
                  Advance ({Math.round(settings.timeStepSeconds / 3600)}h)
                </button>
                <button onClick={() => void advanceHalfDay()}>Advance 12h</button>
                <button onClick={advanceDay}>Advance 24h</button>
                <button onClick={() => setScreen("save")}>Open Save Manager</button>
              </div>
            </section>
          </>
        ) : null}

        {game && screen === "location" ? (
          <>
            <section className="card card-span-2">
              <h2>World Map</h2>
              <WorldMap
                locations={Array.from(game.locations.values())}
                selectedLocationId={selectedLocationId}
                isLocationAvailable={(locationId) => game.locationAvailable(locationId)}
                rawSec={game.rawSec}
                onSelect={setSelectedLocation}
              />
              <p className="muted">
                Click markers to select a location. Locked locations require additional technologies.
              </p>
            </section>
            <LocationPanel
              game={game}
              selectedLocationId={selectedLocationId}
              onSelectLocation={setSelectedLocation}
              buildableBaseActions={buildableBaseActions}
              onBuildBase={buildBaseAtSelectedLocation}
              onToggleBasePower={toggleBasePower}
            />
          </>
        ) : null}

        {game && screen === "base" ? (
          <BasePanel
            game={game}
            onToggleBasePower={toggleBasePower}
            onSelectLocation={setSelectedLocation}
          />
        ) : null}

        {game && screen === "research" ? (
          <ResearchPanel game={game} onAssignCpu={assignCpu} />
        ) : null}

        {game && screen === "reports" ? <ReportsPanel game={game} entries={sessionLog} reportHistory={reportHistory} /> : null}

        {screen === "save" ? (
          <SavePanel
            saveSummaries={saveSummaries}
            canSave={Boolean(game)}
            hasActiveGame={Boolean(game)}
            confirmImport={settings.confirmImport}
            currentSession={
              game
                ? {
                    day: game.rawDay,
                    difficultyId: game.difficulty.id,
                    cash: game.cash,
                    baseCount: game.bases.length,
                  }
                : null
            }
            onSaveSlot={saveToSlot}
            onLoadSlot={loadFromSlot}
            onDeleteSlot={deleteFromSlot}
            onExport={exportCurrentGame}
            onImport={importCurrentGame}
          />
        ) : null}

        {screen === "log" ? <LogPanel entries={sessionLog} /> : null}

        {game && screen === "knowledge" ? <KnowledgePanel game={game} entries={sessionLog} /> : null}

        {screen === "options" ? (
          <OptionsPanel
            settings={settings}
            settingsLoaded={settingsLoaded}
            onUpdateSettings={updateSettings}
          />
        ) : null}

        {!game && screen !== "main-menu" ? (
          <section className="card card-span-2">
            <h2>No Active Game</h2>
            <p>Start a new game from Main Menu to use this screen.</p>
            <button onClick={() => setScreen("main-menu")}>Go To Main Menu</button>
          </section>
        ) : null}
      </main>
    </div>
  );
}