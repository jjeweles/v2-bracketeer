export function EditableCellButton({
  isEditing,
  sessionCompleted,
  draftValue,
  onDraftChange,
  onSave,
  onCancel,
  onStartEdit,
  displayValue,
  inputType = "text",
  inputMin,
}) {
  if (isEditing) {
    return (
      <div className="avg-edit-wrap">
        <input
          className="avg-input"
          type={inputType}
          min={inputMin}
          autoFocus
          value={draftValue}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSave();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            }
          }}
        />
        <button
          type="button"
          className="mini-btn"
          disabled={sessionCompleted}
          onClick={onSave}
        >
          Save
        </button>
        <button type="button" className="mini-btn secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="avg-display"
      disabled={sessionCompleted}
      onClick={onStartEdit}
    >
      {displayValue}
    </button>
  );
}
