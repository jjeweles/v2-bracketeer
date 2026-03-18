export function SettingsPage({
  active,
  theme,
  onThemeChange,
  sessions,
  onAskDeleteSession,
}) {
  return (
    <section className={`page ${active ? "is-active" : ""}`}>
      <header className="page-head">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>App preferences</h1>
          <p className="subhead">
            Choose how the app looks and manage old or mistaken sessions.
          </p>
        </div>
      </header>

      <section className="card">
        <h2>Appearance</h2>
        <div className="panel">
          <label className="theme-picker-label">
            Theme
            <select
              value={theme}
              onChange={(e) => onThemeChange(e.target.value)}
              className="theme-picker"
            >
              <option value="green">Green</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Session management</h2>
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
