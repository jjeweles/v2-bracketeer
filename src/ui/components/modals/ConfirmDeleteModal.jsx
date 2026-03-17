export function ConfirmDeleteModal({ open, message, onCancel, onConfirm }) {
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
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <h2 id="confirm-title">Confirm Delete</h2>
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="icon-button danger" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
