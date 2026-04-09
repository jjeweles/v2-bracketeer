import { toMoney } from "../../lib/format";

export function EntrantsModal({ open, rows, entryFeeCents, onClose, onPrint }) {
  const entryFeeLabel = toMoney(entryFeeCents);
  const totalScratch = rows.reduce((acc, row) => acc + Number(row.scratchEntries ?? 0), 0);
  const totalHdcp = rows.reduce((acc, row) => acc + Number(row.handicapEntries ?? 0), 0);

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
      <div className="modal-card entrants-modal-card" role="dialog" aria-modal="true" aria-labelledby="entrants-title">
        <h2 id="entrants-title">Entrants</h2>
        <p>View and print each bowler's scratch and handicap entries with bracket amounts.</p>
        <div className="panel entrants-table-wrap themed-scrollbar">
          {rows.length === 0 ? (
            <div className="refund-empty">No bowlers entered yet.</div>
          ) : (
            <table className="entrants-table">
              <thead>
                <tr>
                  <th>Bowler</th>
                  <th>{`Scr Entries ${entryFeeLabel}`}</th>
                  <th>{`Hdcp Entries ${entryFeeLabel}`}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.displayName}</td>
                    <td>{row.scratchEntries}</td>
                    <td>{row.handicapEntries}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total Entries</td>
                  <td>{totalScratch}</td>
                  <td>{totalHdcp}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" onClick={onPrint} disabled={rows.length === 0}>
            Print Entrants
          </button>
        </div>
      </div>
    </div>
  );
}
