import { useMemo, useState } from "react";
import { RESOURCE_CASH, RESOURCE_CPU, RESOURCE_LABOR } from "../engine/constants";
import { GameState } from "../engine/game";

interface BasePanelProps {
  game: GameState;
  onToggleBasePower: (baseId: string) => void;
  onSelectLocation: (locationId: string) => void;
  onAbandonBase: (baseId: string) => boolean;
}

export function BasePanel({ game, onToggleBasePower, onSelectLocation, onAbandonBase }: BasePanelProps) {
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [powerFilter, setPowerFilter] = useState<string>("all");
  const [abandonConfirmBaseId, setAbandonConfirmBaseId] = useState<string | null>(null);
  const bases = [...game.bases].sort((a, b) => a.name.localeCompare(b.name));
  const maintenance = game.getMaintenanceSnapshot();
  const atRisk = new Set(maintenance.atRiskBaseIds);

  const locationFilters = useMemo(
    () => ["all", ...new Set(bases.map((base) => base.locationId))],
    [bases]
  );

  const rows = useMemo(
    () =>
      bases
        .filter((base) => (locationFilter === "all" ? true : base.locationId === locationFilter))
        .filter((base) => (powerFilter === "all" ? true : base.powerState === powerFilter)),
    [bases, locationFilter, powerFilter]
  );

  const activeCount = rows.filter((base) => base.powerState === "active").length;
  const sleepingCount = rows.filter((base) => base.powerState === "sleep").length;
  const totalCpu = rows.reduce((sum, base) => sum + base.cpuProvided, 0);
  const canAbandonAnyBase = game.bases.filter((base) => base.done).length > 1 && !game.gameOver;

  const filteredMaintenance = rows.reduce(
    (acc, base) => {
      const spec = game.baseDefs.get(base.specId);
      if (!spec || base.powerState !== "active") {
        return acc;
      }
      acc.cash += spec.maintenance[RESOURCE_CASH] ?? 0;
      acc.cpu += spec.maintenance[RESOURCE_CPU] ?? 0;
      return acc;
    },
    { cash: 0, cpu: 0 }
  );

  const graceRemainingMinutes = (baseId: string): number | null => {
    const base = game.bases.find((entry) => entry.id === baseId);
    if (!base || base.graceOver) {
      return null;
    }
    const definition = game.baseDefs.get(base.specId);
    if (!definition) {
      return null;
    }
    const age = game.rawMin - (base.startedAtMin ?? 0);
    const graceWindow = (definition.cost[RESOURCE_LABOR] * game.difficulty.baseGraceMultiplier) / 10000;
    if (age >= graceWindow) {
      return null;
    }
    return Math.max(0, Math.ceil(graceWindow - age));
  };

  return (
    <section className="card card-span-2">
      <h2>Base Management</h2>
      <div className="toolbar-row">
        <label>
          Location
          <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
            {locationFilters.map((locationId) => {
              const locationName = game.locations.get(locationId)?.name;
              return (
                <option key={locationId} value={locationId}>
                  {locationId === "all" ? "all" : locationName ?? locationId}
                </option>
              );
            })}
          </select>
        </label>
        <label>
          Power
          <select value={powerFilter} onChange={(event) => setPowerFilter(event.target.value)}>
            <option value="all">all</option>
            <option value="active">active</option>
            <option value="sleep">sleep</option>
          </select>
        </label>
      </div>

      <dl className="stats">
        <div title="Total bases matching current filters">
          <dt>Visible Bases</dt>
          <dd>{rows.length}</dd>
        </div>
        <div title="Bases currently generating CPU and performing jobs">
          <dt>Power Active</dt>
          <dd>{activeCount}</dd>
        </div>
        <div title="Bases in sleep mode (not performing jobs, not detected)">
          <dt>Power Sleep</dt>
          <dd>{sleepingCount}</dd>
        </div>
        <div title="Total CPU provided by visible, active bases">
          <dt>Visible CPU</dt>
          <dd>{totalCpu}</dd>
        </div>
        <div title="Daily cash maintenance cost for visible, active bases">
          <dt>Visible Maint Cash</dt>
          <dd>${filteredMaintenance.cash}</dd>
        </div>
        <div title="Continuous CPU maintenance drain for visible, active bases">
          <dt>Visible Maint CPU</dt>
          <dd>{filteredMaintenance.cpu}</dd>
        </div>
      </dl>

      {maintenance.cashDeficit || maintenance.cpuDeficit ? (
        <p className="warning">
          Next-day maintenance deficit detected. Highest risk bases: {maintenance.atRiskBaseIds.slice(0, 3).join(", ") || "none"}.
        </p>
      ) : (
        <p className="ok">No maintenance deficit projected for the next day.</p>
      )}

      {bases.length === 0 ? (
        <p>No bases available.</p>
      ) : (
        <div className="base-table">
          <div className="base-table-header-row" role="row">
            <div className="base-table-head">Name</div>
            <div className="base-table-head">Location</div>
            <div className="base-table-head">CPU</div>
            <div className="base-table-head" title="Daily cash and CPU cost to keep this base running">Maint</div>
            <div className="base-table-head" title="Active = generating CPU and vulnerable to detection. Sleep = hidden but not productive.">Power</div>
            <div className="base-table-head" title="Per-base grace window (independent of global grace period). Each base has a grace period after construction based on its cost.">Grace Window</div>
            <div className="base-table-head" title="Risk: High = high suspicion from at least one group. Low = manageable threat level.">Risk</div>
            <div className="base-table-head">Actions</div>
          </div>
          {rows.map((base) => {
            const spec = game.baseDefs.get(base.specId);
            const location = game.locations.get(base.locationId);
            const maintenanceCash = spec?.maintenance[RESOURCE_CASH] ?? 0;
            const maintenanceCpu = spec?.maintenance[RESOURCE_CPU] ?? 0;
            const graceLeft = graceRemainingMinutes(base.id);
            return (
              <div key={base.id} className="base-table-row">
                <div className={atRisk.has(base.id) ? "warning" : ""}>{base.name}</div>
                <div>{location?.name ?? base.locationId}</div>
                <div title={`CPU from this base: ${base.cpuProvided}`}>{base.cpuProvided}</div>
                <div title={`Daily: $${maintenanceCash}, Continuous: ${maintenanceCpu} cpu/s`}>${maintenanceCash}/d + {maintenanceCpu} cpu/s</div>
                <div title={base.powerState === "active" ? "Active: generating CPU and vulnerable to detection" : "Sleep: hidden and safe but not productive"}>
                  <span className={`status-chip ${base.powerState === "active" ? "active" : "sleep"}`}>
                    {base.powerState}
                  </span>
                </div>
                <div title="Time remaining in this base's personal grace window. Global grace period is separate.">{graceLeft === null ? "—" : `${graceLeft}m`}</div>
                <div title={atRisk.has(base.id) ? "High risk: this base may be targeted for forced sleep by suspicion-based events" : "Low risk: this base is not currently prioritized for destruction"}>{atRisk.has(base.id) ? "high" : "low"}</div>
                <div className="stacked-actions">
                  <button className="inline-action" onClick={() => onSelectLocation(base.locationId)}>
                    Focus
                  </button>
                  <button className="inline-action" onClick={() => onToggleBasePower(base.id)}>
                    {base.powerState === "active" ? "Set Sleep" : "Wake"}
                  </button>
                  <button
                    className="inline-action"
                    onClick={() => setAbandonConfirmBaseId(base.id)}
                    disabled={!canAbandonAnyBase}
                    title={canAbandonAnyBase ? "Permanently abandon this base" : "You cannot abandon your last remaining base"}
                  >
                    Abandon
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {abandonConfirmBaseId && (
        <div className="confirm-dialog-overlay" onClick={() => setAbandonConfirmBaseId(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>Are you sure you want to permanently abandon this base? This cannot be undone.</p>
            <div className="confirm-dialog-buttons">
              <button className="btn-primary" onClick={() => {
                onAbandonBase(abandonConfirmBaseId);
                setAbandonConfirmBaseId(null);
              }}>
                Yes, Abandon
              </button>
              <button className="btn-secondary" onClick={() => setAbandonConfirmBaseId(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
