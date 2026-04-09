import { toMoney } from "../lib/format";

export function PayoutsPage({
  active,
  refundTotals,
  owedTotals,
  payouts,
  paidPayoutMap,
  sessionCompleted,
  onOpenRefundModal,
  onOpenOwedModal,
  onTogglePayoutPaid,
  onPrintPayoutSummary,
}) {
  return (
    <section className={`page ${active ? "is-active" : ""}`}>
      <header className="page-head">
        <div>
          <p className="eyebrow">Payouts</p>
          <h1>Payout summary</h1>
          <p className="subhead">Track payouts as brackets complete.</p>
        </div>
      </header>

      <section className="card">
        <div className="row">
          {refundTotals.length > 0 && (
            <button type="button" className="button secondary" onClick={onOpenRefundModal}>
              View Refunds
            </button>
          )}
          {owedTotals.length > 0 && (
            <button type="button" className="button secondary" onClick={onOpenOwedModal}>
              View Owed
            </button>
          )}
          <button
            type="button"
            className="button secondary"
            onClick={onPrintPayoutSummary}
            disabled={payouts.length === 0 && owedTotals.every((row) => Number(row.netOwedCents ?? 0) <= 0)}
          >
            Print Payout Summary
          </button>
        </div>
        <div className="panel">
          {payouts.length === 0
            ? "No completed brackets yet"
            : payouts.map((p) => {
                const isPaid = paidPayoutMap.has(p.bowlerId);
                return (
                  <div className={`refund-row ${isPaid ? "is-paid" : ""}`} key={p.bowlerId}>
                    <div className="refund-meta">
                      <strong>{p.name}</strong>
                      <span>{toMoney(p.amountCents)}</span>
                    </div>
                    <button
                      type="button"
                      className={`mini-btn ${isPaid ? "secondary" : ""}`}
                      onClick={() => onTogglePayoutPaid(p.bowlerId)}
                      disabled={sessionCompleted}
                    >
                      {isPaid ? "Undo" : "Mark Paid"}
                    </button>
                  </div>
                );
              })}
        </div>
      </section>
    </section>
  );
}
