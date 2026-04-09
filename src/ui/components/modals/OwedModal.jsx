import { toMoney } from "../../lib/format";

export function OwedModal({ open, owedTotals, paidOwedMap, sessionCompleted, onToggleOwedPaid, onClose }) {
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
      <div className="modal-card refund-modal-card owed-modal-card" role="dialog" aria-modal="true" aria-labelledby="owed-title">
        <h2 id="owed-title">Amounts Owed</h2>
        <p>Net owed is bracket cost minus payouts won. Mark paid when payment is received.</p>
        <div className="refund-list themed-scrollbar">
          {owedTotals.length === 0 ? (
            <div className="refund-empty">No pay-later bowlers in this session.</div>
          ) : (
            owedTotals.map((row) => {
              const isPaid = paidOwedMap.has(row.bowlerId);
              return (
                <div className={`refund-row ${isPaid || row.netOwedCents === 0 ? "is-paid" : ""}`} key={row.bowlerId}>
                  <div className="refund-meta">
                    <strong>{row.name}</strong>
                    <span>
                      {`Net: ${toMoney(row.netOwedCents)} | Owed: ${toMoney(row.grossOwedCents)} | Won: ${toMoney(
                        row.payoutCreditCents,
                      )}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`mini-btn ${isPaid ? "secondary" : ""}`}
                    onClick={() => onToggleOwedPaid(row.bowlerId)}
                    disabled={sessionCompleted || row.netOwedCents === 0}
                  >
                    {isPaid ? "Undo" : "Mark Received"}
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
