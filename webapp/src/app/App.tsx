import { useEffect, useMemo, useState } from "react";
import { useGameStore } from "../store/gameStore";
import { RESOURCE_CPU, RESOURCE_CASH } from "../engine/constants";
import { WorldMap } from "./WorldMap";
import { ResearchPanel } from "./ResearchPanel";
import { ReportsPanel } from "./ReportsPanel";
import { LocationPanel } from "./LocationPanel";
import { OptionsPanel } from "./OptionsPanel";

type ScreenId = "map" | "research" | "location" | "reports" | "options";

export function App() {
  const {
    availableDifficulties,
    selectedDifficultyId,
    game,
    selectedLocationId,
    settings,
    settingsLoaded,
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
    exportCurrentGame,
    importCurrentGame,
  } = useGameStore();

  const [screen, setScreen] = useState<ScreenId>("map");
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    void initializeSettings();
  }, [initializeSettings]);

  const stealth = useMemo(() => game?.techs.get("Stealth"), [game]);
  const buildableBaseIds = useMemo(() => availableBuildableBaseIds(), [game, selectedLocationId, availableBuildableBaseIds]);
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
        <button className={screen === "map" ? "active" : ""} onClick={() => setScreen("map")}>Map</button>
        <button className={screen === "research" ? "active" : ""} onClick={() => setScreen("research")}>Research</button>
        <button className={screen === "location" ? "active" : ""} onClick={() => setScreen("location")}>Location</button>
        <button className={screen === "reports" ? "active" : ""} onClick={() => setScreen("reports")}>Reports</button>
        <button className={screen === "options" ? "active" : ""} onClick={() => setScreen("options")}>Options</button>
      </nav>

      <main className="grid">
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
                <button onClick={() => void saveToSlot("slot-1")}>Save Slot 1</button>
                <button onClick={() => void loadFromSlot("slot-1")}>Load Slot 1</button>
                <button
                  onClick={() => {
                    const json = exportCurrentGame();
                    if (!json) {
                      return;
                    }
                    const blob = new Blob([json], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "singularity-web-save.json";
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export Save
                </button>
                <label className="import-button">
                  Import Save
                  <input
                    type="file"
                    accept="application/json"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) {
                        return;
                      }
                      if (settings.confirmImport) {
                        const ok = window.confirm("Importing will replace current session state. Continue?");
                        if (!ok) {
                          return;
                        }
                      }
                      try {
                        const json = await file.text();
                        importCurrentGame(json);
                        setImportError(null);
                      } catch (error) {
                        setImportError((error as Error).message);
                      }
                    }}
                  />
                </label>
              </div>
              {importError ? <p className="error">Import failed: {importError}</p> : null}
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
            buildableBaseIds={buildableBaseIds}
            onBuildBase={buildBaseAtSelectedLocation}
            onToggleBasePower={toggleBasePower}
          />
        )}

        {game && screen === "research" ? (
          <ResearchPanel game={game} onAssignCpu={assignCpu} />
        ) : null}

        {game && screen === "reports" ? <ReportsPanel game={game} /> : null}

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