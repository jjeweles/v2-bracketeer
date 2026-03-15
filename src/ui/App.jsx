import { useEffect, useMemo, useState } from "react";

const PAGE_LABELS = {
  session: "Session",
  bowlers: "Bowlers",
  brackets: "Brackets + Refunds",
  scores: "Score Updates",
  payouts: "Payout Summary",
};

function toMoney(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function toDisplayName(fullName) {
  const trimmed = String(fullName ?? "").trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/);
  const last = parts.pop() ?? "";
  const first = parts.join(" ");
  return first ? `${last}, ${first}` : last;
}

function compareDisplayNames(a, b) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

async function api(path, init) {
  const headers = new Headers(init?.headers ?? {});
  if (!(init?.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const res = await fetch(path, {
    headers,
    ...init,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export function App() {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [status, setStatus] = useState("Ready");
  const [activePage, setActivePage] = useState("session");
  const [gameNumber, setGameNumber] = useState(1);
  const [bowlerSearchQuery, setBowlerSearchQuery] = useState("");
  const [selectedBowlerPdfName, setSelectedBowlerPdfName] = useState("");

  const [sessionFormDefaults, setSessionFormDefaults] = useState({
    name: "",
    entryFeeDollars: 5,
    handicapPercent: 80,
    handicapBase: 220,
    payoutFirstDollars: 25,
    payoutSecondDollars: 10,
  });

  const [bowlerFormDefaults, setBowlerFormDefaults] = useState({
    name: "",
    average: "",
    scratchEntries: 0,
    handicapEntries: 0,
  });

  const [nameDrafts, setNameDrafts] = useState({});
  const [averageDrafts, setAverageDrafts] = useState({});
  const [scratchEntriesDrafts, setScratchEntriesDrafts] = useState({});
  const [handicapEntriesDrafts, setHandicapEntriesDrafts] = useState({});
  const [editingCell, setEditingCell] = useState(null);
  const [scoreDrafts, setScoreDrafts] = useState({});

  const [confirmState, setConfirmState] = useState({
    open: false,
    bowlerId: null,
    message: "",
  });
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundPaidBySession, setRefundPaidBySession] = useState({});

  const hasLoadedSession = Boolean(snapshot?.session);

  const sortedBowlers = useMemo(() => {
    const bowlers = snapshot?.bowlers ?? [];
    return [...bowlers]
      .map((b) => ({ ...b, displayName: toDisplayName(b.name) }))
      .sort((a, b) => compareDisplayNames(a.displayName, b.displayName));
  }, [snapshot]);

  const filteredBowlers = useMemo(() => {
    const q = bowlerSearchQuery.trim().toLowerCase();
    if (!q) return sortedBowlers;
    return sortedBowlers.filter((b) => {
      return b.displayName.toLowerCase().includes(q) || b.name.toLowerCase().includes(q);
    });
  }, [sortedBowlers, bowlerSearchQuery]);

  const requiredScorers = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.requiredScorersByGame?.[`game${gameNumber}`] ?? [];
  }, [snapshot, gameNumber]);

  useEffect(() => {
    if (!hasLoadedSession && activePage !== "session") {
      setActivePage("session");
    }
  }, [hasLoadedSession, activePage]);

  useEffect(() => {
    const nextName = {};
    const next = {};
    const nextScratch = {};
    const nextHandicap = {};
    for (const b of snapshot?.bowlers ?? []) {
      nextName[b.id] = b.name;
      next[b.id] = String(b.average);
      nextScratch[b.id] = String(b.scratch_entries);
      nextHandicap[b.id] = String(b.handicap_entries);
    }
    setNameDrafts(nextName);
    setAverageDrafts(next);
    setScratchEntriesDrafts(nextScratch);
    setHandicapEntriesDrafts(nextHandicap);
    setEditingCell(null);
  }, [snapshot]);

  useEffect(() => {
    setBowlerSearchQuery("");
  }, [activeSessionId]);

  useEffect(() => {
    const next = {};
    const existingByBowler = new Map();
    for (const row of snapshot?.scores ?? []) {
      if (row.game_number === gameNumber) {
        existingByBowler.set(row.bowler_id, row.scratch_score);
      }
    }

    for (const scorer of requiredScorers) {
      const existing = existingByBowler.get(scorer.bowlerId);
      next[scorer.bowlerId] = existing == null ? "" : String(existing);
    }

    setScoreDrafts(next);
  }, [snapshot, gameNumber, requiredScorers]);

  useEffect(() => {
    void init();
  }, []);

  async function init() {
    try {
      const loadedSessions = await loadSessions();
      if (loadedSessions.length > 0) {
        const firstId = loadedSessions[0].id;
        setActiveSessionId(firstId);
        await loadSnapshot(firstId);
      }
      setStatus("Ready");
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function loadSessions() {
    const data = await api("/api/sessions");
    setSessions(data.sessions);
    return data.sessions;
  }

  async function loadSnapshot(sessionId = activeSessionId) {
    if (!sessionId) {
      setStatus("Select a session first");
      return null;
    }

    const nextSnapshot = await api(`/api/sessions/${sessionId}/snapshot`);
    setSnapshot(nextSnapshot);
    return nextSnapshot;
  }

  async function onCreateSession(e) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);

    try {
      setStatus("Creating session...");
      const created = await api("/api/sessions", {
        method: "POST",
        body: form,
      });

      const loadedSessions = await loadSessions();
      const newest = loadedSessions[0]?.id ?? null;
      setActiveSessionId(newest);

      if (newest) {
        await loadSnapshot(newest);
      }

      setSessionFormDefaults({
        name: "",
        entryFeeDollars: 5,
        handicapPercent: 80,
        handicapBase: 220,
        payoutFirstDollars: 25,
        payoutSecondDollars: 10,
      });
      setSelectedBowlerPdfName("");
      formEl.reset();

      const importedCount = Number(created.importedBowlers ?? 0);
      const skippedCount = Number(created.skippedBowlers ?? 0);
      if (importedCount > 0 || skippedCount > 0) {
        setStatus(`Session created. Imported ${importedCount} bowlers (${skippedCount} skipped).`);
      } else {
        setStatus("Session created");
      }
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function onRefreshSessions() {
    try {
      await loadSessions();
      setStatus("Sessions refreshed");
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function onSessionChange(e) {
    const nextId = Number(e.target.value);
    setActiveSessionId(nextId);
    try {
      await loadSnapshot(nextId);
      setStatus("Session loaded");
    } catch (err) {
      setSnapshot(null);
      setStatus(err.message);
    }
  }

  async function onLoadSnapshot() {
    try {
      await loadSnapshot();
      setStatus("Session loaded");
    } catch (err) {
      setSnapshot(null);
      setStatus(err.message);
    }
  }

  async function onAddBowler(e) {
    e.preventDefault();
    if (!activeSessionId) {
      setStatus("Select session first");
      return;
    }

    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());

    try {
      await api(`/api/sessions/${activeSessionId}/bowlers`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await loadSnapshot(activeSessionId);
      setBowlerFormDefaults({ name: "", average: "", scratchEntries: 0, handicapEntries: 0 });
      setStatus("Bowler added");
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function onUpdateAverage(bowlerId) {
    const average = Number(averageDrafts[bowlerId]);
    await updateBowlerField(bowlerId, { average }, "Average");
  }

  async function updateBowlerField(bowlerId, patch, label) {
    if (!activeSessionId) {
      setStatus("Select session first");
      return;
    }

    try {
      setStatus(`Updating ${label.toLowerCase()}...`);
      await api(`/api/sessions/${activeSessionId}/bowlers/${bowlerId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await loadSnapshot(activeSessionId);
      await loadSessions();
      setEditingCell(null);
      setStatus(`${label} updated`);
    } catch (err) {
      setStatus(err.message);
    }
  }

  function cancelCellEdit(bowlerId, field, sourceBowler) {
    if (field === "name") {
      setNameDrafts((prev) => ({ ...prev, [bowlerId]: sourceBowler.name }));
    }
    if (field === "average") {
      setAverageDrafts((prev) => ({ ...prev, [bowlerId]: String(sourceBowler.average) }));
    }
    if (field === "scratch_entries") {
      setScratchEntriesDrafts((prev) => ({ ...prev, [bowlerId]: String(sourceBowler.scratch_entries) }));
    }
    if (field === "handicap_entries") {
      setHandicapEntriesDrafts((prev) => ({ ...prev, [bowlerId]: String(sourceBowler.handicap_entries) }));
    }
    setEditingCell(null);
  }

  function onClickDelete(bowlerId) {
    const hasBrackets = (snapshot?.brackets?.length ?? 0) > 0;
    setConfirmState({
      open: true,
      bowlerId,
      message: hasBrackets
        ? "Delete this bowler? Existing brackets and refunds will be cleared and must be regenerated."
        : "Delete this bowler? This action cannot be undone.",
    });
  }

  async function confirmDelete() {
    const bowlerId = confirmState.bowlerId;
    setConfirmState({ open: false, bowlerId: null, message: "" });
    if (!Number.isFinite(bowlerId) || !activeSessionId) {
      return;
    }

    try {
      setStatus("Deleting bowler...");
      await api(`/api/sessions/${activeSessionId}/bowlers/${bowlerId}`, {
        method: "DELETE",
      });
      await loadSnapshot(activeSessionId);
      setStatus("Bowler deleted");
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function onGenerateBrackets() {
    if (!activeSessionId) {
      setStatus("Select session first");
      return;
    }

    try {
      const nextSnapshot = await api(`/api/sessions/${activeSessionId}/generate-brackets`, {
        method: "POST",
      });
      setSnapshot(nextSnapshot);
      setRefundModalOpen(false);
      setStatus("Brackets generated");
    } catch (err) {
      setStatus(err.message);
    }
  }

  function toggleRefundPaid(bowlerId) {
    if (!activeSessionId) return;
    setRefundPaidBySession((prev) => {
      const sessionMarks = { ...(prev[activeSessionId] ?? {}) };
      sessionMarks[bowlerId] = !sessionMarks[bowlerId];
      return { ...prev, [activeSessionId]: sessionMarks };
    });
  }

  async function onSaveScores() {
    if (!activeSessionId || !snapshot) {
      setStatus("Select and load a session first");
      return;
    }

    const scores = [];
    for (const scorer of requiredScorers) {
      const value = scoreDrafts[scorer.bowlerId];
      if (value === "") continue;
      scores.push({
        bowlerId: scorer.bowlerId,
        scratchScore: Number(value),
      });
    }

    if (scores.length === 0) {
      setStatus("No scores entered");
      return;
    }

    try {
      const nextSnapshot = await api(`/api/sessions/${activeSessionId}/scores`, {
        method: "POST",
        body: JSON.stringify({ gameNumber, scores }),
      });
      setSnapshot(nextSnapshot);
      setStatus(`Saved game ${gameNumber} scores`);
    } catch (err) {
      setStatus(err.message);
    }
  }

  function renderSessionSummary() {
    if (!snapshot) {
      return "No session loaded yet.";
    }

    const s = snapshot.session;
    return JSON.stringify(
      {
        id: s.id,
        name: s.name,
        entryFee: toMoney(s.entry_fee_cents),
        handicap: `${s.handicap_percent}% of ${s.handicap_base}`,
        payoutFirst: toMoney(s.payout_first_cents),
        payoutSecond: toMoney(s.payout_second_cents),
        bowlers: snapshot.bowlers.length,
        brackets: snapshot.brackets.length,
      },
      null,
      2
    );
  }

  const refundTotals = snapshot?.refundTotals ?? [];
  const payouts = snapshot?.payoutTotals ?? [];
  const totalRefunds = refundTotals.reduce((acc, row) => acc + row.amountCents, 0);
  const totalPayouts = payouts.reduce((acc, row) => acc + row.amountCents, 0);
  const kpis = [
    { label: "Active Bowlers", value: String(snapshot?.bowlers?.length ?? 0) },
    { label: "Generated Brackets", value: String(snapshot?.brackets?.length ?? 0) },
    { label: "Refund Exposure", value: toMoney(totalRefunds) },
    { label: "Payouts Posted", value: toMoney(totalPayouts) },
  ];
  const paidRefundMap = refundPaidBySession[activeSessionId] ?? {};

  return (
    <>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">BB</div>
            <div>
              <div className="brand-title">Bracket Manager</div>
              <div className="brand-sub">League control center</div>
            </div>
          </div>

          <div className="session-chip">
            {snapshot?.session ? `${snapshot.session.name} (#${snapshot.session.id})` : "No session selected"}
          </div>

          <nav className="nav">
            {Object.entries(PAGE_LABELS).map(([key, label]) => {
              const requiresSession = key !== "session";
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

          <div className="sidebar-footer">
            <div className="status-label">Status</div>
            <div className="status">{status}</div>
          </div>
        </aside>

        <main className="content">
          <header className="topbar">
            <div className="topbar-title">
              <p>League Night Dashboard</p>
            </div>
            <div className="topbar-actions">
              <span className="pill">{snapshot?.session ? `Session #${snapshot.session.id}` : "No Session"}</span>
              <span className="pill status-pill">{status}</span>
            </div>
          </header>

          <section className="metric-strip">
            {kpis.map((kpi) => (
              <article key={kpi.label} className="metric-card">
                <p>{kpi.label}</p>
                <h3>{kpi.value}</h3>
              </article>
            ))}
          </section>

          <section className={`page ${activePage === "session" ? "is-active" : ""}`}>
            <header className="page-head">
              <div>
                <p className="eyebrow">Session Hub</p>
                <h1>Start or load a session</h1>
                <p className="subhead">
                  Create a new session or select an existing one. Once loaded, the rest of the workflow unlocks.
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
                      onChange={(e) => setSessionFormDefaults((p) => ({ ...p, name: e.target.value }))}
                    />
                  </label>
                  <label>
                    Entry Fee ($)
                    <input
                      name="entryFeeDollars"
                      type="number"
                      step="0.01"
                      value={sessionFormDefaults.entryFeeDollars}
                      onChange={(e) => setSessionFormDefaults((p) => ({ ...p, entryFeeDollars: e.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Handicap %
                    <input
                      name="handicapPercent"
                      type="number"
                      value={sessionFormDefaults.handicapPercent}
                      onChange={(e) => setSessionFormDefaults((p) => ({ ...p, handicapPercent: e.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Handicap Base
                    <input
                      name="handicapBase"
                      type="number"
                      value={sessionFormDefaults.handicapBase}
                      onChange={(e) => setSessionFormDefaults((p) => ({ ...p, handicapBase: e.target.value }))}
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
                      onChange={(e) => setSessionFormDefaults((p) => ({ ...p, payoutFirstDollars: e.target.value }))}
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
                      onChange={(e) => setSessionFormDefaults((p) => ({ ...p, payoutSecondDollars: e.target.value }))}
                      required
                    />
                  </label>
                  <div className="file-label">
                    <span>League Bowler PDF (optional)</span>
                    <div className="file-upload">
                      <input
                        id="bowlerPdf"
                        className="file-input"
                        name="bowlerPdf"
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={(e) => setSelectedBowlerPdfName(e.target.files?.[0]?.name ?? "")}
                      />
                      <label htmlFor="bowlerPdf" className="file-btn">
                        Choose PDF
                      </label>
                      <span className="file-name">{selectedBowlerPdfName || "No file selected"}</span>
                    </div>
                  </div>
                  <button type="submit">Create Session</button>
                </form>
              </section>

              <section className="card">
                <h2>Select Session</h2>
                <div className="row">
                  <select value={activeSessionId ?? ""} onChange={onSessionChange}>
                    {sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.name} (#{session.id})
                      </option>
                    ))}
                  </select>
                  <button className="button secondary" type="button" onClick={onRefreshSessions}>
                    Refresh
                  </button>
                  <button className="button secondary" type="button" onClick={onLoadSnapshot}>
                    Load Session
                  </button>
                </div>
                <pre className="panel">{renderSessionSummary()}</pre>
              </section>
            </div>
          </section>

          <section className={`page ${activePage === "bowlers" ? "is-active" : ""}`}>
            <header className="page-head">
              <div>
                <p className="eyebrow">Roster</p>
                <h1>Add bowlers</h1>
                <p className="subhead">Capture roster details before generating brackets.</p>
              </div>
            </header>

            <section className="card">
              <form className="grid" onSubmit={onAddBowler}>
                <label>
                  Name
                  <input
                    required
                    name="name"
                    value={bowlerFormDefaults.name}
                    onChange={(e) => setBowlerFormDefaults((p) => ({ ...p, name: e.target.value }))}
                  />
                </label>
                <label>
                  Average
                  <input
                    required
                    name="average"
                    type="number"
                    min="0"
                    value={bowlerFormDefaults.average}
                    onChange={(e) => setBowlerFormDefaults((p) => ({ ...p, average: e.target.value }))}
                  />
                </label>
                <label>
                  Scratch Entries
                  <input
                    required
                    name="scratchEntries"
                    type="number"
                    min="0"
                    value={bowlerFormDefaults.scratchEntries}
                    onChange={(e) => setBowlerFormDefaults((p) => ({ ...p, scratchEntries: e.target.value }))}
                  />
                </label>
                <label>
                  Handicap Entries
                  <input
                    required
                    name="handicapEntries"
                    type="number"
                    min="0"
                    value={bowlerFormDefaults.handicapEntries}
                    onChange={(e) => setBowlerFormDefaults((p) => ({ ...p, handicapEntries: e.target.value }))}
                  />
                </label>
                <button type="submit">Add Bowler</button>
              </form>

              <div className="row">
                <input
                  className="bowler-search-input"
                  type="search"
                  placeholder="Search bowlers by name..."
                  value={bowlerSearchQuery}
                  onChange={(e) => setBowlerSearchQuery(e.target.value)}
                />
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
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBowlers.map((bowler) => (
                        <tr key={bowler.id}>
                          <td>
                            {editingCell?.bowlerId === bowler.id && editingCell?.field === "name" ? (
                              <div className="avg-edit-wrap">
                                <input
                                  className="avg-input"
                                  autoFocus
                                  value={nameDrafts[bowler.id] ?? ""}
                                  onChange={(e) => {
                                    const next = e.target.value;
                                    setNameDrafts((prev) => ({ ...prev, [bowler.id]: next }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      const name = String(nameDrafts[bowler.id] ?? "").trim();
                                      void updateBowlerField(bowler.id, { name }, "Name");
                                    }
                                    if (e.key === "Escape") {
                                      e.preventDefault();
                                      cancelCellEdit(bowler.id, "name", bowler);
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  className="mini-btn"
                                  onClick={() => {
                                    const name = String(nameDrafts[bowler.id] ?? "").trim();
                                    void updateBowlerField(bowler.id, { name }, "Name");
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="mini-btn secondary"
                                  onClick={() => cancelCellEdit(bowler.id, "name", bowler)}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="avg-display"
                                onClick={() => {
                                  setNameDrafts((prev) => ({ ...prev, [bowler.id]: bowler.name }));
                                  setEditingCell({ bowlerId: bowler.id, field: "name" });
                                }}
                              >
                                {bowler.displayName}
                              </button>
                            )}
                          </td>
                          <td>
                            {editingCell?.bowlerId === bowler.id && editingCell?.field === "average" ? (
                              <div className="avg-edit-wrap">
                                <input
                                  className="avg-input"
                                  type="number"
                                  min="0"
                                  autoFocus
                                  value={averageDrafts[bowler.id] ?? ""}
                                  onChange={(e) => {
                                    const next = e.target.value;
                                    setAverageDrafts((prev) => ({ ...prev, [bowler.id]: next }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      void onUpdateAverage(bowler.id);
                                    }
                                    if (e.key === "Escape") {
                                      e.preventDefault();
                                      cancelCellEdit(bowler.id, "average", bowler);
                                    }
                                  }}
                                />
                                <button type="button" className="mini-btn" onClick={() => void onUpdateAverage(bowler.id)}>
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="mini-btn secondary"
                                  onClick={() => cancelCellEdit(bowler.id, "average", bowler)}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="avg-display"
                                onClick={() => {
                                  setAverageDrafts((prev) => ({ ...prev, [bowler.id]: String(bowler.average) }));
                                  setEditingCell({ bowlerId: bowler.id, field: "average" });
                                }}
                              >
                                {bowler.average}
                              </button>
                            )}
                          </td>
                          <td>{bowler.handicap_value}</td>
                          <td>
                            {editingCell?.bowlerId === bowler.id && editingCell?.field === "scratch_entries" ? (
                              <div className="avg-edit-wrap">
                                <input
                                  className="avg-input"
                                  type="number"
                                  min="0"
                                  autoFocus
                                  value={scratchEntriesDrafts[bowler.id] ?? ""}
                                  onChange={(e) => {
                                    const next = e.target.value;
                                    setScratchEntriesDrafts((prev) => ({ ...prev, [bowler.id]: next }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      const scratchEntries = Number(scratchEntriesDrafts[bowler.id]);
                                      void updateBowlerField(bowler.id, { scratchEntries }, "Scratch entries");
                                    }
                                    if (e.key === "Escape") {
                                      e.preventDefault();
                                      cancelCellEdit(bowler.id, "scratch_entries", bowler);
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  className="mini-btn"
                                  onClick={() => {
                                    const scratchEntries = Number(scratchEntriesDrafts[bowler.id]);
                                    void updateBowlerField(bowler.id, { scratchEntries }, "Scratch entries");
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="mini-btn secondary"
                                  onClick={() => cancelCellEdit(bowler.id, "scratch_entries", bowler)}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="avg-display"
                                onClick={() => {
                                  setScratchEntriesDrafts((prev) => ({
                                    ...prev,
                                    [bowler.id]: String(bowler.scratch_entries),
                                  }));
                                  setEditingCell({ bowlerId: bowler.id, field: "scratch_entries" });
                                }}
                              >
                                {bowler.scratch_entries}
                              </button>
                            )}
                          </td>
                          <td>
                            {editingCell?.bowlerId === bowler.id && editingCell?.field === "handicap_entries" ? (
                              <div className="avg-edit-wrap">
                                <input
                                  className="avg-input"
                                  type="number"
                                  min="0"
                                  autoFocus
                                  value={handicapEntriesDrafts[bowler.id] ?? ""}
                                  onChange={(e) => {
                                    const next = e.target.value;
                                    setHandicapEntriesDrafts((prev) => ({ ...prev, [bowler.id]: next }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      const handicapEntries = Number(handicapEntriesDrafts[bowler.id]);
                                      void updateBowlerField(bowler.id, { handicapEntries }, "Handicap entries");
                                    }
                                    if (e.key === "Escape") {
                                      e.preventDefault();
                                      cancelCellEdit(bowler.id, "handicap_entries", bowler);
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  className="mini-btn"
                                  onClick={() => {
                                    const handicapEntries = Number(handicapEntriesDrafts[bowler.id]);
                                    void updateBowlerField(bowler.id, { handicapEntries }, "Handicap entries");
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="mini-btn secondary"
                                  onClick={() => cancelCellEdit(bowler.id, "handicap_entries", bowler)}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="avg-display"
                                onClick={() => {
                                  setHandicapEntriesDrafts((prev) => ({
                                    ...prev,
                                    [bowler.id]: String(bowler.handicap_entries),
                                  }));
                                  setEditingCell({ bowlerId: bowler.id, field: "handicap_entries" });
                                }}
                              >
                                {bowler.handicap_entries}
                              </button>
                            )}
                          </td>
                          <td className="actions">
                            <button
                              type="button"
                              className="icon-button danger"
                              onClick={() => onClickDelete(bowler.id)}
                            >
                              Delete
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

          <section className={`page ${activePage === "brackets" ? "is-active" : ""}`}>
            <header className="page-head">
              <div>
                <p className="eyebrow">Brackets</p>
                <h1>Generate brackets and refunds</h1>
                <p className="subhead">Create the bracket structure once the roster is locked.</p>
              </div>
            </header>

            <section className="card">
              <div className="row">
                <button type="button" onClick={onGenerateBrackets}>
                  Generate Brackets
                </button>
                {refundTotals.length > 0 && (
                  <button type="button" className="button secondary" onClick={() => setRefundModalOpen(true)}>
                    View Refunds
                  </button>
                )}
              </div>

              <div className="panel">
                {(snapshot?.brackets?.length ?? 0) === 0 ? (
                  <div>No brackets generated</div>
                ) : (
                  snapshot.brackets.map((br) => (
                    <div className="bracket-card" key={`${br.kind}-${br.bracketNumber}`}>
                      <strong>{`${br.kind.toUpperCase()} Bracket #${br.bracketNumber}`}</strong>
                      <br />
                      <span>Seeds: {br.seeds.map((s) => `${s.seed}. ${s.bowlerName}`).join(" | ")}</span>
                      {br.rounds.map((round) => (
                        <div key={`${br.kind}-${br.bracketNumber}-r${round.round}`}>
                          <strong>{`Round ${round.round}`}</strong>
                          <ul>
                            {round.matches.map((match) => {
                              const names = match.contenders
                                .map((c) => `${c.name}${c.score == null ? "" : ` (${c.score})`}`)
                                .join(" vs ");
                              const advancers = match.advancers
                                .map((id) => match.contenders.find((c) => c.bowlerId === id)?.name || `#${id}`)
                                .join(", ");
                              return (
                                <li key={match.label}>{`${match.label}: ${names} -> Adv: ${advancers || "pending"}`}</li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </section>
          </section>

          <section className={`page ${activePage === "scores" ? "is-active" : ""}`}>
            <header className="page-head">
              <div>
                <p className="eyebrow">Scoring</p>
                <h1>Update scores</h1>
                <p className="subhead">Enter scores by game to advance brackets automatically.</p>
              </div>
            </header>

            <section className="card">
              <div className="row">
                <label>
                  Game
                  <select value={gameNumber} onChange={(e) => setGameNumber(Number(e.target.value))}>
                    <option value={1}>Game 1</option>
                    <option value={2}>Game 2</option>
                    <option value={3}>Game 3</option>
                  </select>
                </label>
                <button type="button" onClick={onSaveScores}>
                  Save Scores
                </button>
              </div>

              <div className="panel score-panel">
                {requiredScorers.length === 0 ? (
                  <div>No active bowlers need scores for this game yet</div>
                ) : (
                  requiredScorers.map((s) => (
                    <label key={s.bowlerId} className="score-row">
                      {s.name}
                      <input
                        type="number"
                        min="0"
                        value={scoreDrafts[s.bowlerId] ?? ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          setScoreDrafts((prev) => ({ ...prev, [s.bowlerId]: value }));
                        }}
                      />
                    </label>
                  ))
                )}
              </div>
            </section>
          </section>

          <section className={`page ${activePage === "payouts" ? "is-active" : ""}`}>
            <header className="page-head">
              <div>
                <p className="eyebrow">Payouts</p>
                <h1>Payout summary</h1>
                <p className="subhead">Track payouts as brackets complete.</p>
              </div>
            </header>

            <section className="card">
              <div className="panel">
                {payouts.length === 0
                  ? "No completed brackets yet"
                  : payouts.map((p) => <div key={p.bowlerId}>{`${p.name}: ${toMoney(p.amountCents)}`}</div>)}
              </div>
            </section>
          </section>
        </main>
      </div>

      <div
        className={`modal ${confirmState.open ? "" : "is-hidden"}`}
        aria-hidden={confirmState.open ? "false" : "true"}
        onClick={(e) => {
          if (e.currentTarget === e.target) {
            setConfirmState({ open: false, bowlerId: null, message: "" });
          }
        }}
      >
        <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <h2 id="confirm-title">Confirm Delete</h2>
          <p>{confirmState.message}</p>
          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setConfirmState({ open: false, bowlerId: null, message: "" });
                setStatus("Delete cancelled");
              }}
            >
              Cancel
            </button>
            <button type="button" className="icon-button danger" onClick={() => void confirmDelete()}>
              Delete
            </button>
          </div>
        </div>
      </div>

      <div
        className={`modal ${refundModalOpen ? "" : "is-hidden"}`}
        aria-hidden={refundModalOpen ? "false" : "true"}
        onClick={(e) => {
          if (e.currentTarget === e.target) {
            setRefundModalOpen(false);
          }
        }}
      >
        <div className="modal-card refund-modal-card" role="dialog" aria-modal="true" aria-labelledby="refund-title">
          <h2 id="refund-title">Refund Queue</h2>
          <p>Mark each bowler once their refund has been paid.</p>
          <div className="refund-list">
            {refundTotals.length === 0 ? (
              <div className="refund-empty">No refunds for this bracket run.</div>
            ) : (
              refundTotals.map((row) => {
                const isPaid = Boolean(paidRefundMap[row.bowlerId]);
                return (
                  <div className={`refund-row ${isPaid ? "is-paid" : ""}`} key={row.bowlerId}>
                    <div className="refund-meta">
                      <strong>{row.name}</strong>
                      <span>{toMoney(row.amountCents)}</span>
                    </div>
                    <button
                      type="button"
                      className={`mini-btn ${isPaid ? "secondary" : ""}`}
                      onClick={() => toggleRefundPaid(row.bowlerId)}
                    >
                      {isPaid ? "Undo" : "Mark Paid"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={() => setRefundModalOpen(false)}>
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
