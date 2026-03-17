export function SessionPage({
  active,
  sessionFormDefaults,
  setSessionFormDefaults,
  onCreateSession,
  activeSessionId,
  onSessionChange,
  sessions,
  onRefreshSessions,
  onLoadSnapshot,
  onCloneSession,
  onCompleteSession,
  hasLoadedSession,
  canCompleteSession,
  sessionSummary,
}) {
  return (
    <section className={`page ${active ? "is-active" : ""}`}>
      <header className="page-head">
        <div>
          <p className="eyebrow">Session Hub</p>
          <h1>Start or load a session</h1>
          <p className="subhead">
            Create a new session or select an existing one. Once loaded,
            the rest of the workflow unlocks.
          </p>
        </div>
      </header>

      <div className="card-grid">
        <section className="card">
          <h2>Create Session</h2>
          <form className="grid" onSubmit={onCreateSession}>
            <label>
              Session Name
              <input
                required
                name="name"
                placeholder="Thursday League Night"
                value={sessionFormDefaults.name}
                onChange={(e) =>
                  setSessionFormDefaults((p) => ({
                    ...p,
                    name: e.target.value,
                  }))
                }
              />
            </label>
            <label>
              Entry Fee ($)
              <input
                name="entryFeeDollars"
                type="number"
                step="0.01"
                value={sessionFormDefaults.entryFeeDollars}
                onChange={(e) =>
                  setSessionFormDefaults((p) => ({
                    ...p,
                    entryFeeDollars: e.target.value,
                  }))
                }
                required
              />
            </label>
            <label>
              Handicap %
              <input
                name="handicapPercent"
                type="number"
                value={sessionFormDefaults.handicapPercent}
                onChange={(e) =>
                  setSessionFormDefaults((p) => ({
                    ...p,
                    handicapPercent: e.target.value,
                  }))
                }
                required
              />
            </label>
            <label>
              Handicap Base
              <input
                name="handicapBase"
                type="number"
                value={sessionFormDefaults.handicapBase}
                onChange={(e) =>
                  setSessionFormDefaults((p) => ({
                    ...p,
                    handicapBase: e.target.value,
                  }))
                }
                required
              />
            </label>
            <label>
              1st Payout ($)
              <input
                name="payoutFirstDollars"
                type="number"
                step="0.01"
                value={sessionFormDefaults.payoutFirstDollars}
                onChange={(e) =>
                  setSessionFormDefaults((p) => ({
                    ...p,
                    payoutFirstDollars: e.target.value,
                  }))
                }
                required
              />
            </label>
            <label>
              2nd Payout ($)
              <input
                name="payoutSecondDollars"
                type="number"
                step="0.01"
                value={sessionFormDefaults.payoutSecondDollars}
                onChange={(e) =>
                  setSessionFormDefaults((p) => ({
                    ...p,
                    payoutSecondDollars: e.target.value,
                  }))
                }
                required
              />
            </label>
            <button type="submit">Create Session</button>
          </form>
        </section>

        <section className="card">
          <h2>Select Session</h2>
          <div className="row">
            <select value={activeSessionId ?? ""} onChange={onSessionChange}>
              <option value="">-- Select a session --</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name} (#{session.id})
                </option>
              ))}
            </select>
            <button
              className="button secondary"
              type="button"
              onClick={onRefreshSessions}
            >
              Refresh
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={onLoadSnapshot}
            >
              Load Session
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={onCloneSession}
              disabled={!hasLoadedSession}
            >
              New From This Session
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={onCompleteSession}
              disabled={!canCompleteSession}
            >
              Complete Session
            </button>
          </div>
          <div className="panel session-summary-panel">
            {!sessionSummary ? (
              <div>No session loaded yet.</div>
            ) : (
              <>
                <div className="summary-row">
                  <span>Session</span>
                  <strong>{sessionSummary.name}</strong>
                </div>
                <div className="summary-row">
                  <span>Entry Fee</span>
                  <strong>{sessionSummary.entryFee}</strong>
                </div>
                <div className="summary-row">
                  <span>Handicap</span>
                  <strong>{sessionSummary.handicap}</strong>
                </div>
                <div className="summary-row">
                  <span>1st Payout</span>
                  <strong>{sessionSummary.payoutFirst}</strong>
                </div>
                <div className="summary-row">
                  <span>2nd Payout</span>
                  <strong>{sessionSummary.payoutSecond}</strong>
                </div>
                <div className="summary-row">
                  <span>Status</span>
                  <strong>{sessionSummary.status}</strong>
                </div>
                {sessionSummary.completedAt && (
                  <div className="summary-row">
                    <span>Completed At</span>
                    <strong>{sessionSummary.completedAt}</strong>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
