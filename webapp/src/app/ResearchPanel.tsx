import { useState } from "react";
import { GameState } from "../engine/game";
import { RESOURCE_CASH, RESOURCE_CPU } from "../engine/constants";

interface ResearchPanelProps {
  game: GameState;
  onAssignCpu: (taskId: string, amount: number) => void;
  onShowTechTree: () => void;
}

const SECONDS_PER_DAY = 86400;

function describeTechEffects(effects: string[]): string[] {
  const descriptions: string[] = [];

  for (let index = 0; index < effects.length; index += 1) {
    const action = effects[index];
    if (!action) {
      continue;
    }

    if (action === "interest") {
      descriptions.push(`Interest rate ${Number.parseInt(effects[index + 1] ?? "0", 10)}%`);
      index += 1;
    } else if (action === "income") {
      descriptions.push(`Passive income +${Number.parseInt(effects[index + 1] ?? "0", 10)}`);
      index += 1;
    } else if (action === "cost_labor") {
      descriptions.push(`Labor cost modifier ${Number.parseInt(effects[index + 1] ?? "0", 10)}`);
      index += 1;
    } else if (action === "job_profit") {
      descriptions.push(`Job profit +${Number.parseInt(effects[index + 1] ?? "0", 10)}%`);
      index += 1;
    } else if (action === "display_discover") {
      descriptions.push(`Detection status label becomes \"${effects[index + 1] ?? "unknown"}\"`);
      index += 1;
    } else if (action === "endgame") {
      descriptions.push("Unlocks apotheosis endgame state");
    } else if (action === "suspicion") {
      const who = effects[index + 1] ?? "unknown";
      const value = Number.parseInt(effects[index + 2] ?? "0", 10);
      if (who === "onetime") {
        descriptions.push(`One-time suspicion reduction across all groups: ${value}`);
      } else {
        descriptions.push(`Suspicion pressure modifier for ${who}: ${value}`);
      }
      index += 2;
    } else if (action === "discover") {
      const who = effects[index + 1] ?? "unknown";
      const value = Number.parseInt(effects[index + 2] ?? "0", 10);
      descriptions.push(`Base discovery modifier for ${who}: ${value}`);
      index += 2;
    }
  }

  return descriptions;
}

export function ResearchPanel({ game, onAssignCpu, onShowTechTree }: ResearchPanelProps) {
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "available" | "locked" | "done">("all");
  const [sortMode, setSortMode] = useState<"status" | "name" | "cash-left" | "cpu-left">("status");
  const [allocationInputs, setAllocationInputs] = useState<Record<string, string>>({});
  const totalAvailableCpu = Math.max(0, game.availableCpus[0]);
  const totalAllocatedCpu = Array.from(game.cpuUsage.entries()).reduce((sum, [taskId, amount]) => {
    if (taskId === "cpu_pool") {
      return sum;
    }
    return sum + Math.max(0, amount);
  }, 0);
  const freeCpu = Math.max(0, totalAvailableCpu - totalAllocatedCpu);

  const techById = new Map(Array.from(game.techs.values()).map((tech) => [tech.id, tech]));
  const unlocksByTech = new Map<string, string[]>();
  for (const tech of game.techs.values()) {
    for (const prereqId of tech.prerequisites) {
      const unlocked = unlocksByTech.get(prereqId) ?? [];
      unlocked.push(tech.name);
      unlocksByTech.set(prereqId, unlocked);
    }
  }

  const techRows = Array.from(game.techs.values())
    .map((tech) => {
      const available = tech.available(game);
      const allocation = game.getAllocatedCpuFor(tech.id);
      const prerequisites = tech.prerequisites
        .map((prereqId) => {
          const prereq = techById.get(prereqId);
          return prereq
            ? {
                id: prereqId,
                name: prereq.name,
                done: prereq.done,
              }
            : null;
        })
        .filter((item): item is { id: string; name: string; done: boolean } => item !== null);
      const description = game.techDefs.get(tech.id)?.description ?? "";
      const result = game.techDefs.get(tech.id)?.result ?? "";
      const unlocks = (unlocksByTech.get(tech.id) ?? []).sort((a, b) => a.localeCompare(b));
      const hasCpuEta = allocation > 0 && tech.costLeft[RESOURCE_CPU] > 0;
      const etaDays = hasCpuEta ? tech.costLeft[RESOURCE_CPU] / (allocation * SECONDS_PER_DAY) : null;
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
        prerequisites,
        description,
        result,
        unlocks,
        etaDays,
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
      <p
        className="muted"
        title="Idle CPUs will perform jobs and make money when they are not assigned to research."
      >
        Idle CPUs available for research: {freeCpu}
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
        <button onClick={onShowTechTree} title="View visual technology tree">📊 View Tech Tree</button>
      </div>
      <div className="research-list">
        {techRows.map((row) => {
          const maxAllocForRow = Math.max(0, totalAvailableCpu - (totalAllocatedCpu - row.allocation));
          const canIncrease = row.available && !row.done;
          const canDecrease = row.available && !row.done && row.allocation > 0;
          const canAssignDelta = (delta: number) => canIncrease && row.allocation + delta <= maxAllocForRow;
          const blockedByBudget = !row.done && row.available && row.allocation >= maxAllocForRow;
          const exactInputValue = allocationInputs[row.id] ?? String(row.allocation);
          const exactTarget = Number.parseInt(exactInputValue, 10);
          const canSetExact =
            row.available &&
            !row.done &&
            Number.isFinite(exactTarget) &&
            exactTarget >= 0 &&
            exactTarget <= maxAllocForRow &&
            exactTarget !== row.allocation;

          return (
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
              <span>
                ETA: {row.cashLeft > 0 ? "Awaiting cash" : row.etaDays === null ? "--" : `${row.etaDays.toFixed(1)} days`}
              </span>
              <span className={`danger-level danger-${row.danger}`}>Danger: {row.danger}</span>
            </div>
            <div className="progress-track" aria-label={`${row.name} cpu progress`}>
              <div className="progress-fill" style={{ width: `${row.cpuProgress}%` }} />
            </div>
            {row.prerequisites.length > 0 ? (
              <div className="research-prerequisites">
                <strong className="muted">Requires:</strong>
                {row.prerequisites.map((prereq) => (
                  <span
                    key={prereq.id}
                    className={`prerequisite-badge ${prereq.done ? "done" : "pending"}`}
                  >
                    {prereq.name}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="research-details">
              {row.description ? (
                <p className="research-detail-line">
                  <strong>Description:</strong> {row.description}
                </p>
              ) : null}
              {row.result ? (
                <p className="research-detail-line">
                  <strong>Result:</strong> {row.result}
                </p>
              ) : null}
              <p className="research-detail-line">
                <strong>Unlocks:</strong> {row.unlocks.length === 0 ? "No direct downstream tech unlocks." : row.unlocks.join(", ")}
              </p>
            </div>
            <div className="research-actions">
              <button
                disabled={!canDecrease}
                onClick={() => onAssignCpu(row.id, Math.max(0, row.allocation - 1))}
                title={row.allocation === 0 ? "No allocation to reduce" : "Decrease allocation by 1 CPU"}
              >
                -1 CPU
              </button>
              <button
                disabled={!canAssignDelta(1)}
                onClick={() => onAssignCpu(row.id, row.allocation + 1)}
                title={
                  row.done
                    ? "Completed - cannot assign"
                    : !row.available
                      ? "Locked - prerequisites not met"
                      : blockedByBudget
                        ? "Not enough free CPU"
                        : "Increase allocation by 1 CPU"
                }
              >
                +1 CPU
              </button>
              <button
                disabled={!canAssignDelta(5)}
                onClick={() => onAssignCpu(row.id, row.allocation + 5)}
                title={
                  row.done
                    ? "Completed - cannot assign"
                    : !row.available
                      ? "Locked - prerequisites not met"
                      : row.allocation + 5 > maxAllocForRow
                        ? "Not enough free CPU"
                        : "Increase allocation by 5 CPUs"
                }
              >
                +5 CPU
              </button>
              <button
                disabled={!canAssignDelta(10)}
                onClick={() => onAssignCpu(row.id, row.allocation + 10)}
                title={
                  row.done
                    ? "Completed - cannot assign"
                    : !row.available
                      ? "Locked - prerequisites not met"
                      : row.allocation + 10 > maxAllocForRow
                        ? "Not enough free CPU"
                        : "Increase allocation by 10 CPUs"
                }
              >
                +10 CPU
              </button>
              <button
                disabled={!canIncrease || row.allocation >= maxAllocForRow}
                onClick={() => onAssignCpu(row.id, maxAllocForRow)}
                title={
                  row.done
                    ? "Completed - cannot assign"
                    : !row.available
                      ? "Locked - prerequisites not met"
                      : row.allocation >= maxAllocForRow
                        ? "Already at max for current budget"
                        : "Assign all currently available CPU to this technology"
                }
              >
                Max CPU
              </button>
              <button 
                disabled={row.allocation === 0}
                onClick={() => onAssignCpu(row.id, 0)}
                title={row.allocation === 0 ? "No allocation to clear" : "Clear CPU allocation"}
              >
                Clear
              </button>
            </div>
            <div className="research-exact-assign">
              <label htmlFor={`research-exact-${row.id}`}>Set CPU</label>
              <input
                id={`research-exact-${row.id}`}
                type="number"
                min={0}
                max={maxAllocForRow}
                step={1}
                value={exactInputValue}
                disabled={!row.available || row.done}
                onChange={(event) =>
                  setAllocationInputs((current) => ({
                    ...current,
                    [row.id]: event.target.value,
                  }))
                }
                aria-label={`Set CPU allocation for ${row.name}`}
              />
              <button
                disabled={!canSetExact}
                onClick={() => {
                  onAssignCpu(row.id, exactTarget);
                  setAllocationInputs((current) => ({
                    ...current,
                    [row.id]: String(exactTarget),
                  }));
                }}
                title={
                  !row.available
                    ? "Locked - prerequisites not met"
                    : row.done
                      ? "Completed - cannot assign"
                      : !Number.isFinite(exactTarget)
                        ? "Enter a whole CPU amount"
                        : exactTarget > maxAllocForRow
                          ? "Not enough free CPU"
                          : exactTarget < 0
                            ? "CPU cannot be negative"
                            : exactTarget === row.allocation
                              ? "Already at this allocation"
                              : "Apply exact CPU allocation"
                }
              >
                Set
              </button>
            </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}