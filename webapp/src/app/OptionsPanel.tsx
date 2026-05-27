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

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.compactCards}
              onChange={(event) => void onUpdateSettings({ compactCards: event.target.checked })}
            />
            Compact card layout
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.confirmImport}
              onChange={(event) => void onUpdateSettings({ confirmImport: event.target.checked })}
            />
            Confirm before importing save
          </label>
        </div>
      )}
    </section>
  );
}