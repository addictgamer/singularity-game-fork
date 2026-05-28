import { useMemo, useState } from "react";
import { GameState } from "../engine/game";
import { RESOURCE_LABOR } from "../engine/constants";

interface LocationBuildAction {
  id: string;
  label: string;
  cashCost: number;
  maintenanceCash: number;
  maintenanceCpu: number;
}

interface LocationPanelProps {
  game: GameState;
  selectedLocationId: string;
  onSelectLocation: (locationId: string) => void;
  buildableBaseActions: LocationBuildAction[];
  onBuildBase: (baseId: string) => void;
  onToggleBasePower: (baseId: string) => void;
  onAbandonBase: (baseId: string) => boolean;
}

export function LocationPanel({
  game,
  selectedLocationId,
  onSelectLocation,
  buildableBaseActions,
  onBuildBase,
  onToggleBasePower,
  onAbandonBase,
}: LocationPanelProps) {
  const [abandonConfirmBaseId, setAbandonConfirmBaseId] = useState<string | null>(null);
  const locationBases = game.getBasesAtLocation(selectedLocationId);
  const canAbandonAnyBase = game.bases.filter((base) => base.done).length > 1 && !game.gameOver;
  const maintenance = game.getMaintenanceSnapshot();
  const atRisk = new Set(maintenance.atRiskBaseIds);

  const graceRemainingMinutes = (baseId: string): number | null => {
    const base = locationBases.find((entry) => entry.id === baseId);
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

  const riskBreakdown = useMemo(() => {
    return {
      total: locationBases.length,
      atRisk: locationBases.filter((base) => atRisk.has(base.id)).length,
      inGrace: locationBases.filter((base) => !base.graceOver).length,
    };
  }, [locationBases, atRisk]);

  return (
    <section className="card">
      <h2>Location Operations</h2>
      <label htmlFor="location-select">Location</label>
      <select
        id="location-select"
        value={selectedLocationId}
        onChange={(event) => onSelectLocation(event.target.value)}
      >
        {Array.from(game.locations.values()).map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </select>

      <p className="muted">
        Available: {game.locationAvailable(selectedLocationId) ? "yes" : "no"}
      </p>

      {maintenance.cashDeficit || maintenance.cpuDeficit ? (
        <p className="warning">
          Upkeep pressure is high. {riskBreakdown.atRisk > 0
            ? `${riskBreakdown.atRisk} base(s) at this location are in the sleep-risk queue.`
            : "This location is not first in the sleep-risk queue."}
        </p>
      ) : null}

      {locationBases.length > 0 ? (
        <dl className="stats">
          <div>
            <dt>Bases Here</dt>
            <dd>{riskBreakdown.total}</dd>
          </div>
          <div>
            <dt>At Risk</dt>
            <dd>{riskBreakdown.atRisk}</dd>
          </div>
          <div title="Bases still within their personal grace window (not affected by global grace period)">
            <dt>In Grace Window</dt>
            <dd>{riskBreakdown.inGrace}</dd>
          </div>
        </dl>
      ) : null}

      <h3>Buildable Bases</h3>
      {buildableBaseActions.length === 0 ? (
        <p>No build options available at current tech/cash/location state.</p>
      ) : (
        <div className="actions">
          {buildableBaseActions.map((base) => (
            <button key={base.id} onClick={() => onBuildBase(base.id)}>
              Build {base.label} (${base.cashCost})
              <span className="button-subline">Upkeep ${base.maintenanceCash}/d + {base.maintenanceCpu} cpu/s</span>
            </button>
          ))}
        </div>
      )}

      <h3>Bases Here</h3>
      {locationBases.length === 0 ? (
        <p>No bases at this location yet.</p>
      ) : (
        <ul className="location-bases-list">
          {locationBases.map((base) => {
            const graceLeft = graceRemainingMinutes(base.id);
            return (
              <li key={base.id} className="location-base-card">
                <div className="location-base-header">
                  <strong>{base.name}</strong>
                  <span className="muted">({base.specId})</span>
                </div>
                <div className="location-base-details">
                  <span>CPU: {base.cpuProvided}</span>
                  <span className={`status-chip ${base.powerState === "active" ? "active" : "sleep"}`}>
                    {base.powerState}
                  </span>
                  <span className="grace-badge" title="This base's personal grace window (independent of global grace period)">
                    {graceLeft === null ? "grace window expired" : `${graceLeft}m grace left`}
                  </span>
                  {atRisk.has(base.id) ? (
                    <span className="risk-badge high">risk: high</span>
                  ) : (
                    <span className="risk-badge low">risk: low</span>
                  )}
                </div>
                <button
                  className="inline-action"
                  onClick={() => onToggleBasePower(base.id)}
                  title={`Toggle power (currently ${base.powerState})`}
                >
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
              </li>
            );
          })}
        </ul>
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