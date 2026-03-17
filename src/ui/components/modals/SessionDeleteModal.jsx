export function SessionDeleteModal({ open, sessionName, onCancel, onConfirm }) {
  return (
    <div
      className={`modal ${open ? "" : "is-hidden"}`}
      aria-hidden={open ? "false" : "true"}
      onClick={(e) => {
        if (e.currentTarget === e.target) {
          onCancel();
        }
      }}
    >
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="delete-session-title">
        <h2 id="delete-session-title">Delete Session</h2>
        <p>
          Delete session <strong>{sessionName}</strong>? This removes bowlers, scores, brackets, refunds, and payouts
          for this session.
        </p>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="icon-button danger" onClick={onConfirm}>
            Delete Session
          </button>
        </div>
      </div>
    </div>
  );
}
