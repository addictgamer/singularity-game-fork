import { useMemo, useState } from "react";

interface LogPanelProps {
  entries: Array<{ id: number; day: number; kind: string; message: string }>;
}

type LogCategory = "all" | "simulation" | "research" | "base" | "save" | "intel" | "system";

function categoryForEntry(entry: { kind: string; message: string }): Exclude<LogCategory, "all"> {
  const kind = entry.kind.toLowerCase();
  const message = entry.message.toLowerCase();

  if (kind === "time") {
    return "simulation";
  }
  if (kind === "cpu" || message.includes("research") || message.includes("tech")) {
    return "research";
  }
  if (kind === "build" || kind === "power" || message.includes("base")) {
    return "base";
  }
  if (message.includes("save") || message.includes("slot") || message.includes("import") || message.includes("export")) {
    return "save";
  }
  if (message.includes("event") || message.includes("suspicion") || message.includes("discover")) {
    return "intel";
  }
  return "system";
}

export function LogPanel({ entries }: LogPanelProps) {
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<LogCategory>("all");
  const [searchText, setSearchText] = useState<string>("");
  const [minDay, setMinDay] = useState<number>(0);
  const [archiveBeforeDay, setArchiveBeforeDay] = useState<number>(0);
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [archivedExpanded, setArchivedExpanded] = useState<boolean>(false);
  const kinds = useMemo(() => ["all", ...new Set(entries.map((entry) => entry.kind))], [entries]);
  const maxDay = useMemo(() => entries.reduce((max, entry) => Math.max(max, entry.day), 0), [entries]);
  const categories: LogCategory[] = ["all", "simulation", "research", "base", "save", "intel", "system"];

  const normalizedArchiveBeforeDay = Math.max(0, Math.min(maxDay, archiveBeforeDay));

  const rows = useMemo(
    () =>
      [...entries]
        .reverse()
        .filter((entry) => (kindFilter === "all" ? true : entry.kind === kindFilter))
        .filter((entry) => {
          if (categoryFilter === "all") {
            return true;
          }
          return categoryForEntry(entry) === categoryFilter;
        })
        .filter((entry) => entry.day >= minDay)
        .filter((entry) =>
          searchText.trim().length === 0
            ? true
            : `${entry.kind} ${entry.message}`.toLowerCase().includes(searchText.trim().toLowerCase())
        ),
    [entries, kindFilter, categoryFilter, minDay, searchText]
  );

  const activeRows = useMemo(
    () => rows.filter((entry) => entry.day >= normalizedArchiveBeforeDay),
    [rows, normalizedArchiveBeforeDay]
  );
  const archivedRows = useMemo(
    () => rows.filter((entry) => entry.day < normalizedArchiveBeforeDay),
    [rows, normalizedArchiveBeforeDay]
  );

  const visibleRows = showArchived ? rows : activeRows;

  const summary = useMemo(
    () =>
      visibleRows.reduce<Record<string, number>>((acc, row) => {
        acc[row.kind] = (acc[row.kind] ?? 0) + 1;
        return acc;
      }, {}),
    [visibleRows]
  );
  const summaryRows = Object.entries(summary).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const categorySummaryRows = useMemo(() => {
    const counts = visibleRows.reduce<Record<string, number>>((acc, entry) => {
      const category = categoryForEntry(entry);
      acc[category] = (acc[category] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [visibleRows]);

  const groupedRows = useMemo(() => {
    const groups = visibleRows.reduce<Record<number, typeof visibleRows>>((acc, entry) => {
      if (!acc[entry.day]) {
        acc[entry.day] = [];
      }
      acc[entry.day].push(entry);
      return acc;
    }, {});
    return Object.entries(groups)
      .map(([day, dayRows]) => ({ day: Number.parseInt(day, 10), dayRows }))
      .sort((a, b) => b.day - a.day);
  }, [visibleRows]);

  const downloadFilteredJson = () => {
    const payload = JSON.stringify(visibleRows, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "singularity-log-filtered.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

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
            Category
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as LogCategory)}>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
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
        <label>
          Archive Before Day
          <input
            type="number"
            min={0}
            max={maxDay}
            value={archiveBeforeDay}
            onChange={(event) => setArchiveBeforeDay(Number.parseInt(event.target.value || "0", 10))}
          />
        </label>
      </div>

      <div className="toolbar-row">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          Show archived entries
        </label>
        <button className="inline-action" onClick={downloadFilteredJson}>
          Export Filtered Log
        </button>
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

      {categorySummaryRows.length > 0 ? (
        <ul className="log-summary-list">
          {categorySummaryRows.map(([category, count]) => (
            <li key={category}>
              {category}: {count}
            </li>
          ))}
        </ul>
      ) : null}

      {!showArchived && archivedRows.length > 0 ? (
        <details
          className="log-archive-block"
          open={archivedExpanded}
          onToggle={(event) => setArchivedExpanded((event.target as HTMLDetailsElement).open)}
        >
          <summary>
            Archived entries: {archivedRows.length} (before day {normalizedArchiveBeforeDay})
          </summary>
          <ul className="log-list">
            {archivedRows.slice(0, 25).map((entry) => (
              <li key={entry.id}>
                <strong>D{entry.day}</strong> <span className="muted">[{entry.kind}]</span> {entry.message}
              </li>
            ))}
          </ul>
          {archivedRows.length > 25 ? <p className="muted">Showing first 25 archived entries.</p> : null}
        </details>
      ) : null}

      {visibleRows.length === 0 ? (
        <p>No log entries yet.</p>
      ) : (
        <div className="log-day-groups">
          {groupedRows.map((group) => (
            <section key={group.day} className="log-day-group">
              <h3>Day {group.day}</h3>
              <ul className="log-list">
                {group.dayRows.map((entry) => (
                  <li key={entry.id}>
                    <span className="muted">[{entry.kind}]</span> {entry.message}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
