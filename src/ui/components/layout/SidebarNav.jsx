const PAGE_LABELS = {
  session: "Session",
  bowlers: "Bowlers",
  brackets: "Brackets",
  scores: "Score Updates",
  payouts: "Payout Summary",
};

const PAGE_REQUIRES_SESSION = {
  session: false,
  bowlers: true,
  brackets: true,
  scores: true,
  payouts: true,
};

export function SidebarNav({ snapshot, hasLoadedSession, activePage, setActivePage, status }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">BB</div>
        <div>
          <div className="brand-title">Bracket Manager</div>
          <div className="brand-sub">League control center</div>
        </div>
      </div>

      <div className="session-chip">
        {snapshot?.session
          ? `${snapshot.session.name} (#${snapshot.session.id})`
          : "No session selected"}
      </div>

      <nav className="nav">
        {Object.entries(PAGE_LABELS).map(([key, label]) => {
          const requiresSession = PAGE_REQUIRES_SESSION[key];
          const hidden = requiresSession && !hasLoadedSession;
          const locked = requiresSession && !hasLoadedSession;
          return (
            <button
              key={key}
              type="button"
              className={`nav-item ${activePage === key ? "is-active" : ""} ${hidden ? "is-hidden" : ""} ${locked ? "is-locked" : ""}`}
              onClick={() => {
                if (!locked) setActivePage(key);
              }}
            >
              {label}
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        className={`settings-shortcut ${activePage === "settings" ? "is-active" : ""}`}
        onClick={() => setActivePage("settings")}
      >
        <span className="settings-shortcut-icon">⚙</span>
        <span>Settings</span>
      </button>

      <div className="sidebar-footer">
        <div className="status-label">Status</div>
        <div className="status">{status}</div>
      </div>
    </aside>
  );
}
