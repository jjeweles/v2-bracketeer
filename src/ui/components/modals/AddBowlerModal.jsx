const ALL_BRACKETS_MODES = [
  { key: "off", label: "Off" },
  { key: "both", label: "All (Both)" },
  { key: "handicap", label: "All-Handicap" },
  { key: "scratch", label: "All-Scratch" },
];

export function AddBowlerModal({ open, sessionCompleted, formState, setFormState, onClose, onSubmit }) {
  return (
    <div
      className={`modal ${open ? "" : "is-hidden"}`}
      aria-hidden={open ? "false" : "true"}
      onClick={(e) => {
        if (e.currentTarget === e.target) {
          onClose();
        }
      }}
    >
      <div className="modal-card add-bowler-modal-card" role="dialog" aria-modal="true" aria-labelledby="add-bowler-title">
        <h2 id="add-bowler-title">Add Bowler</h2>
        <p>Enter bowler details. Bracket entries can be set now or edited later.</p>
        <form className="grid compact-grid" onSubmit={onSubmit}>
          <label>
            Name
            <input
              required
              name="name"
              value={formState.name}
              onChange={(e) => setFormState((p) => ({ ...p, name: e.target.value }))}
            />
          </label>
          <label>
            Average
            <input
              required
              name="average"
              type="number"
              min="0"
              value={formState.average}
              onChange={(e) =>
                setFormState((p) => ({
                  ...p,
                  average: e.target.value,
                }))
              }
            />
          </label>
          <label>
            Scratch Entries
            <input
              required
              name="scratchEntries"
              type="number"
              min="0"
              value={formState.scratchEntries}
              onChange={(e) =>
                setFormState((p) => ({
                  ...p,
                  scratchEntries: e.target.value,
                }))
              }
            />
          </label>
          <label>
            Handicap Entries
            <input
              required
              name="handicapEntries"
              type="number"
              min="0"
              value={formState.handicapEntries}
              onChange={(e) =>
                setFormState((p) => ({
                  ...p,
                  handicapEntries: e.target.value,
                }))
              }
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={Boolean(formState.payLater)}
              onChange={(e) =>
                setFormState((p) => ({
                  ...p,
                  payLater: e.target.checked,
                }))
              }
            />
            <span>Pay later (track owed amount)</span>
          </label>
          <label className="check-label">
            <span>All Brackets Mode</span>
            <div className="mode-buttons">
              {ALL_BRACKETS_MODES.map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  className={`mode-btn ${formState.allBracketsMode === mode.key ? "is-selected" : ""}`}
                  onClick={() =>
                    setFormState((p) => ({
                      ...p,
                      allBracketsMode: mode.key,
                    }))
                  }
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </label>
          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={sessionCompleted}>
              Add Bowler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
