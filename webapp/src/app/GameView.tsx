import { useEffect, useState } from "react";
import { GameState } from "../engine/game";
import { WorldMap } from "./WorldMap";
import { ResearchPanel } from "./ResearchPanel";
import { ReportsPanel } from "./ReportsPanel";
import { LocationPanel } from "./LocationPanel";
import { OptionsPanel } from "./OptionsPanel";
import { BasePanel } from "./BasePanel";
import { LogPanel } from "./LogPanel";
import { KnowledgePanel } from "./KnowledgePanel";
import { SavePanel } from "./SavePanel";
import { SaveSummary, ReportHistoryRecord } from "../store/persistence";
import { AppSettings } from "../store/persistence";

type ModalId = "research" | "reports" | "save" | "log" | "knowledge" | "options" | null;

interface GameViewProps {
  game: GameState;
  selectedLocationId: string;
  settings: AppSettings;
  settingsLoaded: boolean;
  saveSummaries: SaveSummary[];
  sessionLog: Array<{ id: number; day: number; kind: string; message: string }>;
  reportHistory: ReportHistoryRecord[];
  buildableBaseActions: Array<{ id: string; label: string; cashCost: number; maintenanceCash: number; maintenanceCpu: number }>;
  onSelectLocation: (id: string) => void;
  onAssignCpu: (taskId: string, amount: number) => void;
  onBuildBase: (baseId: string) => boolean;
  onToggleBasePower: (baseId: string) => boolean;
  onAdvanceByTimeStep: () => Promise<void>;
  onAdvanceHalfDay: () => Promise<void>;
  onAdvanceDay: () => void;
  onSaveToSlot: (slot: string) => Promise<void>;
  onLoadSlot: (slot: string) => Promise<void>;
  onDeleteSlot: (slot: string) => Promise<void>;
  onExport: () => string | null;
  onImport: (serialized: string) => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  onReturnToMenu: () => void;
}

export function GameView({
  game,
  selectedLocationId,
  settings,
  settingsLoaded,
  saveSummaries,
  sessionLog,
  reportHistory,
  buildableBaseActions,
  onSelectLocation,
  onAssignCpu,
  onBuildBase,
  onToggleBasePower,
  onAdvanceByTimeStep,
  onAdvanceHalfDay,
  onAdvanceDay,
  onSaveToSlot,
  onLoadSlot,
  onDeleteSlot,
  onExport,
  onImport,
  onUpdateSettings,
  onReturnToMenu,
}: GameViewProps) {
  const [openModal, setOpenModal] = useState<ModalId>(null);

  useEffect(() => {
    if (!openModal) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenModal(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openModal]);

  const handleLocationSelect = (id: string) => {
    onSelectLocation(id);
    // Optionally open location modal, or keep it integrated in the workflow
  };

  // Get highest suspicion group for sidebar display
  const highestSuspicion = Math.max(
    0,
    ...Array.from(game.groups.values()).map((g) => g.suspicion)
  );

  return (
    <div className="game-view">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Singularity</h2>
          <p className="sidebar-day">Day {game.rawDay}</p>
          <dl className="sidebar-stats">
            <div>
              <dt>Cash</dt>
              <dd>{game.cash}</dd>
            </div>
            <div>
              <dt>CPU</dt>
              <dd>{game.availableCpus[0]}</dd>
            </div>
            <div>
              <dt>Suspicion</dt>
              <dd>{Math.round(highestSuspicion)}</dd>
            </div>
          </dl>
        </div>

        <nav className="sidebar-nav">
          <button className="nav-btn" onClick={() => setOpenModal("research")}>
            🔬 Research
          </button>
          <button className="nav-btn" onClick={() => setOpenModal("reports")}>
            📊 Reports
          </button>
          <button className="nav-btn" onClick={() => setOpenModal("save")}>
            💾 Save/Load
          </button>
          <button className="nav-btn" onClick={() => setOpenModal("log")}>
            📝 Activity Log
          </button>
          <button className="nav-btn" onClick={() => setOpenModal("knowledge")}>
            📚 Knowledge
          </button>
          <button className="nav-btn" onClick={() => setOpenModal("options")}>
            ⚙️ Options
          </button>
        </nav>

        <div className="sidebar-controls">
          <button className="btn-primary" onClick={() => void onAdvanceDay()}>
            +1 Day
          </button>
          <button className="btn-secondary" onClick={() => void onAdvanceHalfDay()}>
            +12h
          </button>
          <button className="btn-secondary" onClick={() => void onAdvanceByTimeStep()}>
            +{Math.round(settings.timeStepSeconds / 3600)}h
          </button>
        </div>

        <button className="btn-exit" onClick={onReturnToMenu}>
          ← Return to Menu
        </button>
      </aside>

      {/* Main Map Viewport */}
      <main className="map-viewport">
        <section className="map-container">
          <WorldMap
            locations={Array.from(game.locations.values())}
            selectedLocationId={selectedLocationId}
            isLocationAvailable={(locationId) => game.locationAvailable(locationId)}
            rawSec={game.rawSec}
            onSelect={handleLocationSelect}
          />
        </section>

        {/* Location Operations Overlay (when location is selected) */}
        {selectedLocationId && (
          <aside className="location-sidebar">
            <LocationPanel
              game={game}
              selectedLocationId={selectedLocationId}
              onSelectLocation={onSelectLocation}
              buildableBaseActions={buildableBaseActions}
              onBuildBase={onBuildBase}
              onToggleBasePower={onToggleBasePower}
            />
          </aside>
        )}
      </main>

      {/* Modals */}
      {openModal === "research" && (
        <div className="modal-overlay" onClick={() => setOpenModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpenModal(null)}>✕</button>
            <ResearchPanel game={game} onAssignCpu={onAssignCpu} />
          </div>
        </div>
      )}

      {openModal === "reports" && (
        <div className="modal-overlay" onClick={() => setOpenModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpenModal(null)}>✕</button>
            <ReportsPanel game={game} entries={sessionLog} reportHistory={reportHistory} />
          </div>
        </div>
      )}

      {openModal === "save" && (
        <div className="modal-overlay" onClick={() => setOpenModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpenModal(null)}>✕</button>
            <SavePanel
              saveSummaries={saveSummaries}
              canSave={true}
              hasActiveGame={true}
              confirmImport={settings.confirmImport}
              currentSession={{
                day: game.rawDay,
                difficultyId: game.difficulty.id,
                cash: game.cash,
                baseCount: game.bases.length,
              }}
              onSaveSlot={onSaveToSlot}
              onLoadSlot={onLoadSlot}
              onDeleteSlot={onDeleteSlot}
              onExport={onExport}
              onImport={onImport}
            />
          </div>
        </div>
      )}

      {openModal === "log" && (
        <div className="modal-overlay" onClick={() => setOpenModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpenModal(null)}>✕</button>
            <LogPanel entries={sessionLog} />
          </div>
        </div>
      )}

      {openModal === "knowledge" && (
        <div className="modal-overlay" onClick={() => setOpenModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpenModal(null)}>✕</button>
            <KnowledgePanel game={game} entries={sessionLog} />
          </div>
        </div>
      )}

      {openModal === "options" && (
        <div className="modal-overlay" onClick={() => setOpenModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpenModal(null)}>✕</button>
            <OptionsPanel
              settings={settings}
              settingsLoaded={settingsLoaded}
              onUpdateSettings={onUpdateSettings}
            />
          </div>
        </div>
      )}
    </div>
  );
}
