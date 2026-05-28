import { useMemo, useState } from "react";
import { RESOURCE_CASH, RESOURCE_CPU, RESOURCE_LABOR } from "../engine/constants";
import { GameState } from "../engine/game";

interface BasePanelProps {
  game: GameState;
  onToggleBasePower: (baseId: string) => void;
  onSelectLocation: (locationId: string) => void;
}

export function BasePanel({ game, onToggleBasePower, onSelectLocation }: BasePanelProps) {
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [powerFilter, setPowerFilter] = useState<string>("all");
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
        <div>
          <dt>Visible Bases</dt>
          <dd>{rows.length}</dd>
        </div>
        <div>
          <dt>Power Active</dt>
          <dd>{activeCount}</dd>
        </div>
        <div>
          <dt>Power Sleep</dt>
          <dd>{sleepingCount}</dd>
        </div>
        <div>
          <dt>Visible CPU</dt>
          <dd>{totalCpu}</dd>
        </div>
        <div>
          <dt>Visible Maint Cash</dt>
          <dd>{filteredMaintenance.cash}</dd>
        </div>
        <div>
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
            <div className="base-table-head">Maint</div>
            <div className="base-table-head">Power</div>
            <div className="base-table-head" title="Per-base grace window (independent of global grace period). Each base has a grace period after construction based on its cost.">Grace Window</div>
            <div className="base-table-head">Risk</div>
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
                <div>{base.cpuProvided}</div>
                <div>${maintenanceCash}/d + {maintenanceCpu} cpu/s</div>
                <div>
                  <span className={`status-chip ${base.powerState === "active" ? "active" : "sleep"}`}>
                    {base.powerState}
                  </span>
                </div>
                <div title="Time remaining in this base's personal grace window. Global grace period is separate.">{graceLeft === null ? "—" : `${graceLeft}m`}</div>
                <div>{atRisk.has(base.id) ? "high" : "low"}</div>
                <div className="stacked-actions">
                  <button className="inline-action" onClick={() => onSelectLocation(base.locationId)}>
                    Focus
                  </button>
                  <button className="inline-action" onClick={() => onToggleBasePower(base.id)}>
                    {base.powerState === "active" ? "Set Sleep" : "Wake"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
