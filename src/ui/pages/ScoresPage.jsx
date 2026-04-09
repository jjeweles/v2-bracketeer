export function ScoresPage({
  active,
  gameNumber,
  setGameNumber,
  game1Complete,
  game2Complete,
  onSaveScores,
  sessionCompleted,
  requiredScorers,
  scoreDrafts,
  onScoreChange,
}) {
  const laneGroups = [];
  const laneGroupIndexByKey = new Map();

  for (const scorer of requiredScorers) {
    const laneNumber = scorer.laneNumber ?? null;
    const key = laneNumber == null ? "unassigned" : `lane-${laneNumber}`;
    let groupIndex = laneGroupIndexByKey.get(key);
    if (groupIndex == null) {
      groupIndex = laneGroups.length;
      laneGroupIndexByKey.set(key, groupIndex);
      laneGroups.push({ key, laneNumber, scorers: [] });
    }
    laneGroups[groupIndex].scorers.push(scorer);
  }

  return (
    <section className={`page ${active ? "is-active" : ""}`}>
      <header className="page-head">
        <div>
          <p className="eyebrow">Scoring</p>
          <h1>Update scores</h1>
          <p className="subhead">Enter scores by game to advance brackets automatically.</p>
        </div>
      </header>

      <section className="card">
        <div className="row">
          <div className="game-tabs" role="tablist" aria-label="Game tabs">
            <button
              type="button"
              className={`tab-btn ${gameNumber === 1 ? "is-active" : ""}`}
              onClick={() => setGameNumber(1)}
            >
              Game 1
            </button>
            <button
              type="button"
              className={`tab-btn ${gameNumber === 2 ? "is-active" : ""}`}
              onClick={() => setGameNumber(2)}
              disabled={!game1Complete}
            >
              Game 2
            </button>
            <button
              type="button"
              className={`tab-btn ${gameNumber === 3 ? "is-active" : ""}`}
              onClick={() => setGameNumber(3)}
              disabled={!game2Complete}
            >
              Game 3
            </button>
          </div>
          <button type="button" onClick={onSaveScores} disabled={sessionCompleted}>
            Save Scores
          </button>
        </div>

        <div className="panel score-panel">
          {requiredScorers.length === 0 ? (
            <div>No active bowlers need scores for this game yet</div>
          ) : (
            <div className="score-lane-groups">
              {laneGroups.map((group) => (
                <div key={group.key} className="score-lane-group">
                  <div className="score-lane-title">
                    {group.laneNumber == null ? "No Lane Assigned" : `Lane ${group.laneNumber}`}
                  </div>
                  <div className="score-lane-list">
                    {group.scorers.map((s) => (
                      <label key={s.bowlerId} className="score-row">
                        <span className="score-row-main">{s.name}</span>
                        <input
                          type="number"
                          min="0"
                          max="300"
                          value={scoreDrafts[s.bowlerId] ?? ""}
                          onChange={(e) => onScoreChange(s.bowlerId, e.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
