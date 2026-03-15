const state = {
  sessions: [],
  activeSessionId: null,
  snapshot: null,
  activePage: "session",
  pendingDeleteBowlerId: null,
};

const el = {
  status: document.querySelector("#status"),
  sessionSelect: document.querySelector("#session-select"),
  sessionSummary: document.querySelector("#session-summary"),
  bowlers: document.querySelector("#bowlers"),
  refunds: document.querySelector("#refunds"),
  brackets: document.querySelector("#brackets"),
  payouts: document.querySelector("#payouts"),
  scoreGrid: document.querySelector("#score-grid"),
  gameNumber: document.querySelector("#game-number"),
  activeSessionLabel: document.querySelector("#active-session-label"),
  navItems: Array.from(document.querySelectorAll("[data-page-tab]")),
  pages: Array.from(document.querySelectorAll(".page")),
  confirmModal: document.querySelector("#confirm-modal"),
  confirmMessage: document.querySelector("#confirm-message"),
  confirmAccept: document.querySelector("#confirm-accept"),
  confirmCancel: document.querySelector("#confirm-cancel"),
};

function setStatus(msg) {
  el.status.textContent = msg;
}

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
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function hasLoadedSession() {
  return Boolean(state.snapshot?.session);
}

function updateNavState() {
  const hasSession = hasLoadedSession();
  if (hasSession) {
    const session = state.snapshot.session;
    el.activeSessionLabel.textContent = `${session.name} (#${session.id})`;
  } else {
    el.activeSessionLabel.textContent = "No session selected";
  }

  for (const item of el.navItems) {
    const requiresSession = item.dataset.requiresSession === "true";
    if (requiresSession) {
      item.classList.toggle("is-hidden", !hasSession);
      item.classList.toggle("is-locked", !hasSession);
      item.disabled = !hasSession;
    }
  }

  if (!hasSession && state.activePage !== "session") {
    setActivePage("session");
  }
}

function setActivePage(page) {
  state.activePage = page;
  for (const section of el.pages) {
    section.classList.toggle("is-active", section.dataset.page === page);
  }
  for (const item of el.navItems) {
    item.classList.toggle("is-active", item.dataset.page === page);
  }
}

async function loadSessions() {
  const data = await api("/api/sessions");
  state.sessions = data.sessions;
  el.sessionSelect.innerHTML = "";
  for (const session of state.sessions) {
    const opt = document.createElement("option");
    opt.value = String(session.id);
    opt.textContent = `${session.name} (#${session.id})`;
    el.sessionSelect.appendChild(opt);
  }
  if (state.sessions.length && !state.activeSessionId) {
    state.activeSessionId = state.sessions[0].id;
    el.sessionSelect.value = String(state.activeSessionId);
  }
}

function renderSummary() {
  const snap = state.snapshot;
  if (!snap) {
    el.sessionSummary.textContent = "No session loaded yet.";
    return;
  }

  const s = snap.session;
  el.sessionSummary.textContent = JSON.stringify(
    {
      id: s.id,
      name: s.name,
      entryFee: toMoney(s.entry_fee_cents),
      handicap: `${s.handicap_percent}% of ${s.handicap_base}`,
      payoutFirst: toMoney(s.payout_first_cents),
      payoutSecond: toMoney(s.payout_second_cents),
      bowlers: snap.bowlers.length,
      brackets: snap.brackets.length,
    },
    null,
    2
  );
}

async function handleSaveAverage(bowlerId, average) {
  if (!state.activeSessionId) {
    setStatus("Select session first");
    return;
  }
  if (!Number.isFinite(average) || average < 0) {
    setStatus("Average must be a non-negative number");
    return;
  }
  try {
    setStatus("Updating average...");
    await api(`/api/sessions/${state.activeSessionId}/bowlers/${bowlerId}`, {
      method: "PATCH",
      body: JSON.stringify({ average }),
    });
    await loadSnapshot();
    setStatus("Average updated");
  } catch (err) {
    setStatus(err.message);
  }
}

async function handleDeleteBowler(bowlerId) {
  if (!state.activeSessionId) {
    setStatus("Select session first");
    return;
  }
  try {
    setStatus("Deleting bowler...");
    await api(`/api/sessions/${state.activeSessionId}/bowlers/${bowlerId}`, {
      method: "DELETE",
    });
    await loadSnapshot();
    setStatus("Bowler deleted");
  } catch (err) {
    setStatus(err.message);
  }
}

function openDeleteModal(bowlerId) {
  const hasBrackets = (state.snapshot?.brackets?.length ?? 0) > 0;
  state.pendingDeleteBowlerId = bowlerId;
  el.confirmMessage.textContent = hasBrackets
    ? "Delete this bowler? Existing brackets and refunds will be cleared and must be regenerated."
    : "Delete this bowler? This action cannot be undone.";
  el.confirmModal.classList.remove("is-hidden");
  el.confirmModal.setAttribute("aria-hidden", "false");
}

function closeDeleteModal() {
  state.pendingDeleteBowlerId = null;
  el.confirmModal.classList.add("is-hidden");
  el.confirmModal.setAttribute("aria-hidden", "true");
}

function renderBowlers() {
  const rawBowlers = state.snapshot?.bowlers || [];
  if (!rawBowlers.length) {
    el.bowlers.textContent = "No bowlers yet";
    return;
  }

  const bowlers = rawBowlers
    .map((b) => ({ ...b, displayName: toDisplayName(b.name) }))
    .sort((a, b) => compareDisplayNames(a.displayName, b.displayName));

  const rows = bowlers
    .map(
      (b) => `<tr>
      <td>${b.displayName}</td>
      <td>
        <input class="avg-input" type="number" min="0" value="${b.average}" data-bowler-id="${b.id}" />
      </td>
      <td>${b.handicap_value}</td>
      <td>${b.scratch_entries}</td>
      <td>${b.handicap_entries}</td>
      <td class="actions">
        <button type="button" class="icon-button" data-action="save-average" data-bowler-id="${b.id}">Update</button>
        <button type="button" class="icon-button danger" data-action="delete-bowler" data-bowler-id="${b.id}">Delete</button>
      </td>
    </tr>`
    )
    .join("");

  el.bowlers.innerHTML = `<table>
    <thead><tr><th>Name</th><th>Avg</th><th>Hdcp</th><th>Scratch Entries</th><th>Handicap Entries</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;

  for (const button of el.bowlers.querySelectorAll('button[data-action="save-average"]')) {
    button.addEventListener("click", async () => {
      const bowlerId = Number(button.dataset.bowlerId);
      if (!Number.isFinite(bowlerId)) return;
      const row = button.closest("tr");
      const input = row?.querySelector(".avg-input");
      const average = Number(input?.value);
      await handleSaveAverage(bowlerId, average);
    });
  }

  for (const button of el.bowlers.querySelectorAll('button[data-action="delete-bowler"]')) {
    button.addEventListener("click", async () => {
      const bowlerId = Number(button.dataset.bowlerId);
      if (!Number.isFinite(bowlerId)) return;
      openDeleteModal(bowlerId);
    });
  }

  for (const input of el.bowlers.querySelectorAll(".avg-input")) {
    input.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const bowlerId = Number(input.dataset.bowlerId);
      const average = Number(input.value);
      await handleSaveAverage(bowlerId, average);
    });
  }
}

el.confirmCancel.addEventListener("click", () => {
  closeDeleteModal();
  setStatus("Delete cancelled");
});

el.confirmAccept.addEventListener("click", async () => {
  const bowlerId = state.pendingDeleteBowlerId;
  if (!Number.isFinite(bowlerId)) {
    closeDeleteModal();
    return;
  }
  closeDeleteModal();
  await handleDeleteBowler(bowlerId);
});

el.confirmModal.addEventListener("click", (e) => {
  if (e.target === el.confirmModal) {
    closeDeleteModal();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !el.confirmModal.classList.contains("is-hidden")) {
    closeDeleteModal();
  }
});

function renderRefunds() {
  const refunds = state.snapshot?.refundTotals || [];
  if (!refunds.length) {
    el.refunds.textContent = "No refunds";
    return;
  }

  el.refunds.innerHTML = refunds
    .map((r) => `${r.name}: ${toMoney(r.amountCents)}`)
    .join("<br />");
}

function renderBrackets() {
  const brackets = state.snapshot?.brackets || [];
  if (!brackets.length) {
    el.brackets.textContent = "No brackets generated";
    return;
  }

  el.brackets.innerHTML = brackets
    .map((br) => {
      const seeds = br.seeds.map((s) => `${s.seed}. ${s.bowlerName}`).join(" | ");
      const rounds = br.rounds
        .map((r) => {
          const matches = r.matches
            .map((m) => {
              const names = m.contenders
                .map((c) => `${c.name}${c.score == null ? "" : ` (${c.score})`}`)
                .join(" vs ");
              const advNames = m.advancers
                .map((id) => m.contenders.find((c) => c.bowlerId === id)?.name || `#${id}`)
                .join(", ");
              return `<li>${m.label}: ${names} -> Adv: ${m.advancers.length ? advNames : "pending"}</li>`;
            })
            .join("");
          return `<div><strong>Round ${r.round}</strong><ul>${matches}</ul></div>`;
        })
        .join("");

      return `<div class="bracket-card">
        <strong>${br.kind.toUpperCase()} Bracket #${br.bracketNumber}</strong><br />
        Seeds: ${seeds}
        ${rounds}
      </div>`;
    })
    .join("");
}

function currentScoresByBowler() {
  const game = Number(el.gameNumber.value);
  const map = new Map();
  for (const row of state.snapshot?.scores || []) {
    if (row.game_number === game) {
      map.set(row.bowler_id, row.scratch_score);
    }
  }
  return map;
}

function activeScorersForSelectedGame() {
  if (!state.snapshot) return [];
  const game = Number(el.gameNumber.value);
  const key = `game${game}`;
  return state.snapshot.requiredScorersByGame?.[key] || [];
}

function renderScoreGrid() {
  const scorers = activeScorersForSelectedGame();
  if (!scorers.length) {
    el.scoreGrid.textContent = "No active bowlers need scores for this game yet";
    return;
  }

  const existing = currentScoresByBowler();
  el.scoreGrid.innerHTML = scorers
    .map(
      (s) => `<label>${s.name}
      <input type="number" min="0" class="score-input" data-bowler-id="${s.bowlerId}" value="${
        existing.get(s.bowlerId) ?? ""
      }" />
    </label>`
    )
    .join("");
}

function renderPayouts() {
  const payouts = state.snapshot?.payoutTotals || [];
  if (!payouts.length) {
    el.payouts.textContent = "No completed brackets yet";
    return;
  }

  el.payouts.innerHTML = payouts
    .map((p) => `${p.name}: ${toMoney(p.amountCents)}`)
    .join("<br />");
}

function renderAll() {
  renderSummary();
  renderBowlers();
  renderRefunds();
  renderBrackets();
  renderScoreGrid();
  renderPayouts();
  updateNavState();
}

async function loadSnapshot() {
  if (!state.activeSessionId) {
    setStatus("Select a session first");
    return;
  }
  state.snapshot = await api(`/api/sessions/${state.activeSessionId}/snapshot`);
  renderAll();
}

async function init() {
  await loadSessions();
  if (state.activeSessionId) {
    try {
      await loadSnapshot();
    } catch (err) {
      state.snapshot = null;
      renderAll();
      setStatus(err.message);
    }
  } else {
    updateNavState();
  }
  setStatus("Ready");
}

for (const item of el.navItems) {
  item.addEventListener("click", () => {
    if (item.classList.contains("is-locked")) return;
    setActivePage(item.dataset.page);
  });
}

document.querySelector("#session-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    const payload = Object.fromEntries(form.entries());
    await api("/api/sessions", { method: "POST", body: JSON.stringify(payload) });
    await loadSessions();
    state.activeSessionId = Number(el.sessionSelect.value);
    await loadSnapshot();
    setStatus("Session created");
    e.target.reset();
    e.target.entryFeeDollars.value = "5";
    e.target.handicapPercent.value = "80";
    e.target.handicapBase.value = "220";
    e.target.payoutFirstDollars.value = "25";
    e.target.payoutSecondDollars.value = "10";
  } catch (err) {
    setStatus(err.message);
  }
});

document.querySelector("#refresh-sessions").addEventListener("click", async () => {
  try {
    await loadSessions();
    setStatus("Sessions refreshed");
  } catch (err) {
    setStatus(err.message);
  }
});

el.sessionSelect.addEventListener("change", async () => {
  state.activeSessionId = Number(el.sessionSelect.value);
  try {
    await loadSnapshot();
    setStatus("Session loaded");
  } catch (err) {
    state.snapshot = null;
    renderAll();
    setStatus(err.message);
  }
});

document.querySelector("#load-snapshot").addEventListener("click", async () => {
  try {
    await loadSnapshot();
    setStatus("Session loaded");
  } catch (err) {
    state.snapshot = null;
    renderAll();
    setStatus(err.message);
  }
});

document.querySelector("#bowler-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!state.activeSessionId) {
    setStatus("Select session first");
    return;
  }
  const form = new FormData(e.target);
  try {
    await api(`/api/sessions/${state.activeSessionId}/bowlers`, {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    await loadSnapshot();
    setStatus("Bowler added");
    e.target.reset();
  } catch (err) {
    setStatus(err.message);
  }
});

document.querySelector("#generate-brackets").addEventListener("click", async () => {
  if (!state.activeSessionId) {
    setStatus("Select session first");
    return;
  }
  try {
    state.snapshot = await api(`/api/sessions/${state.activeSessionId}/generate-brackets`, {
      method: "POST",
    });
    renderAll();
    setStatus("Brackets generated");
  } catch (err) {
    setStatus(err.message);
  }
});

document.querySelector("#save-scores").addEventListener("click", async () => {
  if (!state.activeSessionId || !state.snapshot) {
    setStatus("Select and load a session first");
    return;
  }

  const gameNumber = Number(el.gameNumber.value);
  const inputs = document.querySelectorAll(".score-input");
  const scores = [];
  for (const input of inputs) {
    const value = input.value;
    if (value === "") continue;
    scores.push({ bowlerId: Number(input.dataset.bowlerId), scratchScore: Number(value) });
  }

  if (!scores.length) {
    setStatus("No scores entered");
    return;
  }

  try {
    state.snapshot = await api(`/api/sessions/${state.activeSessionId}/scores`, {
      method: "POST",
      body: JSON.stringify({ gameNumber, scores }),
    });
    renderAll();
    setStatus(`Saved game ${gameNumber} scores`);
  } catch (err) {
    setStatus(err.message);
  }
});

el.gameNumber.addEventListener("change", renderScoreGrid);

init().catch((err) => setStatus(err.message));
