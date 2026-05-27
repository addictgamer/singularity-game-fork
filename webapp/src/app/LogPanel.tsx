import { useMemo, useState } from "react";

interface LogPanelProps {
  entries: Array<{ id: number; day: number; kind: string; message: string }>;
}

export function LogPanel({ entries }: LogPanelProps) {
  const [kindFilter, setKindFilter] = useState<string>("all");
  const kinds = useMemo(() => ["all", ...new Set(entries.map((entry) => entry.kind))], [entries]);
  const rows = useMemo(
    () => [...entries].reverse().filter((entry) => (kindFilter === "all" ? true : entry.kind === kindFilter)),
    [entries, kindFilter]
  );

  return (
    <section className="card card-span-2">
      <h2>Activity Log</h2>
      <div className="toolbar-row">
        <label>
          Filter
          <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}>
            {kinds.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>
      </div>
      {rows.length === 0 ? (
        <p>No log entries yet.</p>
      ) : (
        <ul className="log-list">
          {rows.map((entry) => (
            <li key={entry.id}>
              <strong>D{entry.day}</strong> <span className="muted">[{entry.kind}]</span> {entry.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
