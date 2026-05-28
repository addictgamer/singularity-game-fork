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

  const cpuAssignments = Array.from(game.cpuUsage.entries())
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const atRiskBaseDetails = maintenance.atRiskBaseIds.slice(0, 5).reduce<
    Array<{ id: string; name: string; location: string; powerState: "active" | "sleep" | "offline" }>
  >((acc, baseId) => {
    const base = game.bases.find((entry) => entry.id === baseId);
    if (!base) {
      return acc;
    }
    const location = game.locations.get(base.locationId);
    acc.push({
      id: base.id,
      name: base.name,
      location: location?.name ?? base.locationId,
      powerState: base.powerState,
    });
    return acc;
  }, []);

  const netCashOutlook = future.jobs + future.interest - maintenance.cashMaintenance;
  const cpuHeadroom = game.effectiveCpuPool() - maintenance.cpuMaintenance;

  const eventDurations = activeEvents.map((eventId) => {
    const def = game.eventDefs.get(eventId);
    const state = game.events.get(eventId);
    if (!def || !state || def.durationDays === null) {
      return { eventId, remainingDays: null as number | null };
    }
    const elapsedDays = (game.rawSec - state.triggeredAtSec) / (24 * 60 * 60);
    return {
      eventId,
      remainingDays: Math.max(0, Math.ceil(def.durationDays - elapsedDays)),
    };
  });

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

      <h3>Operational Pressure</h3>
      {atRiskBaseDetails.length === 0 ? (
        <p className="ok">No high-risk bases currently flagged by maintenance queue.</p>
      ) : (
        <ul className="base-list">
          {atRiskBaseDetails.map((base) => (
            <li key={base.id}>
              {base.name} ({base.location}) - power {base.powerState}
            </li>
          ))}
        </ul>
      )}

      <h3>Resource Outlook</h3>
      <ul className="base-list">
        <li>
          Net cash outlook (next day):
          <strong className={netCashOutlook >= 0 ? "ok" : "warning"}> {netCashOutlook}</strong>
        </li>
        <li>
          CPU headroom after maintenance:
          <strong className={cpuHeadroom >= 0 ? "ok" : "warning"}> {cpuHeadroom}</strong>
        </li>
      </ul>

      <h3>CPU Allocation Detail</h3>
      {cpuAssignments.length === 0 ? (
        <p>No active CPU allocations recorded.</p>
      ) : (
        <ul className="base-list">
          {cpuAssignments.map(([taskId, amount]) => (
            <li key={taskId}>
              {taskId}: {amount}
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
          {eventDurations.length === 0 ? (
            <p>No active events.</p>
          ) : (
            <ul>
              {eventDurations.map((event) => (
                <li key={event.eventId}>
                  {event.eventId}
                  {event.remainingDays === null ? "" : ` (${event.remainingDays}d remaining)`}
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}