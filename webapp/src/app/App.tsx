import { useEffect, useState } from "react";
import { useGameStore } from "../store/gameStore";
import { MainMenuPanel } from "./MainMenuPanel";
import { GameView } from "./GameView";

export function App() {
  const [gameAssetsReady, setGameAssetsReady] = useState(false);

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
    abandonBase,
    destroyAllBases,
    availableBuildableBaseIds,
    advanceByCurrentTimeStep,
    advanceHour,
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

  useEffect(() => {
    if (appScreen !== "game" || !game) {
      setGameAssetsReady(false);
      return;
    }

    let cancelled = false;
    setGameAssetsReady(false);

    const assets = ["/earth.jpg", "/earth-night.jpg"];
    let loadedCount = 0;
    const onAssetFinished = () => {
      loadedCount += 1;
      if (!cancelled && loadedCount >= assets.length) {
        setGameAssetsReady(true);
      }
    };

    for (const assetUrl of assets) {
      const img = new Image();
      img.decoding = "async";
      const finishAfterDecode = () => {
        void img.decode().catch(() => undefined).finally(onAssetFinished);
      };
      img.onload = finishAfterDecode;
      img.onerror = onAssetFinished;
      img.src = assetUrl;

      if (img.complete && img.naturalWidth > 0) {
        finishAfterDecode();
      }
    }

    return () => {
      cancelled = true;
    };
  }, [appScreen, game]);

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

      {appScreen === "game" && game && !gameAssetsReady && (
        <div className="app-loading-screen" role="status" aria-live="polite" aria-busy="true">
          <div className="app-loading-spinner" />
          <div className="app-loading-title">Loading Mission Environment</div>
          <div className="app-loading-subtitle">Synchronizing global map assets...</div>
        </div>
      )}

      {appScreen === "game" && game && gameAssetsReady && (
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
            onAbandonBase={abandonBase}
            onDestroyAllBases={destroyAllBases}
            onAdvanceByTimeStep={advanceByCurrentTimeStep}
            onAdvanceHour={advanceHour}
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