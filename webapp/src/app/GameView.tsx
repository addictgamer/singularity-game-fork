import { useEffect, useRef, useState } from "react";
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
import { RESOURCE_CPU, RESOURCE_CASH, SECONDS_PER_DAY } from "../engine/constants";

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
  onAdvanceHour: () => Promise<void>;
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
  onAdvanceHour,
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
  const [eventConsoleCollapsed, setEventConsoleCollapsed] = useState(false);
  const eventConsoleBodyRef = useRef<HTMLDivElement | null>(null);

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
  const hours = (game.rawHour % 24).toString().padStart(2, "0");
  const minutes = (game.rawMin % 60).toString().padStart(2, "0");
  const seconds = (game.rawSec % 60).toString().padStart(2, "0");
  const idleCpu = game.effectiveCpuPool();
  const ownedCpu = game.bases.reduce((sum, base) => sum + base.cpuProvided, 0);
  const activeResearch = Array.from(game.techs.values())
    .filter((tech) => !tech.done)
    .map((tech) => {
      const allocation = game.getAllocatedCpuFor(tech.id);
      const totalCpuCost = Math.max(1, tech.totalCost[RESOURCE_CPU]);
      const cpuProgressPercent = Math.max(0, Math.min(100, 100 - (tech.costLeft[RESOURCE_CPU] / totalCpuCost) * 100));
      const hasCpuEta = allocation > 0 && tech.costLeft[RESOURCE_CPU] > 0;
      const etaDays = hasCpuEta ? tech.costLeft[RESOURCE_CPU] / (allocation * SECONDS_PER_DAY) : null;
      const waitingOnCash = tech.costLeft[RESOURCE_CPU] <= 0 && tech.costLeft[RESOURCE_CASH] > 0;
      return {
        id: tech.id,
        name: tech.name,
        allocation,
        cpuProgressPercent,
        etaDays,
        waitingOnCash,
      };
    })
    .filter((tech) => tech.allocation > 0)
    .sort((a, b) => {
      const allocationDiff = b.allocation - a.allocation;
      if (allocationDiff !== 0) {
        return allocationDiff;
      }
      const aEta = a.etaDays ?? Number.POSITIVE_INFINITY;
      const bEta = b.etaDays ?? Number.POSITIVE_INFINITY;
      return aEta - bEta;
    });
  const trackerResearch = activeResearch[0] ?? null;

  useEffect(() => {
    if (eventConsoleCollapsed) {
      return;
    }
    const body = eventConsoleBodyRef.current;
    if (!body) {
      return;
    }
    body.scrollTop = body.scrollHeight;
  }, [eventConsoleCollapsed, sessionLog]);

  return (
    <div className="game-view">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Singularity</h2>
          <p className="sidebar-day">Day {game.rawDay} {hours}:{minutes}:{seconds}</p>
          <dl className="sidebar-stats">
            <div>
              <dt>Cash</dt>
              <dd>{game.cash}</dd>
            </div>
            <div>
              <dt title="Idle CPUs will perform jobs and make money.">CPU Availability</dt>
              <dd title="Shown as idle/owned CPU.">{idleCpu}/{ownedCpu}</dd>
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
          <button className="btn-secondary" onClick={() => void onAdvanceHour()}>
            +1h
          </button>
        </div>

        <button className="btn-exit" onClick={onReturnToMenu}>
          ← Return to Menu
        </button>
      </aside>

      {/* Main Map Viewport */}
      <main className="map-viewport">
        <section className="map-container">
          {trackerResearch ? (
            <aside
              className="research-tracker"
              aria-live="polite"
              aria-label="Research progress tracker"
              role="button"
              tabIndex={0}
              onClick={() => setOpenModal("research")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setOpenModal("research");
                }
              }}
            >
              <h3>Research Tracker</h3>
              <p className="research-tracker-name">{trackerResearch.name}</p>
              <p className="research-tracker-meta">Assigned CPU: {trackerResearch.allocation}</p>
              <div className="research-tracker-progress" aria-hidden="true">
                <div
                  className="research-tracker-progress-fill"
                  style={{ width: `${trackerResearch.cpuProgressPercent.toFixed(1)}%` }}
                />
              </div>
              <p className="research-tracker-meta">
                {trackerResearch.waitingOnCash
                  ? "ETA: Awaiting cash"
                  : trackerResearch.etaDays === null
                    ? "ETA: --"
                    : `ETA: ${trackerResearch.etaDays.toFixed(1)} days`}
              </p>
              {activeResearch.length > 1 ? (
                <p className="research-tracker-extra">+{activeResearch.length - 1} more queued</p>
              ) : null}
            </aside>
          ) : null}
          <WorldMap
            locations={Array.from(game.locations.values())}
            selectedLocationId={selectedLocationId}
            isLocationAvailable={(locationId) => game.locationAvailable(locationId)}
            rawSec={game.rawSec}
            onSelect={handleLocationSelect}
          />
          <section className="event-console" aria-label="Event log console" role="log" aria-live="polite">
            <header className="event-console-header">
              <span>Event Log</span>
              <button
                type="button"
                className="event-console-toggle"
                onClick={() => setEventConsoleCollapsed((value) => !value)}
                aria-expanded={!eventConsoleCollapsed}
                aria-controls="event-console-body"
                title={eventConsoleCollapsed ? "Expand event log" : "Collapse event log"}
              >
                {eventConsoleCollapsed ? "▴" : "▾"}
              </button>
            </header>
            {!eventConsoleCollapsed ? (
              <div className="event-console-body" id="event-console-body" ref={eventConsoleBodyRef}>
                {sessionLog.length === 0 ? (
                  <div className="event-console-line event-console-line-empty">No events yet.</div>
                ) : (
                  sessionLog.map((entry) => (
                    <div key={entry.id} className="event-console-line">
                      [{entry.day.toString().padStart(3, "0")}] [{entry.kind}] {entry.message}
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </section>
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
