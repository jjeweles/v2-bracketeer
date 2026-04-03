export function DashboardTopbar({
  snapshot,
  sessionCompleted,
  status,
}) {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <p>League Night Dashboard</p>
      </div>
      <div className="topbar-actions">
        <span className="pill">
          {snapshot?.session ? `Session #${snapshot.session.id}` : "No Session"}
        </span>
        {sessionCompleted && <span className="pill complete-pill">Completed</span>}
        <span className="pill status-pill">{status}</span>
      </div>
    </header>
  );
}
