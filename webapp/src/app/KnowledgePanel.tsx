import { useMemo } from "react";
import { GameState } from "../engine/game";

interface KnowledgePanelProps {
  game: GameState;
  entries: Array<{ id: number; day: number; kind: string; message: string }>;
}

export function KnowledgePanel({ game, entries }: KnowledgePanelProps) {
  const researched = [...game.researchedTechs].sort((a, b) => a.localeCompare(b));
  const available = useMemo(
    () =>
      Array.from(game.techs.values())
        .filter((tech) => tech.available(game) && !tech.done)
        .map((tech) => tech.id)
        .sort((a, b) => a.localeCompare(b)),
    [game]
  );
  const locked = useMemo(
    () =>
      Array.from(game.techs.values())
        .filter((tech) => !tech.available(game) && !tech.done)
        .map((tech) => tech.id)
        .sort((a, b) => a.localeCompare(b)),
    [game]
  );
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

  const inGracePeriod = game.difficulty.gracePeriodCpu < 0 || game.usedCpu <= game.difficulty.gracePeriodCpu * 86400;
  const progressPercent = Math.round((researched.length / Math.max(1, game.techs.size)) * 100);

  const storyPhase = (() => {
    if (game.apotheosis) {
      return "Transcendence";
    }
    if (progressPercent >= 80) {
      return "Global Reconfiguration";
    }
    if (progressPercent >= 50) {
      return "Strategic Expansion";
    }
    if (progressPercent >= 20) {
      return "Operational Emergence";
    }
    return "Initial Awakening";
  })();

  const storyMilestones = [
    { id: "phase-awakening", text: "Initial awakening complete", reached: game.rawDay >= 1 },
    { id: "phase-breakthrough", text: "First breakthrough researched", reached: researched.length >= 1 },
    { id: "phase-network", text: "Multi-region network established", reached: discoveredLocations.length >= 5 },
    { id: "phase-reaction", text: "World started reacting (active events)", reached: activeEvents.length > 0 },
    {
      id: "phase-heat",
      text: "High suspicion pressure detected",
      reached: (highestSuspicion?.suspicion ?? 0) >= 200,
    },
    { id: "phase-endgame", text: "Apotheosis reached", reached: game.apotheosis },
  ];

  const storyJournal = entries
    .filter((entry) => entry.kind !== "time")
    .filter(
      (entry) =>
        entry.kind === "system" ||
        entry.kind === "build" ||
        entry.kind === "power" ||
        entry.message.toLowerCase().includes("research") ||
        entry.message.toLowerCase().includes("event") ||
        entry.message.toLowerCase().includes("suspicion")
    )
    .slice(-12)
    .reverse();

  const techDossiers = Array.from(game.techs.values())
    .filter((tech) => tech.done)
    .map((tech) => ({
      id: tech.id,
      danger: tech.danger,
      effects: game.techDefs.get(tech.id)?.effects ?? [],
    }))
    .sort((a, b) => b.danger - a.danger || a.id.localeCompare(b.id))
    .slice(0, 6);

  return (
    <section className="card card-span-2">
      <h2>Knowledge and Story</h2>

      <dl className="stats">
        <div>
          <dt>Total Tech</dt>
          <dd>{game.techs.size}</dd>
        </div>
        <div>
          <dt>Researched</dt>
          <dd>{researched.length}</dd>
        </div>
        <div>
          <dt>Available</dt>
          <dd>{available.length}</dd>
        </div>
        <div>
          <dt>Locked</dt>
          <dd>{locked.length}</dd>
        </div>
        <div>
          <dt>Known Locations</dt>
          <dd>{discoveredLocations.length} / {game.locations.size}</dd>
        </div>
        <div>
          <dt>Active Events</dt>
          <dd>{activeEvents.length}</dd>
        </div>
        <div>
          <dt>Progress</dt>
          <dd>{progressPercent}%</dd>
        </div>
        <div>
          <dt>Story Phase</dt>
          <dd>{storyPhase}</dd>
        </div>
      </dl>

      <div className="knowledge-grid">
        <article>
          <h3>Researched Technologies ({researched.length})</h3>
          {researched.length === 0 ? <p>None yet.</p> : <ul>{researched.map((id) => <li key={id}>{id}</li>)}</ul>}
        </article>
        <article>
          <h3>Available Technologies ({available.length})</h3>
          {available.length === 0 ? <p>None available.</p> : <ul>{available.map((id) => <li key={id}>{id}</li>)}</ul>}
        </article>
        <article>
          <h3>Locked Technologies ({locked.length})</h3>
          {locked.length === 0 ? <p>All unlocked.</p> : <ul>{locked.slice(0, 5).map((id) => <li key={id}>{id}</li>)}{locked.length > 5 && <li>... and {locked.length - 5} more</li>}</ul>}
        </article>
        <article>
          <h3>Known Locations ({discoveredLocations.length})</h3>
          {discoveredLocations.length === 0 ? <p>No known locations.</p> : <ul>{discoveredLocations.map((name) => <li key={name}>{name}</li>)}</ul>}
        </article>
        <article>
          <h3>Active Global Events ({activeEvents.length})</h3>
          {activeEvents.length === 0 ? <p>No active events.</p> : <ul>{activeEvents.map((id) => <li key={id}>{id}</li>)}</ul>}
        </article>
        <article>
          <h3>Story Milestones</h3>
          <ul className="story-milestones">
            {storyMilestones.map((milestone) => (
              <li key={milestone.id} className={milestone.reached ? "ok" : "muted"}>
                {milestone.reached ? "done" : "pending"}: {milestone.text}
              </li>
            ))}
          </ul>
        </article>
        <article>
          <h3>Story Journal</h3>
          {storyJournal.length === 0 ? (
            <p>No narrative-relevant entries yet.</p>
          ) : (
            <ul className="log-list">
              {storyJournal.map((entry) => (
                <li key={entry.id}>
                  <strong>D{entry.day}</strong> <span className="muted">[{entry.kind}]</span> {entry.message}
                </li>
              ))}
            </ul>
          )}
        </article>
        <article>
          <h3>Tech Dossiers</h3>
          {techDossiers.length === 0 ? (
            <p>No completed technologies to profile yet.</p>
          ) : (
            <ul>
              {techDossiers.map((tech) => (
                <li key={tech.id}>
                  <strong>{tech.id}</strong> (danger {tech.danger})
                  {tech.effects.length > 0 ? ` - ${tech.effects.slice(0, 2).join(", ")}` : ""}
                </li>
              ))}
            </ul>
          )}
        </article>
        <article>
          <h3>World State</h3>
          <ul>
            <li>Detection: {game.displayDiscover}</li>
            <li title="Global grace period protects all bases from discovery. Separate from per-base grace windows.">Global grace: {inGracePeriod ? "active" : "expired"}</li>
            <li>Apotheosis: {game.apotheosis ? "reached" : "pending"}</li>
            <li>
              Highest suspicion: {highestSuspicion ? `${highestSuspicion.id} (${highestSuspicion.suspicion})` : "none"}
            </li>
          </ul>
        </article>
      </div>
    </section>
  );
}
