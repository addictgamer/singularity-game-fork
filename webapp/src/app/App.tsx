import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../store/gameStore";
import { MainMenuPanel } from "./MainMenuPanel";
import { GameView } from "./GameView";
import { audioController } from "./audio";

export function App() {
  const [gameAssetsReady, setGameAssetsReady] = useState(false);
  const [audioWarning, setAudioWarning] = useState<string | null>(null);
  const processedLogCountRef = useRef<number | null>(null);

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
    audioController.setSettings(settings);
  }, [settings]);

  useEffect(() => {
    audioController.setWarningHandler((message) => {
      setAudioWarning(message);
      window.setTimeout(() => {
        setAudioWarning((current) => (current === message ? null : current));
      }, 4200);
    });
    return () => {
      audioController.setWarningHandler(null);
    };
  }, []);

  useEffect(() => {
    const baseline = processedLogCountRef.current;
    if (baseline === null) {
      processedLogCountRef.current = sessionLog.length;
      return;
    }

    if (sessionLog.length <= baseline) {
      return;
    }

    const newEntries = sessionLog.slice(baseline);
    for (const entry of newEntries) {
      audioController.playSfxForEvent(entry.kind, entry.message);
    }

    processedLogCountRef.current = sessionLog.length;
  }, [sessionLog]);

  useEffect(() => {
    const unlockAudio = () => {
      audioController.unlockFromGesture();
      audioController.resumeIfNeeded();
    };

    const onPointerDown = (event: PointerEvent) => {
      unlockAudio();
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const actionable = target.closest(
        "button, [role='button'], a, summary, input[type='checkbox'], input[type='radio'], input[type='range'], select"
      );
      if (actionable) {
        audioController.playUiClick();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (event.key.toLowerCase() === "m" && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        unlockAudio();
        void updateSettings({ audioMuted: !settings.audioMuted });
        audioController.playUiClick();
        return;
      }

      if (event.key.toLowerCase() === "m" && event.altKey) {
        event.preventDefault();
        unlockAudio();
        void updateSettings({ musicEnabled: !settings.musicEnabled });
        audioController.playUiClick();
        return;
      }

      if (event.key.toLowerCase() === "s" && event.altKey) {
        event.preventDefault();
        unlockAudio();
        void updateSettings({ sfxEnabled: !settings.sfxEnabled });
        audioController.playUiClick();
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        unlockAudio();
        audioController.playUiClick();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        audioController.resumeIfNeeded();
      }
    };

    const onPageShow = () => {
      audioController.resumeIfNeeded();
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      audioController.dispose();
    };
  }, [settings.audioMuted, settings.musicEnabled, settings.sfxEnabled, updateSettings]);

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
      {audioWarning ? (
        <div className="app-audio-warning" role="status" aria-live="polite">
          Audio: {audioWarning}
        </div>
      ) : null}

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