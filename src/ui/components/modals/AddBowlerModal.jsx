import { useEffect, useRef } from "react";

const ALL_BRACKETS_MODES = [
  { key: "off", label: "Off" },
  { key: "both", label: "All (Both)" },
  { key: "handicap", label: "All-Handicap" },
  { key: "scratch", label: "All-Scratch" },
];

export function AddBowlerModal({ open, sessionCompleted, formState, setFormState, onClose, onSubmit }) {
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      nameInputRef.current?.focus();
    });
  }, [open]);

  async function handleSubmit(e) {
    const didAddBowler = await onSubmit(e);
    if (!didAddBowler) return;
    requestAnimationFrame(() => {
      nameInputRef.current?.focus();
    });
  }

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
        <form className="grid compact-grid" onSubmit={handleSubmit}>
          <div className="add-bowler-row add-bowler-row-2">
            <label>
              Name
              <input
                ref={nameInputRef}
                required
                name="name"
                value={formState.name}
                onChange={(e) => setFormState((p) => ({ ...p, name: e.target.value }))}
              />
            </label>
            <label>
              Lane #
              <input
                name="laneNumber"
                type="number"
                min="1"
                step="1"
                value={formState.laneNumber ?? ""}
                onChange={(e) =>
                  setFormState((p) => ({
                    ...p,
                    laneNumber: e.target.value,
                  }))
                }
              />
            </label>
          </div>

          <div className="add-bowler-row add-bowler-row-3">
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
              Scr Entries
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
              Hdcp Entries
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
          </div>

          <div className="add-bowler-row add-bowler-controls-row">
            <label className="check-label add-bowler-mode-group">
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
            <button
              type="button"
              className={`mode-btn add-bowler-paylater-btn ${formState.payLater ? "is-selected" : ""}`}
              onClick={() =>
                setFormState((p) => ({
                  ...p,
                  payLater: !Boolean(p.payLater),
                }))
              }
            >
              {formState.payLater ? "Pay Later: On" : "Pay Later: Off"}
            </button>
          </div>

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
