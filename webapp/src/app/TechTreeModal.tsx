import { GameState } from "../engine/game";

interface TechTreeModalProps {
  game: GameState;
}

export function TechTreeModal({ game }: TechTreeModalProps) {
  const techArray = Array.from(game.techs.values()).sort((a, b) => a.name.localeCompare(b.name));

  // Group techs by danger level
  const techsByDanger = new Map<number, typeof techArray>();
  for (const tech of techArray) {
    const list = techsByDanger.get(tech.danger) ?? [];
    list.push(tech);
    techsByDanger.set(tech.danger, list);
  }

  const dangerLevels = Array.from(techsByDanger.keys()).sort((a, b) => a - b);

  return (
    <section className="card card-span-2">
      <h2>Technology Tree</h2>
      <p className="muted">Technologies grouped by danger level. Green = researched, blue = available, gray = locked.</p>
      <div className="tech-tree-container">
        {dangerLevels.map((danger) => {
          const techs = techsByDanger.get(danger) ?? [];
          const researched = techs.filter((t) => t.done);
          const available = techs.filter((t) => t.available(game) && !t.done);
          const locked = techs.filter((t) => !t.available(game) && !t.done);

          return (
            <div key={danger} className="tech-tree-danger-level">
              <h3 className="tech-tree-danger-header">Danger Level {danger}</h3>
              <div className="tech-tree-section">
                {researched.length > 0 && (
                  <div className="tech-tree-category">
                    <p className="tech-tree-category-label researched">Researched ({researched.length})</p>
                    <div className="tech-tree-nodes">
                      {researched.map((tech) => (
                        <div
                          key={tech.id}
                          className="tech-node researched"
                          title={`${tech.name}\n${tech.prerequisites.length > 0 ? "Requires: " + tech.prerequisites.join(", ") : "No prerequisites"}`}
                        >
                          {tech.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {available.length > 0 && (
                  <div className="tech-tree-category">
                    <p className="tech-tree-category-label available">Available ({available.length})</p>
                    <div className="tech-tree-nodes">
                      {available.map((tech) => (
                        <div
                          key={tech.id}
                          className="tech-node available"
                          title={`${tech.name}\nRequires: ${tech.prerequisites.join(", ") || "None"}`}
                        >
                          {tech.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {locked.length > 0 && (
                  <div className="tech-tree-category">
                    <p className="tech-tree-category-label locked">Locked ({locked.length})</p>
                    <div className="tech-tree-nodes">
                      {locked.map((tech) => (
                        <div
                          key={tech.id}
                          className="tech-node locked"
                          title={`${tech.name}\nRequires: ${tech.prerequisites.join(", ")}`}
                        >
                          {tech.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
