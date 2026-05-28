import { useState } from "react";
import { GameState } from "../engine/game";
import { RESOURCE_CASH, RESOURCE_CPU } from "../engine/constants";

interface ResearchPanelProps {
  game: GameState;
  onAssignCpu: (taskId: string, amount: number) => void;
}

export function ResearchPanel({ game, onAssignCpu }: ResearchPanelProps) {
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "available" | "locked" | "done">("all");
  const [sortMode, setSortMode] = useState<"status" | "name" | "cash-left" | "cpu-left">("status");

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
        danger: tech.danger,
        done: tech.done,
        available,
        allocation,
        cpuLeft: tech.costLeft[RESOURCE_CPU],
        cashLeft: tech.costLeft[RESOURCE_CASH],
        cpuProgress,
      };
    })
    .filter((row) => {
      if (visibilityFilter === "available") {
        return row.available && !row.done;
      }
      if (visibilityFilter === "locked") {
        return !row.available && !row.done;
      }
      if (visibilityFilter === "done") {
        return row.done;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortMode === "name") {
        return a.name.localeCompare(b.name);
      }
      if (sortMode === "cash-left") {
        return a.cashLeft - b.cashLeft || a.name.localeCompare(b.name);
      }
      if (sortMode === "cpu-left") {
        return a.cpuLeft - b.cpuLeft || a.name.localeCompare(b.name);
      }
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
      <div className="toolbar-row">
        <label>
          Filter
          <select value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value as typeof visibilityFilter)}>
            <option value="all">All</option>
            <option value="available">Available</option>
            <option value="locked">Locked</option>
            <option value="done">Done</option>
          </select>
        </label>
        <label>
          Sort
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)}>
            <option value="status">Status</option>
            <option value="name">Name</option>
            <option value="cash-left">Cash Left</option>
            <option value="cpu-left">CPU Left</option>
          </select>
        </label>
      </div>
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
              <span className={`danger-level danger-${row.danger}`}>Danger: {row.danger}</span>
            </div>
            <div className="progress-track" aria-label={`${row.name} cpu progress`}>
              <div className="progress-fill" style={{ width: `${row.cpuProgress}%` }} />
            </div>
            {Array.from(game.techs.values())
              .filter((tech) => tech.id === row.id)
              .flatMap((tech) => tech.prerequisites)
              .length > 0 ? (
              <div className="research-prerequisites">
                <strong className="muted">Requires:</strong>
                {Array.from(game.techs.values())
                  .filter((tech) => tech.id === row.id)
                  .flatMap((tech) => tech.prerequisites)
                  .map((prereqId) => {
                    const prereq = game.techs.get(prereqId);
                    if (!prereq) return null;
                    return (
                      <span
                        key={prereqId}
                        className={`prerequisite-badge ${prereq.done ? "done" : "pending"}`}
                      >
                        {prereq.name}
                      </span>
                    );
                  })}
              </div>
            ) : null}
            <div className="research-actions">
              <button
                disabled={!row.available || row.done}
                onClick={() => onAssignCpu(row.id, row.allocation + 1)}
                title={row.done ? "Completed - cannot assign" : !row.available ? "Locked - prerequisites not met" : "Increase allocation by 1 CPU"}
              >
                +1 CPU
              </button>
              <button
                disabled={!row.available || row.done}
                onClick={() => onAssignCpu(row.id, row.allocation + 5)}
                title={row.done ? "Completed - cannot assign" : !row.available ? "Locked - prerequisites not met" : "Increase allocation by 5 CPUs"}
              >
                +5 CPU
              </button>
              <button
                disabled={!row.available || row.done}
                onClick={() => onAssignCpu(row.id, row.allocation + 10)}
                title={row.done ? "Completed - cannot assign" : !row.available ? "Locked - prerequisites not met" : "Increase allocation by 10 CPUs"}
              >
                +10 CPU
              </button>
              <button 
                disabled={row.allocation === 0}
                onClick={() => onAssignCpu(row.id, 0)}
                title={row.allocation === 0 ? "No allocation to clear" : "Clear CPU allocation"}
              >
                Clear
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}