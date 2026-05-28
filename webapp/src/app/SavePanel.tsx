import { useState } from "react";
import { SaveSummary } from "../store/persistence";

interface SavePanelProps {
  saveSummaries: SaveSummary[];
  canSave: boolean;
  hasActiveGame: boolean;
  confirmImport: boolean;
  currentSession: {
    day: number;
    difficultyId: string;
    cash: number;
    baseCount: number;
  } | null;
  onSaveSlot: (slot: string) => Promise<void>;
  onLoadSlot: (slot: string) => Promise<void>;
  onDeleteSlot: (slot: string) => Promise<void>;
  onExport: () => string | null;
  onImport: (serialized: string) => void;
}

const CORE_SLOTS = ["slot-1", "slot-2", "slot-3", "autosave"];

export function SavePanel({
  saveSummaries,
  canSave,
  hasActiveGame,
  confirmImport,
  currentSession,
  onSaveSlot,
  onLoadSlot,
  onDeleteSlot,
  onExport,
  onImport,
}: SavePanelProps) {
  const [importError, setImportError] = useState<string | null>(null);
  const [showEmptySlots, setShowEmptySlots] = useState<boolean>(true);

  const rows = CORE_SLOTS.map((slot) => {
    const summary = saveSummaries.find((entry) => entry.slot === slot);
    return {
      slot,
      summary,
    };
  });
  const visibleRows = showEmptySlots ? rows : rows.filter((row) => Boolean(row.summary));

  const mostRecent = [...saveSummaries]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  const formatTimestamp = (iso: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return iso;
    }
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <section className="card card-span-2">
      <h2>Save and Load</h2>
      <p className="muted">Manage slot saves, import/export, and quick recovery workflows.</p>

      {currentSession ? (
        <section className="save-session-summary">
          <h3>Current Session</h3>
          <p className="muted">
            Day {currentSession.day} · {currentSession.difficultyId} · ${currentSession.cash} · {currentSession.baseCount} base(s)
          </p>
        </section>
      ) : (
        <section className="save-session-summary">
          <h3>Current Session</h3>
          <p className="muted">No active game loaded.</p>
        </section>
      )}

      <div className="actions">
        <button
          disabled={!canSave}
          onClick={async () => {
            const slot = "slot-1";
            const existing = rows.find((row) => row.slot === slot)?.summary;
            if (existing) {
              const ok = window.confirm(`Overwrite ${slot}?`);
              if (!ok) {
                return;
              }
            }
            await onSaveSlot(slot);
          }}
        >
          Quick Save (slot-1)
        </button>
        <button
          disabled={!mostRecent}
          onClick={async () => {
            if (!mostRecent) {
              return;
            }
            if (hasActiveGame) {
              const ok = window.confirm(`Load ${mostRecent.slot}? Unsaved session progress will be replaced.`);
              if (!ok) {
                return;
              }
            }
            await onLoadSlot(mostRecent.slot);
          }}
        >
          Load Most Recent {mostRecent ? `(${mostRecent.slot})` : ""}
        </button>
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={showEmptySlots}
          onChange={(event) => setShowEmptySlots(event.target.checked)}
        />
        Show empty slots
      </label>

      <div className="save-manager-list">
        {visibleRows.map(({ slot, summary }) => (
          <article key={slot} className="save-row-card">
            <div>
              <strong>
                {slot}
                {mostRecent?.slot === slot ? " (most recent)" : ""}
              </strong>
              {summary ? (
                <p className="muted">
                  Day {summary.day} · {summary.difficultyId} · ${summary.cash} · {summary.baseCount} base(s) ·
                  {" "}
                  {formatTimestamp(summary.updatedAt)}
                </p>
              ) : (
                <p className="muted">Empty slot.</p>
              )}
            </div>
            <div className="save-row-actions">
              <button
                disabled={!canSave || slot === "autosave"}
                onClick={async () => {
                  if (summary) {
                    const ok = window.confirm(`Overwrite ${slot}?`);
                    if (!ok) {
                      return;
                    }
                  }
                  await onSaveSlot(slot);
                }}
              >
                Save
              </button>
              <button
                disabled={!summary}
                onClick={async () => {
                  if (hasActiveGame) {
                    const ok = window.confirm(`Load ${slot}? Unsaved session progress will be replaced.`);
                    if (!ok) {
                      return;
                    }
                  }
                  await onLoadSlot(slot);
                }}
              >
                Load
              </button>
              <button
                disabled={!summary}
                onClick={async () => {
                  const ok = window.confirm(`Delete ${slot}? This cannot be undone.`);
                  if (!ok) {
                    return;
                  }
                  await onDeleteSlot(slot);
                }}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>

      <h3>File Transfer</h3>
      <div className="actions">
        <button
          disabled={!canSave}
          onClick={() => {
            const json = onExport();
            if (!json) {
              return;
            }
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "singularity-web-save.json";
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export Active Game
        </button>

        <label className="import-button">
          Import Save JSON
          <input
            type="file"
            accept="application/json"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }
              if (confirmImport) {
                const ok = window.confirm("Importing will replace current session state. Continue?");
                if (!ok) {
                  return;
                }
              }
              try {
                const json = await file.text();
                onImport(json);
                setImportError(null);
              } catch (error) {
                setImportError((error as Error).message);
              }
            }}
          />
        </label>
      </div>
      {importError ? <p className="error">Import failed: {importError}</p> : null}
    </section>
  );
}
