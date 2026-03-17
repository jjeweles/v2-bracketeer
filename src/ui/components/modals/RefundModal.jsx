import { toMoney } from "../../lib/format";

export function RefundModal({ open, refundTotals, paidRefundMap, sessionCompleted, onToggleRefundPaid, onClose }) {
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
      <div className="modal-card refund-modal-card" role="dialog" aria-modal="true" aria-labelledby="refund-title">
        <h2 id="refund-title">Refund Queue</h2>
        <p>Mark each bowler once their refund has been paid.</p>
        <div className="refund-list">
          {refundTotals.length === 0 ? (
            <div className="refund-empty">No refunds for this bracket run.</div>
          ) : (
            refundTotals.map((row) => {
              const isPaid = paidRefundMap.has(row.bowlerId);
              return (
                <div className={`refund-row ${isPaid ? "is-paid" : ""}`} key={row.bowlerId}>
                  <div className="refund-meta">
                    <strong>{row.name}</strong>
                    <span>{toMoney(row.amountCents)}</span>
                  </div>
                  <button
                    type="button"
                    className={`mini-btn ${isPaid ? "secondary" : ""}`}
                    onClick={() => onToggleRefundPaid(row.bowlerId)}
                    disabled={sessionCompleted}
                  >
                    {isPaid ? "Undo" : "Mark Paid"}
                  </button>
                </div>
              );
            })
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
