import { RESOURCE_CASH, RESOURCE_CPU } from "../engine/constants";
import { GameState } from "../engine/game";

interface BasePanelProps {
  game: GameState;
  onToggleBasePower: (baseId: string) => void;
}

export function BasePanel({ game, onToggleBasePower }: BasePanelProps) {
  const bases = [...game.bases].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="card card-span-2">
      <h2>Base Management</h2>
      {bases.length === 0 ? (
        <p>No bases available.</p>
      ) : (
        <div className="base-table">
          <div className="base-table-head">Name</div>
          <div className="base-table-head">Location</div>
          <div className="base-table-head">CPU</div>
          <div className="base-table-head">Maint</div>
          <div className="base-table-head">Power</div>
          <div className="base-table-head">Actions</div>
          {bases.map((base) => {
            const spec = game.baseDefs.get(base.specId);
            const location = game.locations.get(base.locationId);
            const maintenanceCash = spec?.maintenance[RESOURCE_CASH] ?? 0;
            const maintenanceCpu = spec?.maintenance[RESOURCE_CPU] ?? 0;
            return (
              <div key={base.id} className="base-table-row">
                <div>{base.name}</div>
                <div>{location?.name ?? base.locationId}</div>
                <div>{base.cpuProvided}</div>
                <div>${maintenanceCash}/d + {maintenanceCpu} cpu/s</div>
                <div>{base.powerState}</div>
                <div>
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
