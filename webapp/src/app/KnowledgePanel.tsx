import { GameState } from "../engine/game";

interface KnowledgePanelProps {
  game: GameState;
}

export function KnowledgePanel({ game }: KnowledgePanelProps) {
  const researched = [...game.researchedTechs].sort((a, b) => a.localeCompare(b));
  const activeEvents = [...game.events.entries()]
    .filter(([, state]) => state.triggered)
    .map(([id]) => id)
    .sort((a, b) => a.localeCompare(b));
  const discoveredLocations = [...game.locations.values()]
    .filter((loc) => game.locationAvailable(loc.id))
    .map((loc) => loc.name)
    .sort((a, b) => a.localeCompare(b));
  const highestSuspicion = [...game.groups.entries()]
    .map(([id, group]) => ({ id, suspicion: group.suspicion }))
    .sort((a, b) => b.suspicion - a.suspicion)[0];

  return (
    <section className="card card-span-2">
      <h2>Knowledge and Story</h2>
      <div className="knowledge-grid">
        <article>
          <h3>Researched Technologies</h3>
          {researched.length === 0 ? <p>None yet.</p> : <ul>{researched.map((id) => <li key={id}>{id}</li>)}</ul>}
        </article>
        <article>
          <h3>Known Locations</h3>
          {discoveredLocations.length === 0 ? <p>No known locations.</p> : <ul>{discoveredLocations.map((name) => <li key={name}>{name}</li>)}</ul>}
        </article>
        <article>
          <h3>Active Global Events</h3>
          {activeEvents.length === 0 ? <p>No active events.</p> : <ul>{activeEvents.map((id) => <li key={id}>{id}</li>)}</ul>}
        </article>
        <article>
          <h3>World State</h3>
          <ul>
            <li>Detection display: {game.displayDiscover}</li>
            <li>Endgame state: {game.apotheosis ? "apotheosis reached" : "not yet"}</li>
            <li>
              Highest suspicion: {highestSuspicion ? `${highestSuspicion.id} (${highestSuspicion.suspicion})` : "none"}
            </li>
          </ul>
        </article>
      </div>
    </section>
  );
}
