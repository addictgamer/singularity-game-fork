import { GameState } from "../engine/game";

interface ReportsPanelProps {
  game: GameState;
}

export function ReportsPanel({ game }: ReportsPanelProps) {
  const researched = Array.from(game.techs.values()).filter((tech) => tech.done).length;
  const totalTech = game.techs.size;
  const availableLocations = Array.from(game.locations.keys()).filter((locationId) =>
    game.locationAvailable(locationId)
  ).length;
  const future = game.computeFutureResourceFlow();
  const maintenance = game.getMaintenanceSnapshot();
  const cpuAssigned = Array.from(game.cpuUsage.values()).reduce((sum, count) => sum + count, 0);

  const basesByLocation = Array.from(game.locations.values())
    .map((location) => ({
      id: location.id,
      name: location.name,
      count: game.getBasesAtLocation(location.id).length,
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return (
    <section className="card card-span-2">
      <h2>Reports</h2>
      <dl className="stats">
        <div>
          <dt>Researched Tech</dt>
          <dd>
            {researched} / {totalTech}
          </dd>
        </div>
        <div>
          <dt>Available Locations</dt>
          <dd>
            {availableLocations} / {game.locations.size}
          </dd>
        </div>
        <div>
          <dt>Bases</dt>
          <dd>{game.bases.length}</dd>
        </div>
        <div>
          <dt>CPU Assigned</dt>
          <dd>{cpuAssigned}</dd>
        </div>
        <div>
          <dt>Projected Cash (24h)</dt>
          <dd>{future.jobs}</dd>
        </div>
        <div>
          <dt>Interest Tick</dt>
          <dd>{future.interest}</dd>
        </div>
        <div>
          <dt>Daily Maintenance (Cash)</dt>
          <dd>{maintenance.cashMaintenance}</dd>
        </div>
        <div>
          <dt>Daily Maintenance (CPU)</dt>
          <dd>{maintenance.cpuMaintenance}</dd>
        </div>
      </dl>

      {maintenance.cashDeficit || maintenance.cpuDeficit ? (
        <p className="warning">
          Maintenance risk detected: {maintenance.cashDeficit ? "cash deficit" : ""}
          {maintenance.cashDeficit && maintenance.cpuDeficit ? ", " : ""}
          {maintenance.cpuDeficit ? "cpu deficit" : ""}. Bases likely to sleep first: {maintenance.atRiskBaseIds.slice(0, 3).join(", ") || "none"}.
        </p>
      ) : (
        <p className="ok">Maintenance outlook stable for next day.</p>
      )}

      <h3>Active Base Distribution</h3>
      {basesByLocation.length === 0 ? (
        <p>No active bases built yet.</p>
      ) : (
        <ul className="base-list">
          {basesByLocation.map((entry) => (
            <li key={entry.id}>
              {entry.name}: {entry.count}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}