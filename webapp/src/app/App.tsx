import { useEffect } from "react";
import { useGameStore } from "../store/gameStore";
import { MainMenuPanel } from "./MainMenuPanel";
import { GameView } from "./GameView";

export function App() {
  const {
    appScreen,
    availableDifficulties,
    selectedDifficultyId,
    game,
    selectedLocationId,
    settings,
    settingsLoaded,
    saveSummaries,
    sessionLog,
    reportHistory,
    setAppScreen,
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

  return (
    <>
      {appScreen === "main-menu" && (
        <div className="app-shell main-menu-view">
          <MainMenuPanel
            availableDifficulties={availableDifficulties}
            selectedDifficultyId={selectedDifficultyId}
            saveSummaries={saveSummaries}
            onSetDifficulty={setDifficulty}
            onStartNewGame={startNewGame}
            onLoadSlot={loadFromSlot}
          />
        </div>
      )}

      {appScreen === "game" && game && (
        <div className="app-shell game-shell">
          <GameView
            game={game}
            selectedLocationId={selectedLocationId}
            settings={settings}
            settingsLoaded={settingsLoaded}
            saveSummaries={saveSummaries}
            sessionLog={sessionLog}
            reportHistory={reportHistory}
            buildableBaseActions={buildableBaseActions}
            onSelectLocation={setSelectedLocation}
            onAssignCpu={assignCpu}
            onBuildBase={buildBaseAtSelectedLocation}
            onToggleBasePower={toggleBasePower}
            onAdvanceByTimeStep={advanceByCurrentTimeStep}
            onAdvanceHalfDay={advanceHalfDay}
            onAdvanceDay={advanceDay}
            onSaveToSlot={saveToSlot}
            onLoadSlot={loadFromSlot}
            onDeleteSlot={deleteFromSlot}
            onExport={exportCurrentGame}
            onImport={importCurrentGame}
            onUpdateSettings={updateSettings}
            onReturnToMenu={() => setAppScreen("main-menu")}
          />
        </div>
      )}
    </>
  );
}