import { AppSettings } from "../store/persistence";

interface OptionsPanelProps {
  settings: AppSettings;
  settingsLoaded: boolean;
  onUpdateSettings: (patch: Partial<AppSettings>) => Promise<void>;
}

const TIME_STEPS = [
  { label: "6 hours", value: 6 * 60 * 60 },
  { label: "12 hours", value: 12 * 60 * 60 },
  { label: "24 hours", value: 24 * 60 * 60 },
  { label: "72 hours", value: 72 * 60 * 60 },
];

export function OptionsPanel({ settings, settingsLoaded, onUpdateSettings }: OptionsPanelProps) {
  return (
    <section className="card card-span-2">
      <h2>Options</h2>
      {!settingsLoaded ? (
        <p>Loading settings...</p>
      ) : (
        <>
          <h3>Simulation Settings</h3>
          <div className="options-grid">
            <label>
              Time step
              <select
                value={settings.timeStepSeconds}
                onChange={(event) =>
                  void onUpdateSettings({ timeStepSeconds: Number.parseInt(event.target.value, 10) })
                }
              >
                {TIME_STEPS.map((step) => (
                  <option key={step.value} value={step.value}>
                    {step.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={settings.autosaveEnabled}
                onChange={(event) => void onUpdateSettings({ autosaveEnabled: event.target.checked })}
              />
              Enable autosave every 3 in-game days
            </label>
          </div>

          <h3>Display Settings</h3>
          <div className="options-grid">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={settings.compactCards}
                onChange={(event) => void onUpdateSettings({ compactCards: event.target.checked })}
              />
              Compact card layout (smaller padding and gaps)
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={settings.confirmImport}
                onChange={(event) => void onUpdateSettings({ confirmImport: event.target.checked })}
              />
              Confirm before importing save files
            </label>
          </div>

          <p className="muted" style={{ fontSize: "0.85rem", marginTop: "1rem" }}>
            Settings are saved automatically to your browser's local storage and will persist across sessions.
          </p>
        </>
      )}
    </section>
  );
}