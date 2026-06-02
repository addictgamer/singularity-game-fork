import { useEffect, useMemo, useState } from "react";
import { GameState } from "../engine/game";
import { RESOURCE_CASH, RESOURCE_CPU, SECONDS_PER_DAY } from "../engine/constants";

interface TechTreeVisualizationProps {
  game: GameState;
  onAssignCpu: (taskId: string, amount: number) => void;
}

interface LayoutNode {
  id: string;
  name: string;
  description: string;
  done: boolean;
  available: boolean;
  danger: number;
  allocation: number;
  cpuLeft: number;
  cashLeft: number;
  cpuTotal: number;
  cashTotal: number;
  cashNotApplicable: boolean;
  cpuProgressPercent: number;
  cashProgressPercent: number;
  etaDays: number | null;
  waitingOnCash: boolean;
  layer: number;
  prerequisites: string[];
  dependents: string[];
  x: number;
  y: number;
}

interface Edge {
  fromId: string;
  toId: string;
}

interface LayoutMetrics {
  cardWidth: number;
  cardHeight: number;
  layerGap: number;
  rowGap: number;
  padding: number;
}

const LAYOUT_NORMAL: LayoutMetrics = {
  cardWidth: 300,
  cardHeight: 190,
  layerGap: 110,
  rowGap: 42,
  padding: 36,
};

const LAYOUT_COMPACT: LayoutMetrics = {
  cardWidth: 252,
  cardHeight: 172,
  layerGap: 76,
  rowGap: 30,
  padding: 28,
};

const DANGEROUS_THRESHOLD = 1;

export function TechTreeVisualization({ game, onAssignCpu }: TechTreeVisualizationProps) {
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [detailTechId, setDetailTechId] = useState<string | null>(null);
  const [allocationInputs, setAllocationInputs] = useState<Record<string, string>>({});

  // GameState is mutable, so use snapshots of mutable tech/cpu fields to invalidate memoized UI data.
  const techStateSnapshot = Array.from(game.techs.values())
    .map((tech) => `${tech.id}:${tech.done ? 1 : 0}:${tech.costLeft[RESOURCE_CPU]}:${tech.costLeft[RESOURCE_CASH]}`)
    .join("|");
  const cpuUsageSnapshot = Array.from(game.cpuUsage.entries())
    .map(([taskId, amount]) => `${taskId}:${amount}`)
    .join("|");

  const totalAvailableCpu = Math.max(0, game.availableCpus[0]);
  const totalAllocatedCpu = Array.from(game.cpuUsage.entries()).reduce((sum, [taskId, amount]) => {
    if (taskId === "cpu_pool") {
      return sum;
    }
    return sum + Math.max(0, amount);
  }, 0);
  const freeCpu = Math.max(0, totalAvailableCpu - totalAllocatedCpu);

  const { nodes, edges, canvasWidth, canvasHeight, unlockedByTechId, compactMode, layout } = useMemo(() => {
    const layers = new Map<string, number>();
    const inStack = new Set<string>();

    const calculateLayer = (techId: string): number => {
      const existing = layers.get(techId);
      if (existing !== undefined) {
        return existing;
      }
      if (inStack.has(techId)) {
        return 0;
      }

      inStack.add(techId);
      const tech = game.techs.get(techId);
      if (!tech || tech.prerequisites.length === 0) {
        layers.set(techId, 0);
        inStack.delete(techId);
        return 0;
      }

      const maxPrereqLayer = Math.max(
        ...tech.prerequisites.map((prereqId) => calculateLayer(prereqId))
      );
      const layer = maxPrereqLayer + 1;
      layers.set(techId, layer);
      inStack.delete(techId);
      return layer;
    };

    for (const tech of game.techs.values()) {
      calculateLayer(tech.id);
    }

    const layerGroups = new Map<number, string[]>();
    for (const [techId, layer] of layers) {
      if (!layerGroups.has(layer)) {
        layerGroups.set(layer, []);
      }
      layerGroups.get(layer)!.push(techId);
    }

    for (const ids of layerGroups.values()) {
      ids.sort((a, b) => {
        const aTech = game.techs.get(a);
        const bTech = game.techs.get(b);
        const aDanger = aTech?.danger ?? 0;
        const bDanger = bTech?.danger ?? 0;
        if (aDanger !== bDanger) {
          return aDanger - bDanger;
        }
        return (aTech?.name ?? "").localeCompare(bTech?.name ?? "");
      });
    }

    const maxLayer = Math.max(0, ...Array.from(layerGroups.keys()));
    const maxRows = Math.max(1, ...Array.from(layerGroups.values()).map((entries) => entries.length));
    const compactMode = game.techs.size >= 24 || maxRows >= 7 || maxLayer >= 7;
    const layout = compactMode ? LAYOUT_COMPACT : LAYOUT_NORMAL;
    const canvasWidth =
      layout.padding * 2 + (maxLayer + 1) * layout.cardWidth + maxLayer * layout.layerGap;
    const canvasHeight =
      layout.padding * 2 + maxRows * layout.cardHeight + (maxRows - 1) * layout.rowGap;

    const unlockedByTechId = new Map<string, string[]>();
    for (const tech of game.techs.values()) {
      for (const prereqId of tech.prerequisites) {
        const unlocked = unlockedByTechId.get(prereqId) ?? [];
        unlocked.push(tech.id);
        unlockedByTechId.set(prereqId, unlocked);
      }
    }
    for (const unlocked of unlockedByTechId.values()) {
      unlocked.sort((a, b) => {
        const aName = game.techs.get(a)?.name ?? a;
        const bName = game.techs.get(b)?.name ?? b;
        return aName.localeCompare(bName);
      });
    }

    const nodes: LayoutNode[] = [];
    for (const [layer, techIds] of Array.from(layerGroups.entries()).sort((a, b) => a[0] - b[0])) {
      const count = techIds.length;
      const columnHeight = count * layout.cardHeight + Math.max(0, count - 1) * layout.rowGap;
      const yStart =
        layout.padding + Math.max(0, (canvasHeight - layout.padding * 2 - columnHeight) / 2);
      const x = layout.padding + layer * (layout.cardWidth + layout.layerGap);

      techIds.forEach((techId, index) => {
        const tech = game.techs.get(techId);
        if (!tech) {
          return;
        }

        const def = game.techDefs.get(techId);
        const allocation = game.getAllocatedCpuFor(techId);
        const cpuLeft = Math.max(0, Math.ceil(tech.costLeft[RESOURCE_CPU]));
        const cashLeft = Math.max(0, Math.ceil(tech.costLeft[RESOURCE_CASH]));
        const cpuTotal = Math.max(0, tech.totalCost[RESOURCE_CPU]);
        const cashTotal = Math.max(0, tech.totalCost[RESOURCE_CASH]);
        const cashNotApplicable = cashTotal <= 0;
        const cpuProgressPercent =
          cpuTotal > 0
            ? Math.max(0, Math.min(100, Math.round((1 - cpuLeft / cpuTotal) * 100)))
            : 100;
        const cashProgressPercent =
          cashTotal > 0
            ? Math.max(0, Math.min(100, Math.round((1 - cashLeft / cashTotal) * 100)))
            : 100;
        const hasCpuEta = allocation > 0 && cpuLeft > 0;
        const etaDays = hasCpuEta ? cpuLeft / (allocation * SECONDS_PER_DAY) : null;
        const waitingOnCash = cpuLeft <= 0 && cashLeft > 0;

        nodes.push({
          id: techId,
          name: tech.name,
          description: def?.description || "No narrative description available.",
          done: tech.done,
          available: tech.available(game),
          danger: tech.danger,
          allocation,
          cpuLeft,
          cashLeft,
          cpuTotal,
          cashTotal,
          cashNotApplicable,
          cpuProgressPercent,
          cashProgressPercent,
          etaDays,
          waitingOnCash,
          layer,
          prerequisites: tech.prerequisites,
          dependents: unlockedByTechId.get(techId) ?? [],
          x,
          y: yStart + index * (layout.cardHeight + layout.rowGap),
        });
      });
    }

    const edges: Edge[] = [];
    for (const node of nodes) {
      for (const prereqId of node.prerequisites) {
        edges.push({ fromId: prereqId, toId: node.id });
      }
    }

    return { nodes, edges, canvasWidth, canvasHeight, unlockedByTechId, compactMode, layout };
  }, [game, techStateSnapshot, cpuUsageSnapshot]);

  const nodeMap = useMemo(() => {
    return new Map(nodes.map((node) => [node.id, node]));
  }, [nodes]);

  const detailTech = detailTechId ? game.techs.get(detailTechId) ?? null : null;
  const detailTechDef = detailTechId ? game.techDefs.get(detailTechId) ?? null : null;
  const detailNode = detailTechId ? nodeMap.get(detailTechId) ?? null : null;
  const detailUnlocks = detailTechId ? unlockedByTechId.get(detailTechId) ?? [] : [];

  const getNodeState = (
    node: LayoutNode
  ): "done" | "in-progress" | "paused" | "locked" | "danger" | "danger-locked" | "available" => {
    if (node.done) {
      return "done";
    }
    if (node.allocation > 0) {
      return "in-progress";
    }
    const startedPreviously =
      node.cpuProgressPercent > 0 || (!node.cashNotApplicable && node.cashProgressPercent > 0);
    if (startedPreviously) {
      return "paused";
    }
    if (node.danger >= DANGEROUS_THRESHOLD) {
      if (!node.available) {
        return "danger-locked";
      }
      return "danger";
    }
    if (!node.available) {
      return "locked";
    }
    return "available";
  };

  const describeEta = (node: LayoutNode): string => {
    if (node.done) {
      return "Complete";
    }
    if (node.waitingOnCash) {
      return "Waiting on cash";
    }
    if (node.etaDays === null) {
      return "No CPU assigned";
    }
    return `${node.etaDays.toFixed(1)} days`;
  };

  const detailDependents = detailNode?.dependents ?? [];

  const describeNodeState = (
    state: "done" | "in-progress" | "paused" | "locked" | "danger" | "danger-locked" | "available"
  ): string => {
    if (state === "done") {
      return "Done";
    }
    if (state === "in-progress") {
      return "In Progress";
    }
    if (state === "paused") {
      return "Paused";
    }
    if (state === "locked") {
      return "Locked";
    }
    if (state === "danger-locked") {
      return "Danger Locked";
    }
    if (state === "danger") {
      return "Dangerous";
    }
    return "Unlocked";
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetailTechId(null);
      }
    };

    if (detailTechId) {
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }

    return undefined;
  }, [detailTechId]);

  useEffect(() => {
    if (!detailNode) {
      return;
    }

    setAllocationInputs((current) => {
      if (current[detailNode.id] !== undefined) {
        return current;
      }
      return {
        ...current,
        [detailNode.id]: String(detailNode.allocation),
      };
    });
  }, [detailNode]);

  return (
    <section className={`card card-span-2 tech-tree-screen${compactMode ? " compact" : ""}`}>
      <h2>Technology Tree</h2>
      <p className="muted">
        Click a tech to inspect what it requires and what it unlocks. Colors: in-progress yellow, paused amber, locked gray, dangerous (locked or unlocked) red, complete green.
      </p>
      <div className="tech-tree-legend" aria-label="Technology status legend">
        <span className="legend-chip in-progress">In Progress</span>
        <span className="legend-chip paused">Paused</span>
        <span className="legend-chip locked">Locked</span>
        <span className="legend-chip danger">Dangerous</span>
        <span className="legend-chip done">Done</span>
      </div>

      <div className="tech-tree-viewport">
        <div className="tech-tree-stage" style={{ width: canvasWidth, height: canvasHeight }}>
          <svg className="tech-tree-edges" viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} aria-hidden="true">
            {edges.map((edge) => {
              const fromNode = nodeMap.get(edge.fromId);
              const toNode = nodeMap.get(edge.toId);
              if (!fromNode || !toNode) {
                return null;
              }
              const fromX = fromNode.x + layout.cardWidth;
              const fromY = fromNode.y + layout.cardHeight / 2;
              const toX = toNode.x;
              const toY = toNode.y + layout.cardHeight / 2;
              const curve = Math.max(40, (toX - fromX) * 0.45);
              const path = `M ${fromX} ${fromY} C ${fromX + curve} ${fromY}, ${toX - curve} ${toY}, ${toX} ${toY}`;
              const selected = selectedTechId !== null && (selectedTechId === edge.fromId || selectedTechId === edge.toId);

              return (
                <g key={`${edge.fromId}->${edge.toId}`}>
                  <path
                    d={path}
                    className={selected ? "tech-tree-edge-halo selected" : "tech-tree-edge-halo"}
                  />
                  <path
                    d={path}
                    className={selected ? "tech-tree-edge selected" : "tech-tree-edge"}
                  />
                </g>
              );
            })}
          </svg>

          {nodes.map((node) => {
            const nodeState = getNodeState(node);
            const isSelected = selectedTechId === node.id;
            return (
              <button
                key={node.id}
                type="button"
                className={`tech-card ${nodeState}${isSelected ? " selected" : ""}`}
                style={{ left: node.x, top: node.y, width: layout.cardWidth, minHeight: layout.cardHeight }}
                onClick={() => {
                  setSelectedTechId(node.id);
                  setDetailTechId(node.id);
                }}
                title={node.name}
              >
                <header className="tech-card-head">
                  <h3>{node.name}</h3>
                </header>

                <div className="tech-card-badges">
                  <span className={`tech-card-status ${nodeState}`}>{describeNodeState(nodeState)}</span>
                  <span className="tech-card-danger">Danger {node.danger}</span>
                </div>

                <p className="tech-card-description">{node.description}</p>

                <div className="tech-card-metrics">
                  <p>Assigned CPU {node.allocation} • ETA {describeEta(node)}</p>
                  <p>Requires {node.prerequisites.length} • Unlocks {node.dependents.length}</p>
                </div>

                <div className="tech-card-progress-stack" aria-hidden="true">
                  <div className="tech-progress-row">
                    <span className="tech-progress-label">CPU</span>
                    <span className="tech-progress-track">
                      <span className="tech-progress-fill cpu" style={{ width: `${node.cpuProgressPercent}%` }} />
                    </span>
                    <span className="tech-progress-value">{node.cpuProgressPercent}%</span>
                  </div>
                  <div className="tech-progress-row">
                    <span className="tech-progress-label">Cash</span>
                    <span className="tech-progress-track">
                      <span
                        className="tech-progress-fill cash"
                        style={{ width: node.cashNotApplicable ? "0%" : `${node.cashProgressPercent}%` }}
                      />
                    </span>
                    <span className="tech-progress-value">{node.cashNotApplicable ? "N/A" : `${node.cashProgressPercent}%`}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {detailTech && detailNode && (
        <div className="tech-node-modal-overlay" onClick={() => setDetailTechId(null)}>
          <section
            className="tech-node-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tech-node-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="tech-node-modal-close"
              onClick={() => setDetailTechId(null)}
              aria-label="Close tech details"
            >
              ✕
            </button>
            <h3 id="tech-node-modal-title">{detailTech.name}</h3>
            <p className="muted tech-node-free-cpu">Idle CPUs available for research: {freeCpu}</p>
            <div className="tech-detail-content">
              <dl>
                <dt>Status</dt>
                <dd>
                  {detailTech.done
                    ? "Done"
                    : detailNode.allocation > 0
                        ? "In progress"
                        : detailNode.cpuProgressPercent > 0 || detailNode.cashProgressPercent > 0
                          ? "Paused"
                          : detailNode.danger >= DANGEROUS_THRESHOLD && !detailNode.available
                            ? "Dangerous locked"
                          : detailNode.danger >= DANGEROUS_THRESHOLD
                          ? "Dangerous unlocked"
                          : !detailNode.available
                            ? "Locked"
                          : "Unlocked"}
                </dd>

                <dt>Danger Level</dt>
                <dd>
                  <span className={`danger-level danger-${detailTech.danger}`}>
                    {detailTech.danger}
                  </span>
                </dd>

                <dt>Progress</dt>
                <dd>
                  CPU {detailNode.cpuProgressPercent}% ({detailNode.cpuLeft} left) • {detailNode.cashNotApplicable ? "Cash N/A" : `Cash ${detailNode.cashProgressPercent}% (${detailNode.cashLeft} left)`}
                </dd>

                <dt>Tracking</dt>
                <dd>Assigned CPU {detailNode.allocation} • ETA {describeEta(detailNode)}</dd>

                {detailTechDef?.description && (
                  <>
                    <dt>Description</dt>
                    <dd className="tech-description">{detailTechDef.description}</dd>
                  </>
                )}

                {detailTech.done && detailTechDef?.result && (
                  <>
                    <dt>Result</dt>
                    <dd className="tech-description">{detailTechDef.result}</dd>
                  </>
                )}

                {detailTech.prerequisites.length > 0 && (
                  <>
                    <dt>Requires</dt>
                    <dd>
                      {detailTech.prerequisites
                        .map((id) => game.techs.get(id)?.name ?? id)
                        .join(", ")}
                    </dd>
                  </>
                )}

                {detailTechId && (
                  <>
                    <dt>Unlocks</dt>
                    <dd>
                      {detailUnlocks
                        .map((techId) => game.techs.get(techId)?.name ?? techId)
                        .join(", ") || "No direct unlocks"}
                    </dd>
                  </>
                )}

                {detailDependents.length > 0 && (
                  <>
                    <dt>Dependents</dt>
                    <dd>
                      {detailDependents.map((techId) => game.techs.get(techId)?.name ?? techId).join(", ")}
                    </dd>
                  </>
                )}
              </dl>
            </div>
            {(() => {
              const maxAllocForRow = Math.max(0, totalAvailableCpu - (totalAllocatedCpu - detailNode.allocation));
              const canIncrease = detailNode.available && !detailNode.done;
              const canDecrease = detailNode.available && !detailNode.done && detailNode.allocation > 0;
              const canAssignDelta = (delta: number) => canIncrease && detailNode.allocation + delta <= maxAllocForRow;
              const blockedByBudget = !detailNode.done && detailNode.available && detailNode.allocation >= maxAllocForRow;
              const exactInputValue = allocationInputs[detailNode.id] ?? String(detailNode.allocation);
              const exactTarget = Number.parseInt(exactInputValue, 10);
              const canSetExact =
                detailNode.available &&
                !detailNode.done &&
                Number.isFinite(exactTarget) &&
                exactTarget >= 0 &&
                exactTarget <= maxAllocForRow &&
                exactTarget !== detailNode.allocation;

              return (
                <div className="tech-node-research-controls">
                  <h4>Research Allocation Controls</h4>
                  <div className="research-actions">
                    <button
                      disabled={!canDecrease}
                      onClick={() => {
                        onAssignCpu(detailNode.id, Math.max(0, detailNode.allocation - 1));
                        setAllocationInputs((current) => ({
                          ...current,
                          [detailNode.id]: String(Math.max(0, detailNode.allocation - 1)),
                        }));
                      }}
                      title={detailNode.allocation === 0 ? "No allocation to reduce" : "Decrease allocation by 1 CPU"}
                    >
                      -1 CPU
                    </button>
                    <button
                      disabled={!canAssignDelta(1)}
                      onClick={() => {
                        onAssignCpu(detailNode.id, detailNode.allocation + 1);
                        setAllocationInputs((current) => ({
                          ...current,
                          [detailNode.id]: String(detailNode.allocation + 1),
                        }));
                      }}
                      title={
                        detailNode.done
                          ? "Completed - cannot assign"
                          : !detailNode.available
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
                      onClick={() => {
                        onAssignCpu(detailNode.id, detailNode.allocation + 5);
                        setAllocationInputs((current) => ({
                          ...current,
                          [detailNode.id]: String(detailNode.allocation + 5),
                        }));
                      }}
                      title={
                        detailNode.done
                          ? "Completed - cannot assign"
                          : !detailNode.available
                            ? "Locked - prerequisites not met"
                            : detailNode.allocation + 5 > maxAllocForRow
                              ? "Not enough free CPU"
                              : "Increase allocation by 5 CPUs"
                      }
                    >
                      +5 CPU
                    </button>
                    <button
                      disabled={!canAssignDelta(10)}
                      onClick={() => {
                        onAssignCpu(detailNode.id, detailNode.allocation + 10);
                        setAllocationInputs((current) => ({
                          ...current,
                          [detailNode.id]: String(detailNode.allocation + 10),
                        }));
                      }}
                      title={
                        detailNode.done
                          ? "Completed - cannot assign"
                          : !detailNode.available
                            ? "Locked - prerequisites not met"
                            : detailNode.allocation + 10 > maxAllocForRow
                              ? "Not enough free CPU"
                              : "Increase allocation by 10 CPUs"
                      }
                    >
                      +10 CPU
                    </button>
                    <button
                      disabled={!canIncrease || detailNode.allocation >= maxAllocForRow}
                      onClick={() => {
                        onAssignCpu(detailNode.id, maxAllocForRow);
                        setAllocationInputs((current) => ({
                          ...current,
                          [detailNode.id]: String(maxAllocForRow),
                        }));
                      }}
                      title={
                        detailNode.done
                          ? "Completed - cannot assign"
                          : !detailNode.available
                            ? "Locked - prerequisites not met"
                            : detailNode.allocation >= maxAllocForRow
                              ? "Already at max for current budget"
                              : "Assign all currently available CPU to this technology"
                      }
                    >
                      Max CPU
                    </button>
                    <button
                      disabled={detailNode.allocation === 0}
                      onClick={() => {
                        onAssignCpu(detailNode.id, 0);
                        setAllocationInputs((current) => ({
                          ...current,
                          [detailNode.id]: "0",
                        }));
                      }}
                      title={detailNode.allocation === 0 ? "No allocation to clear" : "Clear CPU allocation"}
                    >
                      Clear
                    </button>
                  </div>
                  <div className="research-exact-assign tech-node-exact-assign">
                    <label htmlFor={`tech-tree-exact-${detailNode.id}`}>Set CPU</label>
                    <input
                      id={`tech-tree-exact-${detailNode.id}`}
                      type="number"
                      min={0}
                      max={maxAllocForRow}
                      step={1}
                      value={exactInputValue}
                      disabled={!detailNode.available || detailNode.done}
                      onChange={(event) =>
                        setAllocationInputs((current) => ({
                          ...current,
                          [detailNode.id]: event.target.value,
                        }))
                      }
                      aria-label={`Set CPU allocation for ${detailNode.name}`}
                    />
                    <button
                      disabled={!canSetExact}
                      onClick={() => {
                        onAssignCpu(detailNode.id, exactTarget);
                        setAllocationInputs((current) => ({
                          ...current,
                          [detailNode.id]: String(exactTarget),
                        }));
                      }}
                      title={
                        !detailNode.available
                          ? "Locked - prerequisites not met"
                          : detailNode.done
                            ? "Completed - cannot assign"
                            : !Number.isFinite(exactTarget)
                              ? "Enter a whole CPU amount"
                              : exactTarget > maxAllocForRow
                                ? "Not enough free CPU"
                                : exactTarget < 0
                                  ? "CPU cannot be negative"
                                  : exactTarget === detailNode.allocation
                                    ? "Already at this allocation"
                                    : "Apply exact CPU allocation"
                      }
                    >
                      Set
                    </button>
                  </div>
                </div>
              );
            })()}
          </section>
        </div>
      )}
    </section>
  );
}
