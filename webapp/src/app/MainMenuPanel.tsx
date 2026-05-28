import { useState } from "react";
import { GameData } from "../engine/types";
import { SaveSummary } from "../store/persistence";

interface MainMenuPanelProps {
  availableDifficulties: GameData["difficulties"];
  selectedDifficultyId: string;
  saveSummaries: SaveSummary[];
  onSetDifficulty: (id: string) => void;
  onStartNewGame: () => void;
  onLoadSlot: (slot: string) => Promise<void>;
}

export function MainMenuPanel({
  availableDifficulties,
  selectedDifficultyId,
  saveSummaries,
  onSetDifficulty,
  onStartNewGame,
  onLoadSlot,
}: MainMenuPanelProps) {
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const selectedDifficulty = availableDifficulties.find((d) => d.id === selectedDifficultyId);
  const preferredSlots = ["slot-1", "autosave"];
  const visibleSummaries = preferredSlots
    .map((slot) => saveSummaries.find((summary) => summary.slot === slot))
    .filter((summary): summary is SaveSummary => Boolean(summary));

  return (
    <section className="card card-span-2">
      <h2>Main Menu</h2>
      <p className="muted">Start a new run or continue from your most relevant saved sessions.</p>
      <label htmlFor="main-menu-difficulty">Difficulty</label>
      <select
        id="main-menu-difficulty"
        value={selectedDifficultyId}
        onChange={(event) => onSetDifficulty(event.target.value)}
      >
        {availableDifficulties.map((difficulty) => (
          <option key={difficulty.id} value={difficulty.id}>
            {difficulty.name}
          </option>
        ))}
      </select>
      {selectedDifficulty && (
        <dl className="stats">
          <div>
            <dt>Starting Cash</dt>
            <dd>${selectedDifficulty.startingCash}</dd>
          </div>
          <div>
            <dt>Interest Rate</dt>
            <dd>{(selectedDifficulty.startingInterestRate / 100).toFixed(1)}%</dd>
          </div>
          <div>
            <dt>Grace Period</dt>
            <dd>{selectedDifficulty.gracePeriodCpu < 0 ? "Unlimited" : `${selectedDifficulty.gracePeriodCpu} CPU days`}</dd>
          </div>
          <div>
            <dt>Discovery Risk</dt>
            <dd>{(selectedDifficulty.discoverMultiplier / 10000).toFixed(2)}x</dd>
          </div>
        </dl>
      )}
      <div className="actions">
        <button onClick={() => setShowNewGameConfirm(true)}>New Game</button>
        <button onClick={() => void onLoadSlot("slot-1")}>Continue (slot-1)</button>
      </div>

      {showNewGameConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Start New Game?</h3>
            <p>
              You are about to start a new game on <strong>{selectedDifficulty?.name ?? selectedDifficultyId}</strong> difficulty.
            </p>
            <p className="muted">Your current session progress will be preserved in autosave if it exists.</p>
            <div className="actions">
              <button onClick={() => { setShowNewGameConfirm(false); onStartNewGame(); }}>
                Start New Game
              </button>
              <button onClick={() => setShowNewGameConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <h3>Save Slots</h3>
      {visibleSummaries.length === 0 ? (
        <p>No save slots recorded yet.</p>
      ) : (
        <div className="save-slot-grid">
          {visibleSummaries.map((summary) => (
            <article key={summary.slot} className="save-slot-card">
              <header>
                <strong>{summary.slot}</strong>
                <span className="muted">{summary.updatedAt.slice(0, 16).replace("T", " ")}</span>
              </header>
              <p>
                Day {summary.day} · {summary.difficultyId} · ${summary.cash} · {summary.baseCount} base(s)
              </p>
              <button onClick={() => void onLoadSlot(summary.slot)}>Load {summary.slot}</button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
