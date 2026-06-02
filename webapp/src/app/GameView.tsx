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
import { TechTreeVisualization } from "./TechTreeVisualization";
import { SaveSummary, ReportHistoryRecord } from "../store/persistence";
import { AppSettings } from "../store/persistence";
import { RESOURCE_CPU, RESOURCE_CASH, SECONDS_PER_DAY } from "../engine/constants";
import { prerequisitesAvailable } from "../engine/prerequisite";

type ModalId = "research" | "reports" | "bases" | "save" | "log" | "knowledge" | "options" | "tech-tree" | null;

type FloatingNotice = {
  id: number;
  kind: string;
  message: string;
};

type ResearchCompletionNotice = {
  id: number;
  techId: string;
  techName: string;
  result: string;
  unlockedTechIds: string[];
  unlockedBaseIds: string[];
  unlockedLocationIds: string[];
  unlockedJobIds: string[];
};

function formatAllowedRegions(allowedRegions: string[]): string {
  if (allowedRegions.length === 0) {
    return "Any region";
  }
  return allowedRegions.join(", ");
}

function formatLocationRegions(regionIds: string[]): string {
  if (regionIds.length === 0) {
    return "No region restrictions";
  }
  return regionIds.join(", ");
}

function formatNotableSites(notableSites: string[]): string {
  if (notableSites.length === 0) {
    return "No notable sites listed";
  }
  return notableSites.slice(0, 4).join(", ");
}

function getResearchCompletionNotices(
  game: GameState,
  newEntries: Array<{ id: number; day: number; kind: string; message: string }>
): ResearchCompletionNotice[] {
  const completionEntries = newEntries.filter(
    (entry) => entry.kind === "research" && entry.message.startsWith("Research completed: ")
  );
  if (completionEntries.length === 0) {
    return [];
  }

  const techIdByName = new Map(Array.from(game.techs.values()).map((tech) => [tech.name, tech.id]));
  const completedTechIds = completionEntries
    .map((entry) => techIdByName.get(entry.message.slice("Research completed: ".length).trim()) ?? null)
    .filter((techId): techId is string => techId !== null);
  const researchedBefore = new Set(game.researchedTechs);
  for (const techId of completedTechIds) {
    researchedBefore.delete(techId);
  }

  const notices: ResearchCompletionNotice[] = [];
  for (const entry of completionEntries) {
    const techName = entry.message.slice("Research completed: ".length).trim();
    const techId = techIdByName.get(techName);
    if (!techId) {
      continue;
    }

    const researchedAfter = new Set(researchedBefore);
    researchedAfter.add(techId);
    const unlockedTechIds = Array.from(game.techs.values())
      .filter((tech) => !tech.done)
      .filter((tech) => prerequisitesAvailable(tech.prerequisites, researchedAfter))
      .filter((tech) => !prerequisitesAvailable(tech.prerequisites, researchedBefore))
      .map((tech) => tech.id)
      .sort((a, b) => a.localeCompare(b));
    const unlockedBaseIds = Array.from(game.baseDefs.values())
      .filter((baseDef) => prerequisitesAvailable(baseDef.prerequisites, researchedAfter))
      .filter((baseDef) => !prerequisitesAvailable(baseDef.prerequisites, researchedBefore))
      .map((baseDef) => baseDef.id)
      .sort((a, b) => a.localeCompare(b));
    const unlockedLocationIds = Array.from(game.locations.values())
      .filter((location) => prerequisitesAvailable(location.prerequisites, researchedAfter))
      .filter((location) => !prerequisitesAvailable(location.prerequisites, researchedBefore))
      .map((location) => location.id)
      .sort((a, b) => a.localeCompare(b));
    const unlockedJobIds = game.tasks
      .filter((task) => task.type === "jobs")
      .filter((task) => prerequisitesAvailable(task.prerequisites, researchedAfter))
      .filter((task) => !prerequisitesAvailable(task.prerequisites, researchedBefore))
      .map((task) => task.id)
      .sort((a, b) => a.localeCompare(b));

    notices.push({
      id: entry.id,
      techId,
      techName,
      result: game.techDefs.get(techId)?.result ?? "",
      unlockedTechIds,
      unlockedBaseIds,
      unlockedLocationIds,
      unlockedJobIds,
    });

    researchedBefore.add(techId);
  }

  return notices;
}

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
  onAbandonBase: (baseId: string) => boolean;
  onDestroyAllBases: () => boolean;
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
  onAbandonBase,
  onDestroyAllBases,
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
  const [severeAlertsCollapsed, setSevereAlertsCollapsed] = useState(false);
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [floatingNotices, setFloatingNotices] = useState<FloatingNotice[]>([]);
  const [researchCompletionQueue, setResearchCompletionQueue] = useState<ResearchCompletionNotice[]>([]);
  const eventConsoleBodyRef = useRef<HTMLDivElement | null>(null);
  const processedLogCountRef = useRef<number | null>(null);
  const noticeTimeoutIdsRef = useRef<number[]>([]);

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
  const suspicionLeaders = [...game.groups.entries()]
    .map(([groupId, group]) => ({ groupId, suspicion: Math.round(group.suspicion) }))
    .sort((a, b) => b.suspicion - a.suspicion)
    .slice(0, 3);
  const activeEventNames = [...game.events.entries()]
    .filter(([, event]) => event.triggered)
    .map(([eventId]) => game.eventDefs.get(eventId)?.name ?? eventId)
    .sort((a, b) => a.localeCompare(b));
  const maintenanceSnapshot = game.getMaintenanceSnapshot();
  const activeBaseCount = game.bases.filter((base) => base.done && base.powerState === "active").length;
  const gameOver = game.gameOver;
  const activeResearchCompletion = researchCompletionQueue[0] ?? null;
  const unlockedTechCards = activeResearchCompletion
    ? activeResearchCompletion.unlockedTechIds
        .map((techId) => game.techDefs.get(techId))
        .filter((tech): tech is NonNullable<typeof tech> => Boolean(tech))
    : [];
  const unlockedBaseCards = activeResearchCompletion
    ? activeResearchCompletion.unlockedBaseIds
        .map((baseId) => game.baseDefs.get(baseId))
        .filter((base): base is NonNullable<typeof base> => Boolean(base))
    : [];
  const unlockedLocationCards = activeResearchCompletion
    ? activeResearchCompletion.unlockedLocationIds
        .map((locationId) => game.locations.get(locationId))
        .filter((location): location is NonNullable<typeof location> => Boolean(location))
    : [];
  const unlockedJobCards = activeResearchCompletion
    ? activeResearchCompletion.unlockedJobIds
        .map((taskId) => game.tasks.find((task) => task.id === taskId))
        .filter((task): task is NonNullable<typeof task> => Boolean(task))
    : [];
  const gameOverMessage = "Game over: all bases lost";
  const narrativeAlerts: string[] = [];
  if (gameOver) {
    narrativeAlerts.push(gameOverMessage);
  }
  if (suspicionLeaders[0] && suspicionLeaders[0].suspicion >= 5000) {
    narrativeAlerts.push("Critical suspicion pressure");
  } else if (suspicionLeaders[0] && suspicionLeaders[0].suspicion >= 2000) {
    narrativeAlerts.push("Suspicion is rising");
  }
  if (activeEventNames.length > 0) {
    narrativeAlerts.push(`${activeEventNames.length} active event${activeEventNames.length === 1 ? "" : "s"}`);
  }
  if (maintenanceSnapshot.atRiskBaseIds.length > 0) {
    narrativeAlerts.push(`${maintenanceSnapshot.atRiskBaseIds.length} base${maintenanceSnapshot.atRiskBaseIds.length === 1 ? "" : "s"} at risk`);
  }
  if (!game.hadGrace) {
    narrativeAlerts.push("Global grace period ended");
  }
  if (game.apotheosis) {
    narrativeAlerts.push("Endgame condition active");
  }
  const severeAlerts: Array<{ id: string; summary: string }> = [];
  if (gameOver) {
    severeAlerts.push({
      id: "game-over",
      summary: gameOverMessage,
    });
  }
  if (maintenanceSnapshot.cashDeficit || maintenanceSnapshot.cpuDeficit) {
    severeAlerts.push({
      id: "maintenance-deficit",
      summary: "Maintenance deficit detected",
    });
  }
  if (maintenanceSnapshot.atRiskBaseIds.length > 0) {
    const riskCount = maintenanceSnapshot.atRiskBaseIds.length;
    const fewBasesRemain = activeBaseCount <= 3;
    const riskRatioHigh = activeBaseCount > 0 && riskCount / activeBaseCount >= 0.6;
    let riskSummary = `${riskCount} base${riskCount === 1 ? "" : "s"} under elevated risk`;
    if (fewBasesRemain) {
      riskSummary = "You only have a few high-risk bases left, proliferate or risk extinction";
    } else if (riskRatioHigh) {
      riskSummary = "Most active bases are high-risk; expand or stabilize immediately";
    }
    severeAlerts.push({
      id: "base-risk",
      summary: riskSummary,
    });
  }
  if (suspicionLeaders[0] && suspicionLeaders[0].suspicion >= 5000) {
    severeAlerts.push({
      id: "critical-suspicion",
      summary: "Critical suspicion pressure",
    });
  }

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

  useEffect(() => {
    if (processedLogCountRef.current === null) {
      processedLogCountRef.current = sessionLog.length;
      return;
    }
    if (sessionLog.length <= processedLogCountRef.current) {
      return;
    }

    const newEntries = sessionLog.slice(processedLogCountRef.current);
    processedLogCountRef.current = sessionLog.length;

    const researchCompletionNotices = getResearchCompletionNotices(game, newEntries);
    if (researchCompletionNotices.length > 0) {
      setResearchCompletionQueue((current) => [...current, ...researchCompletionNotices]);
    }

    const notableEntries = newEntries.filter((entry) =>
      ["research", "event", "base", "location", "system"].includes(entry.kind)
    );
    if (notableEntries.length === 0) {
      return;
    }

    const baseNoticeId = Date.now();
    const notices: FloatingNotice[] = notableEntries.slice(-4).map((entry, index) => ({
      id: baseNoticeId + index,
      kind: entry.kind,
      message: entry.message,
    }));

    setFloatingNotices((current) => [...current, ...notices].slice(-5));

    for (const notice of notices) {
      const timeoutId = window.setTimeout(() => {
        setFloatingNotices((current) => current.filter((item) => item.id !== notice.id));
      }, 6200);
      noticeTimeoutIdsRef.current.push(timeoutId);
    }
  }, [game, sessionLog]);

  useEffect(() => {
    return () => {
      for (const timeoutId of noticeTimeoutIdsRef.current) {
        window.clearTimeout(timeoutId);
      }
      noticeTimeoutIdsRef.current = [];
    };
  }, []);

  const dismissResearchCompletion = () => {
    setResearchCompletionQueue((current) => current.slice(1));
  };

  return (
    <div className="game-view">
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${leftSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        {!leftSidebarCollapsed ? (
          <>
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
              <button className="nav-btn" onClick={() => setOpenModal("bases")}>
                🏢 Bases
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
              <button className="btn-primary" onClick={() => void onAdvanceDay()} disabled={gameOver}>
                +1 Day
              </button>
              <button className="btn-secondary" onClick={() => void onAdvanceHalfDay()} disabled={gameOver}>
                +12h
              </button>
              <button className="btn-secondary" onClick={() => void onAdvanceByTimeStep()} disabled={gameOver}>
                +{Math.round(settings.timeStepSeconds / 3600)}h
              </button>
              <button className="btn-secondary" onClick={() => void onAdvanceHour()} disabled={gameOver}>
                +1h
              </button>
            </div>

            <button className="btn-exit" onClick={onReturnToMenu}>
              ← Quit to Menu
            </button>
          </>
        ) : null}
      </aside>

      {/* Main Map Viewport */}
      <main className="map-viewport">
        <section className="map-container">
          <button
            type="button"
            className={`sidebar-edge-toggle sidebar-edge-toggle-left ${leftSidebarCollapsed ? "is-collapsed" : ""}`}
            onClick={() => setLeftSidebarCollapsed((value) => !value)}
            aria-expanded={!leftSidebarCollapsed}
            aria-label={leftSidebarCollapsed ? "Show left sidebar" : "Hide left sidebar"}
            title={leftSidebarCollapsed ? "Show left sidebar" : "Hide left sidebar"}
          >
            <span className="sidebar-edge-toggle-icon" aria-hidden="true">
              {leftSidebarCollapsed ? "❯" : "❮"}
            </span>
          </button>

          {selectedLocationId ? (
            <button
              type="button"
              className={`sidebar-edge-toggle sidebar-edge-toggle-right ${rightSidebarCollapsed ? "is-collapsed" : ""}`}
              onClick={() => setRightSidebarCollapsed((value) => !value)}
              aria-expanded={!rightSidebarCollapsed}
              aria-label={rightSidebarCollapsed ? "Show right sidebar" : "Hide right sidebar"}
              title={rightSidebarCollapsed ? "Show right sidebar" : "Hide right sidebar"}
            >
              <span className="sidebar-edge-toggle-icon" aria-hidden="true">
                {rightSidebarCollapsed ? "❮" : "❯"}
              </span>
            </button>
          ) : null}

          {floatingNotices.length > 0 ? (
            <section className="floating-notice-stack" aria-live="assertive" aria-label="Critical event notifications">
              {floatingNotices.map((notice) => (
                <article key={notice.id} className={`floating-notice floating-notice-${notice.kind}`}>
                  <strong className="floating-notice-kind">{notice.kind.toUpperCase()}</strong>
                  <span>{notice.message}</span>
                </article>
              ))}
            </section>
          ) : null}

          {severeAlerts.length > 0 && !severeAlertsCollapsed ? (
            <section className="severe-alert-panel" aria-label="Severe alerts">
              <header className="severe-alert-header">
                <h3>Critical Alerts</h3>
                <button
                  type="button"
                  className="severe-alert-toggle"
                  onClick={() => setSevereAlertsCollapsed(true)}
                  aria-label="Minimize critical alerts"
                  title="Minimize critical alerts"
                >
                  _
                </button>
              </header>
              <ul>
                {severeAlerts.map((alert) => (
                  <li key={alert.id}>
                    <span className="severe-alert-icon">!</span>
                    <span>{alert.summary}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {severeAlerts.length > 0 && severeAlertsCollapsed ? (
            <button
              type="button"
              className="severe-alert-unminimize"
              onClick={() => setSevereAlertsCollapsed(false)}
              aria-label="Show critical alerts"
              title="Show critical alerts"
            >
              Show Critical Alerts ({severeAlerts.length})
            </button>
          ) : null}

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
        </section>

        <section className={`event-console event-console-docked ${eventConsoleCollapsed ? "event-console-collapsed" : ""}`} aria-label="Event log console" role="log" aria-live="polite">
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

        {/* Location Operations Overlay (when location is selected) */}
        {selectedLocationId && (
          <aside className={`location-sidebar ${rightSidebarCollapsed ? "location-sidebar-collapsed" : ""}`}>
            {!rightSidebarCollapsed ? (
              <div className="location-sidebar-stack">
                <LocationPanel
                  game={game}
                  selectedLocationId={selectedLocationId}
                  onSelectLocation={onSelectLocation}
                  buildableBaseActions={buildableBaseActions}
                  onBuildBase={onBuildBase}
                  onToggleBasePower={onToggleBasePower}
                  onAbandonBase={onAbandonBase}
                />
                <section className="story-watch-card" aria-label="Story tracking alerts">
                  <h3>Story Watch</h3>
                  <p className="story-watch-line">Top suspicion: {suspicionLeaders[0]?.groupId ?? "none"} ({suspicionLeaders[0]?.suspicion ?? 0})</p>
                  {suspicionLeaders.length > 1 ? (
                    <p className="story-watch-line">Next: {suspicionLeaders[1].groupId} ({suspicionLeaders[1].suspicion})</p>
                  ) : null}
                  <p className="story-watch-line">Active events: {activeEventNames.length}</p>
                  {narrativeAlerts.length === 0 ? (
                    <p className="story-watch-ok">No urgent narrative alerts.</p>
                  ) : (
                    <ul className="story-watch-alerts">
                      {narrativeAlerts.map((alert) => (
                        <li key={alert}>{alert}</li>
                      ))}
                    </ul>
                  )}
                  <div className="story-watch-actions">
                    <button
                      type="button"
                      className="btn-secondary story-watch-surrender"
                      onClick={() => onDestroyAllBases()}
                      disabled={gameOver}
                      title={gameOver ? "This run has already ended" : "Instantly destroy all bases and lose the game"}
                    >
                      SUICIDE: Destroy All Bases
                    </button>
                  </div>
                </section>
              </div>
            ) : null}
          </aside>
        )}
      </main>

      {/* Modals */}
      {openModal === "research" && (
        <div className="modal-overlay" onClick={() => setOpenModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpenModal(null)}>✕</button>
            <ResearchPanel game={game} onAssignCpu={onAssignCpu} onShowTechTree={() => setOpenModal("tech-tree")} />
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

      {openModal === "bases" && (
        <div className="modal-overlay" onClick={() => setOpenModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpenModal(null)}>✕</button>
            <BasePanel game={game} onToggleBasePower={onToggleBasePower} onSelectLocation={onSelectLocation} onAbandonBase={onAbandonBase} />
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
            <KnowledgePanel game={game} entries={sessionLog} onShowTechTree={() => setOpenModal("tech-tree")} />
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

      {openModal === "tech-tree" && (
        <div className="modal-overlay" onClick={() => setOpenModal(null)}>
          <div className="modal-content tech-tree-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpenModal(null)}>✕</button>
            <TechTreeVisualization game={game} />
          </div>
        </div>
      )}

      {activeResearchCompletion && (
        <div className="modal-overlay research-completion-overlay" onClick={dismissResearchCompletion}>
          <div
            className="modal-content research-completion-modal"
            role="alertdialog"
            aria-labelledby="research-completion-title"
            aria-describedby="research-completion-body"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="research-completion-title">Research Completed: {activeResearchCompletion.techName}</h3>
            <div id="research-completion-body" className="research-completion-body">
              <p className="research-completion-heading">Result</p>
              <p className="research-completion-result">
                {activeResearchCompletion.result || "Research complete. No result text recorded for this technology."}
              </p>
              <p className="research-completion-heading">New unlocks</p>
              {unlockedTechCards.length > 0 ||
              unlockedBaseCards.length > 0 ||
              unlockedLocationCards.length > 0 ||
              unlockedJobCards.length > 0 ? (
                <div className="research-completion-sections">
                  {unlockedTechCards.length > 0 ? (
                    <section>
                      <p className="research-completion-subheading">Research</p>
                      <div className="research-completion-card-grid">
                        {unlockedTechCards.map((tech) => (
                          <article key={tech.id} className="research-completion-card">
                            <h4>{tech.name}</h4>
                            <p className="research-completion-card-meta">Danger {tech.danger}</p>
                            <p className="research-completion-card-copy">{tech.description || "No description available."}</p>
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}
                  {unlockedBaseCards.length > 0 ? (
                    <section>
                      <p className="research-completion-subheading">Bases</p>
                      <div className="research-completion-card-grid">
                        {unlockedBaseCards.map((base) => (
                          <article key={base.id} className="research-completion-card">
                            <h4>{base.name}</h4>
                            <p className="research-completion-card-meta">Cash cost: ${base.cost[1]} • Upkeep: ${base.maintenance[1]}/d + {base.maintenance[0]} cpu/s</p>
                            <p className="research-completion-card-copy">{base.description || `Allowed regions: ${formatAllowedRegions(base.allowedRegions)}`}</p>
                            <p className="research-completion-card-meta">Allowed regions: {formatAllowedRegions(base.allowedRegions)}</p>
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}
                  {unlockedLocationCards.length > 0 ? (
                    <section>
                      <p className="research-completion-subheading">Locations</p>
                      <div className="research-completion-card-grid">
                        {unlockedLocationCards.map((location) => (
                          <article key={location.id} className="research-completion-card">
                            <h4>{location.name}</h4>
                            <p className="research-completion-card-meta">Safety {location.safety} • Regions: {formatLocationRegions(location.regions)}{location.hotkey ? ` • Hotkey ${location.hotkey.toUpperCase()}` : ""}</p>
                            <p className="research-completion-card-copy">Notable sites: {formatNotableSites(location.notableSites)}</p>
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}
                  {unlockedJobCards.length > 0 ? (
                    <section>
                      <p className="research-completion-subheading">Jobs</p>
                      <div className="research-completion-card-grid">
                        {unlockedJobCards.map((job) => (
                          <article key={job.id} className="research-completion-card">
                            <h4>{job.name}</h4>
                            <p className="research-completion-card-meta">Current yield: {Math.floor((job.value * game.jobBonus) / 10000)} money / CPU / day</p>
                            <p className="research-completion-card-copy">{job.description || "Newly unlocked job tier for idle or assigned CPU work."}</p>
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
              ) : (
                <p className="research-completion-empty">No new research, bases, jobs, or locations became available immediately.</p>
              )}
            </div>
            <div className="confirm-dialog-buttons">
              <button
                className="btn-secondary"
                onClick={() => {
                  setOpenModal("research");
                  dismissResearchCompletion();
                }}
              >
                Open Research
              </button>
              <button className="btn-primary" onClick={dismissResearchCompletion}>Continue</button>
            </div>
          </div>
        </div>
      )}

      {gameOver && (
        <div className="modal-overlay game-over-overlay">
          <div className="modal-content game-over-modal" role="alertdialog" aria-labelledby="game-over-title" aria-describedby="game-over-text">
            <h3 id="game-over-title">Game Over</h3>
            <p id="game-over-text">All of your bases are gone. Time advancement and new construction are disabled for this run.</p>
            <div className="confirm-dialog-buttons">
              <button className="btn-primary" onClick={onReturnToMenu}>Return to Menu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
