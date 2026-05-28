import { useMemo, useState } from "react";

interface LogPanelProps {
  entries: Array<{ id: number; day: number; kind: string; message: string }>;
}

export function LogPanel({ entries }: LogPanelProps) {
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [searchText, setSearchText] = useState<string>("");
  const [minDay, setMinDay] = useState<number>(0);
  const kinds = useMemo(() => ["all", ...new Set(entries.map((entry) => entry.kind))], [entries]);
  const maxDay = useMemo(() => entries.reduce((max, entry) => Math.max(max, entry.day), 0), [entries]);
  const rows = useMemo(
    () =>
      [...entries]
        .reverse()
        .filter((entry) => (kindFilter === "all" ? true : entry.kind === kindFilter))
        .filter((entry) => entry.day >= minDay)
        .filter((entry) =>
          searchText.trim().length === 0
            ? true
            : `${entry.kind} ${entry.message}`.toLowerCase().includes(searchText.trim().toLowerCase())
        ),
    [entries, kindFilter, minDay, searchText]
  );

  const summary = useMemo(
    () =>
      rows.reduce<Record<string, number>>((acc, row) => {
        acc[row.kind] = (acc[row.kind] ?? 0) + 1;
        return acc;
      }, {}),
    [rows]
  );
  const summaryRows = Object.entries(summary).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

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
        <label>
          Search
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="message or kind"
          />
        </label>
        <label>
          Min Day
          <input
            type="number"
            min={0}
            max={maxDay}
            value={minDay}
            onChange={(event) => setMinDay(Number.parseInt(event.target.value || "0", 10))}
          />
        </label>
      </div>

      {summaryRows.length > 0 ? (
        <ul className="log-summary-list">
          {summaryRows.map(([kind, count]) => (
            <li key={kind}>
              {kind}: {count}
            </li>
          ))}
        </ul>
      ) : null}

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
