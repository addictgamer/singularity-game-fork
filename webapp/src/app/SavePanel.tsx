import { useState } from "react";
import { SaveSummary } from "../store/persistence";

interface SavePanelProps {
  saveSummaries: SaveSummary[];
  canSave: boolean;
  confirmImport: boolean;
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
  confirmImport,
  onSaveSlot,
  onLoadSlot,
  onDeleteSlot,
  onExport,
  onImport,
}: SavePanelProps) {
  const [importError, setImportError] = useState<string | null>(null);

  const rows = CORE_SLOTS.map((slot) => {
    const summary = saveSummaries.find((entry) => entry.slot === slot);
    return {
      slot,
      summary,
    };
  });

  return (
    <section className="card card-span-2">
      <h2>Save and Load</h2>
      <p className="muted">Manage slot saves, import/export, and quick recovery workflows.</p>
      <div className="save-manager-list">
        {rows.map(({ slot, summary }) => (
          <article key={slot} className="save-row-card">
            <div>
              <strong>{slot}</strong>
              {summary ? (
                <p className="muted">
                  Day {summary.day} · {summary.difficultyId} · ${summary.cash} · {summary.baseCount} base(s) ·
                  {" "}
                  {summary.updatedAt.slice(0, 16).replace("T", " ")}
                </p>
              ) : (
                <p className="muted">Empty slot.</p>
              )}
            </div>
            <div className="save-row-actions">
              <button disabled={!canSave || slot === "autosave"} onClick={() => void onSaveSlot(slot)}>
                Save
              </button>
              <button disabled={!summary} onClick={() => void onLoadSlot(slot)}>
                Load
              </button>
              <button disabled={!summary} onClick={() => void onDeleteSlot(slot)}>
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
