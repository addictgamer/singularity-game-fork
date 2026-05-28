import { GameState } from "../engine/game";

interface ReportsPanelProps {
  game: GameState;
  entries: Array<{ id: number; day: number; kind: string; message: string }>;
}

export function ReportsPanel({ game, entries }: ReportsPanelProps) {
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

  const activityByKind = entries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.kind] = (acc[entry.kind] ?? 0) + 1;
    return acc;
  }, {});
  const activityRows = Object.entries(activityByKind).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const recentByDay = entries
    .reduce<Record<number, number>>((acc, entry) => {
      acc[entry.day] = (acc[entry.day] ?? 0) + 1;
      return acc;
    }, {})
;
  const recentDays = Object.entries(recentByDay)
    .map(([day, count]) => ({ day: Number.parseInt(day, 10), count }))
    .sort((a, b) => b.day - a.day)
    .slice(0, 7);

  const highestSuspicionGroups = [...game.groups.entries()]
    .map(([id, group]) => ({ id, suspicion: group.suspicion }))
    .sort((a, b) => b.suspicion - a.suspicion)
    .slice(0, 3);

  const activeEvents = [...game.events.entries()]
    .filter(([, event]) => event.triggered)
    .map(([id]) => id)
    .sort((a, b) => a.localeCompare(b));

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

      <h3>Activity Breakdown</h3>
      {activityRows.length === 0 ? (
        <p>No session activity recorded yet.</p>
      ) : (
        <ul className="base-list">
          {activityRows.map(([kind, count]) => (
            <li key={kind}>
              {kind}: {count}
            </li>
          ))}
        </ul>
      )}

      <h3>Recent Activity Timeline</h3>
      {recentDays.length === 0 ? (
        <p>No recent day activity available.</p>
      ) : (
        <ul className="base-list">
          {recentDays.map((row) => (
            <li key={row.day}>
              Day {row.day}: {row.count} log event(s)
            </li>
          ))}
        </ul>
      )}

      <h3>Detection and Event Watch</h3>
      <div className="knowledge-grid">
        <article>
          <h4>Highest Suspicion Groups</h4>
          {highestSuspicionGroups.length === 0 ? (
            <p>No suspicion data.</p>
          ) : (
            <ul>
              {highestSuspicionGroups.map((group) => (
                <li key={group.id}>
                  {group.id}: {group.suspicion}
                </li>
              ))}
            </ul>
          )}
        </article>
        <article>
          <h4>Active Global Events</h4>
          {activeEvents.length === 0 ? (
            <p>No active events.</p>
          ) : (
            <ul>
              {activeEvents.map((eventId) => (
                <li key={eventId}>{eventId}</li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}