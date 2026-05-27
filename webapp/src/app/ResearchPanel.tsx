import { GameState } from "../engine/game";
import { RESOURCE_CASH, RESOURCE_CPU } from "../engine/constants";

interface ResearchPanelProps {
  game: GameState;
  onAssignCpu: (taskId: string, amount: number) => void;
}

export function ResearchPanel({ game, onAssignCpu }: ResearchPanelProps) {
  const techRows = Array.from(game.techs.values())
    .map((tech) => {
      const available = tech.available(game);
      const allocation = game.getAllocatedCpuFor(tech.id);
      const cpuProgress =
        tech.totalCost[RESOURCE_CPU] > 0
          ? Math.max(
              0,
              100 - Math.round((100 * tech.costLeft[RESOURCE_CPU]) / tech.totalCost[RESOURCE_CPU])
            )
          : 100;
      return {
        id: tech.id,
        name: tech.name,
        done: tech.done,
        available,
        allocation,
        cpuLeft: tech.costLeft[RESOURCE_CPU],
        cashLeft: tech.costLeft[RESOURCE_CASH],
        cpuProgress,
      };
    })
    .sort((a, b) => {
      const aRank = a.done ? 2 : a.available ? 0 : 1;
      const bRank = b.done ? 2 : b.available ? 0 : 1;
      if (aRank !== bRank) {
        return aRank - bRank;
      }
      return a.name.localeCompare(b.name);
    });

  return (
    <section className="card card-span-2">
      <h2>Research</h2>
      <p className="muted">
        Available technologies can receive CPU allocation. Completed techs are read-only.
      </p>
      <div className="research-list">
        {techRows.map((row) => (
          <article key={row.id} className={`research-row ${row.done ? "done" : row.available ? "available" : "locked"}`}>
            <header>
              <strong>{row.name}</strong>
              <span className="muted">
                {row.done ? "done" : row.available ? "available" : "locked"}
              </span>
            </header>
            <div className="research-metrics">
              <span>CPU left: {row.cpuLeft}</span>
              <span>Cash left: {row.cashLeft}</span>
              <span>CPU assigned: {row.allocation}</span>
            </div>
            <div className="progress-track" aria-label={`${row.name} cpu progress`}>
              <div className="progress-fill" style={{ width: `${row.cpuProgress}%` }} />
            </div>
            <div className="research-actions">
              <button
                disabled={!row.available || row.done}
                onClick={() => onAssignCpu(row.id, 1)}
              >
                Assign 1 CPU
              </button>
              <button disabled={row.done} onClick={() => onAssignCpu(row.id, 0)}>
                Clear
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}