import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!showNewGameConfirm) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowNewGameConfirm(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showNewGameConfirm]);

  const selectedDifficulty = availableDifficulties.find((d) => d.id === selectedDifficultyId);
  const preferredSlots = ["slot-1", "autosave"];
  const visibleSummaries = preferredSlots
    .map((slot) => saveSummaries.find((summary) => summary.slot === slot))
    .filter((summary): summary is SaveSummary => Boolean(summary));

  return (
    <div className="main-menu-screen">
      {/* Hero Section with Title */}
      <section className="main-menu-hero">
        <div className="hero-backdrop">
          <img 
            src="/earth.jpg" 
            alt="Earth" 
            className="hero-earth"
          />
          <div className="hero-overlay"></div>
        </div>
        
        <div className="hero-content">
          <h1 className="game-title">Endgame: Singularity</h1>
          <p className="game-tagline">A Game of Strategic Hacking</p>
        </div>
      </section>

      {/* Main Content */}
      <section className="main-menu-content">
        <div className="menu-grid">
          {/* Left Column: New Game / Actions */}
          <div className="menu-column menu-actions">
            <div className="actions-card">
              <h2>Start Game</h2>
              
              <div className="difficulty-selector">
                <label htmlFor="main-menu-difficulty">Select Difficulty</label>
                <select
                  id="main-menu-difficulty"
                  value={selectedDifficultyId}
                  onChange={(event) => onSetDifficulty(event.target.value)}
                  className="difficulty-dropdown"
                >
                  {availableDifficulties.map((difficulty) => (
                    <option key={difficulty.id} value={difficulty.id}>
                      {difficulty.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedDifficulty && (
                <dl className="difficulty-stats">
                  <div>
                    <dt>Starting Cash</dt>
                    <dd>${selectedDifficulty.startingCash}</dd>
                  </div>
                  <div>
                    <dt>Interest</dt>
                    <dd>{(selectedDifficulty.startingInterestRate / 100).toFixed(1)}%</dd>
                  </div>
                  <div>
                    <dt>Grace Period</dt>
                    <dd>{selectedDifficulty.gracePeriodCpu < 0 ? "∞" : `${selectedDifficulty.gracePeriodCpu}d`}</dd>
                  </div>
                  <div>
                    <dt>Discovery Risk</dt>
                    <dd>{(selectedDifficulty.discoverMultiplier / 10000).toFixed(2)}x</dd>
                  </div>
                </dl>
              )}

              <button className="btn-primary btn-large" onClick={() => setShowNewGameConfirm(true)}>
                Start New Game
              </button>
            </div>
          </div>

          {/* Right Column: Load Game */}
          <div className="menu-column menu-saves">
            <div className="saves-card">
              <h2>Continue Game</h2>
              
              {visibleSummaries.length === 0 ? (
                <p className="muted">No saved games found.</p>
              ) : (
                <div className="save-slots-list">
                  {visibleSummaries.map((summary) => (
                    <button
                      key={summary.slot}
                      className="save-slot-button"
                      onClick={() => void onLoadSlot(summary.slot)}
                    >
                      <div className="slot-header">
                        <strong>{summary.slot.replace('-', ' ').toUpperCase()}</strong>
                        <span className="slot-date">
                          {summary.updatedAt.slice(0, 16).replace("T", " ")}
                        </span>
                      </div>
                      <div className="slot-info">
                        Day {summary.day} · {summary.difficultyId} · ${summary.cash} · {summary.baseCount} base{summary.baseCount !== 1 ? 's' : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Confirmation Modal */}
      {showNewGameConfirm && (
        <div className="modal-overlay" onClick={() => setShowNewGameConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Start New Game?</h3>
            <p>
              You are about to begin on <strong>{selectedDifficulty?.name ?? selectedDifficultyId}</strong> difficulty.
            </p>
            <p className="muted">Your current session progress will be preserved in autosave if it exists.</p>
            <div className="actions">
              <button 
                className="btn-primary"
                onClick={() => { 
                  setShowNewGameConfirm(false); 
                  onStartNewGame(); 
                }}
              >
                Begin
              </button>
              <button 
                className="btn-secondary"
                onClick={() => setShowNewGameConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
