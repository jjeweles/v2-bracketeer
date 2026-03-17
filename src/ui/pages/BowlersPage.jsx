import { BowlerRow } from "../components/bowlers/BowlerRow";

export function BowlersPage({
  active,
  sessionCompleted,
  onOpenAddBowler,
  bowlerSearchQuery,
  setBowlerSearchQuery,
  onImportBowlersPdf,
  importErrorDetails,
  filteredBowlers,
  editingCell,
  setEditingCell,
  nameDrafts,
  setNameDrafts,
  averageDrafts,
  setAverageDrafts,
  scratchEntriesDrafts,
  setScratchEntriesDrafts,
  handicapEntriesDrafts,
  setHandicapEntriesDrafts,
  onUpdateAverage,
  updateBowlerField,
  cancelCellEdit,
  togglePayLater,
  owedByBowler,
  onClickDelete,
}) {
  return (
    <section className={`page ${active ? "is-active" : ""}`}>
      <header className="page-head">
        <div>
          <p className="eyebrow">Roster</p>
          <h1>Add bowlers</h1>
          <p className="subhead">
            Capture roster details before generating brackets.
          </p>
        </div>
      </header>

      <section className="card bowlers-card">
        <div className="row bowlers-toolbar">
          <button
            type="button"
            onClick={onOpenAddBowler}
            disabled={sessionCompleted}
          >
            Add Bowler
          </button>
          <input
            className="bowler-search-input"
            type="search"
            placeholder="Search bowlers by name..."
            value={bowlerSearchQuery}
            onChange={(e) => setBowlerSearchQuery(e.target.value)}
          />
        </div>

        <div className="file-label">
          <div className="file-upload">
            <span className="file-upload-label">
              Import Bowlers from League PDF
            </span>
            <span className="file-name">
              Temporarily disabled in desktop build.
            </span>
            <button
              type="button"
              className="button secondary"
              onClick={onImportBowlersPdf}
            >
              Import Disabled
            </button>
          </div>
          {importErrorDetails && (
            <pre className="import-error-details">{importErrorDetails}</pre>
          )}
        </div>

        <div className="panel">
          {filteredBowlers.length === 0 ? (
            <div>No bowlers yet</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Avg</th>
                  <th>Hdcp</th>
                  <th>Scratch Entries</th>
                  <th>Handicap Entries</th>
                  <th>Pay Later</th>
                  <th>All Brackets</th>
                  <th>Owes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBowlers.map((bowler) => (
                  <BowlerRow
                    key={bowler.id}
                    bowler={bowler}
                    sessionCompleted={sessionCompleted}
                    editingCell={editingCell}
                    setEditingCell={setEditingCell}
                    nameDrafts={nameDrafts}
                    setNameDrafts={setNameDrafts}
                    averageDrafts={averageDrafts}
                    setAverageDrafts={setAverageDrafts}
                    scratchEntriesDrafts={scratchEntriesDrafts}
                    setScratchEntriesDrafts={setScratchEntriesDrafts}
                    handicapEntriesDrafts={handicapEntriesDrafts}
                    setHandicapEntriesDrafts={setHandicapEntriesDrafts}
                    onUpdateAverage={onUpdateAverage}
                    updateBowlerField={updateBowlerField}
                    cancelCellEdit={cancelCellEdit}
                    togglePayLater={togglePayLater}
                    owedByBowler={owedByBowler}
                    onClickDelete={onClickDelete}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </section>
  );
}
