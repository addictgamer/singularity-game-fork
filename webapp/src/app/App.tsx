import { useEffect, useState } from "react";
import { useGameStore } from "../store/gameStore";
import { RESOURCE_CPU, RESOURCE_CASH } from "../engine/constants";
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

  const stealth = game?.techs.get("Stealth");
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
            onStartNewGame={startNewGame}
            onLoadSlot={async (slot) => {
              await loadFromSlot(slot);
            }}
          />
        ) : null}

        <section className="card">
          <h2>Game Setup</h2>
          <label htmlFor="difficulty">Difficulty</label>
          <select
            id="difficulty"
            value={selectedDifficultyId}
            onChange={(event) => setDifficulty(event.target.value)}
          >
            {availableDifficulties.map((difficulty) => (
              <option key={difficulty.id} value={difficulty.id}>
                {difficulty.name}
              </option>
            ))}
          </select>
          <button onClick={startNewGame}>Start New Game</button>
        </section>

        <section className="card">
          <h2>Simulation ({screen})</h2>
          {!game ? (
            <p>No active game yet.</p>
          ) : (
            <>
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
                  <dt>Partial Cash</dt>
                  <dd>{game.partialCash}</dd>
                </div>
                <div>
                  <dt>CPU Pool</dt>
                  <dd>{game.availableCpus[0]}</dd>
                </div>
                <div>
                  <dt>Effective CPU Pool</dt>
                  <dd>{game.effectiveCpuPool()}</dd>
                </div>
              </dl>

              <div className="actions">
                <button onClick={() => assignCpu("jobs", 1)}>Assign 1 CPU to jobs</button>
                <button onClick={() => assignCpu("jobs", 0)}>Clear jobs CPU</button>
                <button onClick={() => assignCpu("Stealth", 1)}>Assign 1 CPU to Stealth</button>
                <button onClick={() => assignCpu("Stealth", 0)}>Clear Stealth CPU</button>
                <button onClick={() => void advanceByCurrentTimeStep()}>
                  Advance ({Math.round(settings.timeStepSeconds / 3600)}h)
                </button>
                <button onClick={() => void advanceHalfDay()}>Advance 12h</button>
                <button onClick={advanceDay}>Advance 24h</button>
                <button onClick={() => setScreen("save")}>Open Save Manager</button>
              </div>
            </>
          )}
        </section>

        <section className="card">
          <h2>Tech Snapshot</h2>
          {!game || !stealth || screen !== "research" ? (
            <p>Start a game to inspect technology progression.</p>
          ) : (
            <dl className="stats">
              <div>
                <dt>Stealth Available</dt>
                <dd>{stealth.available(game) ? "yes" : "no"}</dd>
              </div>
              <div>
                <dt>Stealth Done</dt>
                <dd>{stealth.done ? "yes" : "no"}</dd>
              </div>
              <div>
                <dt>CPU Left</dt>
                <dd>{stealth.costLeft[RESOURCE_CPU]}</dd>
              </div>
              <div>
                <dt>Cash Left</dt>
                <dd>{stealth.costLeft[RESOURCE_CASH]}</dd>
              </div>
            </dl>
          )}
        </section>

        <section className="card">
          <h2>World Map</h2>
          {!game || (screen !== "map" && screen !== "location") ? (
            <p>Start a game to open the world map.</p>
          ) : (
            <>
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
            </>
          )}
        </section>

        {!game || (screen !== "map" && screen !== "location") ? (
          <section className="card">
            <h2>Location Operations</h2>
            <p>Start a game to manage bases and regions.</p>
          </section>
        ) : (
          <LocationPanel
            game={game}
            selectedLocationId={selectedLocationId}
            onSelectLocation={setSelectedLocation}
            buildableBaseActions={buildableBaseActions}
            onBuildBase={buildBaseAtSelectedLocation}
            onToggleBasePower={toggleBasePower}
          />
        )}

        {game && screen === "base" ? <BasePanel game={game} onToggleBasePower={toggleBasePower} /> : null}

        {game && screen === "research" ? (
          <ResearchPanel game={game} onAssignCpu={assignCpu} />
        ) : null}

        {game && screen === "reports" ? <ReportsPanel game={game} /> : null}

        {screen === "save" ? (
          <SavePanel
            saveSummaries={saveSummaries}
            canSave={Boolean(game)}
            confirmImport={settings.confirmImport}
            onSaveSlot={saveToSlot}
            onLoadSlot={loadFromSlot}
            onDeleteSlot={deleteFromSlot}
            onExport={exportCurrentGame}
            onImport={importCurrentGame}
          />
        ) : null}

        {screen === "log" ? <LogPanel entries={sessionLog} /> : null}

        {game && screen === "knowledge" ? <KnowledgePanel game={game} /> : null}

        {screen === "options" ? (
          <OptionsPanel
            settings={settings}
            settingsLoaded={settingsLoaded}
            onUpdateSettings={updateSettings}
          />
        ) : null}
      </main>
    </div>
  );
}