import { GameState } from "../engine/game";

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
}

export function LocationPanel({
  game,
  selectedLocationId,
  onSelectLocation,
  buildableBaseActions,
  onBuildBase,
  onToggleBasePower,
}: LocationPanelProps) {
  const locationBases = game.getBasesAtLocation(selectedLocationId);
  const maintenance = game.getMaintenanceSnapshot();
  const locationRiskBases = locationBases.filter((base) =>
    maintenance.atRiskBaseIds.includes(base.id)
  );

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
          Upkeep pressure is high. {locationRiskBases.length > 0
            ? `${locationRiskBases.length} base(s) at this location are in the sleep-risk queue.`
            : "This location is not first in the sleep-risk queue."}
        </p>
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
        <ul className="base-list">
          {locationBases.map((base) => (
            <li key={base.id} className="base-row">
              <span>
                {base.name} ({base.specId}) - CPU {base.cpuProvided}
              </span>
              <button
                className="inline-action"
                onClick={() => onToggleBasePower(base.id)}
                title={`Toggle power (currently ${base.powerState})`}
              >
                {base.powerState === "active" ? "Set Sleep" : "Wake"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}