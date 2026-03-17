export function MaintenancePage({ active, sessions, onAskDeleteSession }) {
  return (
    <section className={`page ${active ? "is-active" : ""}`}>
      <header className="page-head">
        <div>
          <p className="eyebrow">Maintenance</p>
          <h1>Session management</h1>
          <p className="subhead">
            Delete old or mistaken sessions. More maintenance options can live here later.
          </p>
        </div>
      </header>

      <section className="card">
        <div className="panel">
          {sessions.length === 0 ? (
            <div>No sessions available</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td>{session.name}</td>
                    <td>{session.is_completed ? "Completed" : "Open"}</td>
                    <td>{session.created_at ?? "-"}</td>
                    <td>
                      <button
                        type="button"
                        className="icon-button danger"
                        onClick={() => onAskDeleteSession(session)}
                      >
                        Delete Session
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </section>
  );
}
