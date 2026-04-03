import { useCallback, useEffect, useMemo, useState } from "react";
import { compareDisplayNames, toDisplayName } from "./lib/format";
import { api } from "./lib/api-client";
import { useAppEffects } from "./hooks/useAppEffects";
import { useBracketActions } from "./hooks/useBracketActions";
import { useBowlerActions } from "./hooks/useBowlerActions";
import { useDashboardViewModel } from "./hooks/useDashboardViewModel";
import { usePaymentActions } from "./hooks/usePaymentActions";
import { useScoreActions } from "./hooks/useScoreActions";
import { useSessionDataActions } from "./hooks/useSessionDataActions";
import { useSessionLifecycleActions } from "./hooks/useSessionLifecycleActions";
import { useThemePreference } from "./hooks/useThemePreference";
import { BracketsPage } from "./pages/BracketsPage";
import { BowlersPage } from "./pages/BowlersPage";
import { PayoutsPage } from "./pages/PayoutsPage";
import { ScoresPage } from "./pages/ScoresPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SessionPage } from "./pages/SessionPage";
import { ConfirmDeleteModal } from "./components/modals/ConfirmDeleteModal";
import { OwedModal } from "./components/modals/OwedModal";
import { RefundModal } from "./components/modals/RefundModal";
import { SessionDeleteModal } from "./components/modals/SessionDeleteModal";
import { AddBowlerModal } from "./components/modals/AddBowlerModal";
import { EntrantsModal } from "./components/modals/EntrantsModal";
import { DashboardTopbar } from "./components/layout/DashboardTopbar";
import { MetricStrip } from "./components/layout/MetricStrip";
import { SidebarNav } from "./components/layout/SidebarNav";
import { getDocumentStylesHtml, openAndPrintHtml } from "./lib/print-utils";

export function App() {
  function entriesNeededForFullBrackets(rawCounts) {
    const counts = rawCounts.map((n) => Math.max(0, Math.floor(Number(n) || 0)));
    const bowlerCount = counts.length;
    const totalEntries = counts.reduce((acc, n) => acc + n, 0);

    if (totalEntries === 0) return 0;
    if (bowlerCount < 8) return null;

    const minBrackets = Math.ceil(totalEntries / 8);
    for (let targetBrackets = minBrackets; targetBrackets <= minBrackets + 400; targetBrackets += 1) {
      const neededEntries = targetBrackets * 8 - totalEntries;
      const baseCapacity = counts.reduce((acc, n) => acc + Math.min(n, targetBrackets), 0);
      const deficits = counts.reduce((acc, n) => acc + Math.max(0, targetBrackets - n), 0);
      const bestPossibleCapacity = baseCapacity + Math.min(neededEntries, deficits);
      if (bestPossibleCapacity >= targetBrackets * 8) {
        return neededEntries;
      }
    }
    return null;
  }

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [status, setStatus] = useState("Ready");
  const [activePage, setActivePage] = useState("session");
  const [gameNumber, setGameNumber] = useState(1);
  const [bowlerSearchQuery, setBowlerSearchQuery] = useState("");
  const [importErrorDetails, setImportErrorDetails] = useState("");
  const [updateInfo, setUpdateInfo] = useState({
    checking: false,
    currentVersion: "",
    latestVersion: "",
    isUpdateAvailable: false,
    releaseUrl: "",
    recommendedDownloadUrl: "",
    recommendedAssetName: "",
    assets: [],
    publishedAt: null,
    error: "",
    lastCheckedAt: null,
  });

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
    laneNumber: "",
    average: "",
    scratchEntries: 0,
    handicapEntries: 0,
    payLater: false,
    allBracketsMode: "off",
  });

  const [nameDrafts, setNameDrafts] = useState({});
  const [laneNumberDrafts, setLaneNumberDrafts] = useState({});
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
  const [owedModalOpen, setOwedModalOpen] = useState(false);
  const [addBowlerModalOpen, setAddBowlerModalOpen] = useState(false);
  const [entrantsModalOpen, setEntrantsModalOpen] = useState(false);
  const [sessionDeleteModal, setSessionDeleteModal] = useState({
    open: false,
    sessionId: null,
    sessionName: "",
  });
  const { theme, setTheme } = useThemePreference();

  const hasLoadedSession = Boolean(snapshot?.session);
  const sessionCompleted = Boolean(snapshot?.session?.is_completed);
  const bracketRegenerationLocked = Boolean(
    snapshot?.bracketRegenerationLocked,
  );

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
      return (
        b.displayName.toLowerCase().includes(q) ||
        b.name.toLowerCase().includes(q)
      );
    });
  }, [sortedBowlers, bowlerSearchQuery]);

  const requiredScorers = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.requiredScorersByGame?.[`game${gameNumber}`] ?? [];
  }, [snapshot, gameNumber]);

  const entriesNeededSummary = useMemo(() => {
    const bowlers = snapshot?.bowlers ?? [];
    return {
      scratch: entriesNeededForFullBrackets(bowlers.map((b) => b.scratch_entries)),
      handicap: entriesNeededForFullBrackets(bowlers.map((b) => b.handicap_entries)),
    };
  }, [snapshot]);

  const entrantsRows = useMemo(() => {
    return sortedBowlers.map((bowler) => ({
      id: bowler.id,
      displayName: bowler.displayName,
      scratchEntries: Number(bowler.scratch_entries ?? 0),
      handicapEntries: Number(bowler.handicap_entries ?? 0),
    }));
  }, [sortedBowlers]);

  const onPrintEntrants = useCallback(() => {
    if (entrantsRows.length === 0) {
      setStatus("No entrants to print");
      return;
    }
    if (typeof window === "undefined") {
      setStatus("Printing is unavailable in this environment");
      return;
    }

    const entryFeeCents = Number(snapshot?.session?.entry_fee_cents ?? 0);
    const sessionName = String(snapshot?.session?.name ?? "Session");
    const totalScratch = entrantsRows.reduce((acc, row) => acc + Number(row.scratchEntries ?? 0), 0);
    const totalHdcp = entrantsRows.reduce((acc, row) => acc + Number(row.handicapEntries ?? 0), 0);
    const esc = (value) =>
      String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    const money = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

    const rowsHtml = entrantsRows
      .map(
        (row) =>
          `<tr>
            <td>${esc(row.displayName)}</td>
            <td>${row.scratchEntries}</td>
            <td>${row.handicapEntries}</td>
          </tr>`,
      )
      .join("");

    const bodyHtml = `
      <main class="entrants-print-sheet">
        <h1>Entrants</h1>
        <p>${esc(sessionName)}</p>
        <table>
          <thead>
            <tr>
              <th>Bowler</th>
              <th>${esc(`Scr Entries ${money(entryFeeCents)}`)}</th>
              <th>${esc(`Hdcp Entries ${money(entryFeeCents)}`)}</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr>
              <td>Total Entries</td>
              <td>${totalScratch}</td>
              <td>${totalHdcp}</td>
            </tr>
          </tfoot>
        </table>
      </main>
    `;

    const printed = openAndPrintHtml({
      title: "Entrants",
      stylesHtml: `${getDocumentStylesHtml(document)}
      <style>
        @page { margin: 10mm; }
        body { margin: 0; color: #111; background: #fff; font-family: Arial, sans-serif; }
        .entrants-print-sheet h1 { margin: 0 0 6px; font-size: 24px; }
        .entrants-print-sheet p { margin: 0 0 12px; font-size: 14px; color: #444; }
        .entrants-print-sheet table { width: 100%; border-collapse: collapse; }
        .entrants-print-sheet th, .entrants-print-sheet td { border: 1px solid #999; padding: 8px; text-align: left; font-size: 13px; }
        .entrants-print-sheet thead th { background: #f1f1f1; }
      </style>`,
      bodyHtml,
    });

    if (!printed) {
      const containerId = "entrants-print-fallback";
      let container = document.getElementById(containerId);
      if (!container) {
        container = document.createElement("div");
        container.id = containerId;
        container.className = "entrants-print-fallback";
        document.body.appendChild(container);
      }
      container.innerHTML = bodyHtml;

      const cleanup = () => {
        document.body.classList.remove("is-printing-entrants");
        window.removeEventListener("afterprint", cleanup);
      };

      document.body.classList.add("is-printing-entrants");
      window.addEventListener("afterprint", cleanup);
      setStatus("Opening print dialog...");
      window.print();
      return;
    }
    setStatus("Opening print dialog...");
  }, [entrantsRows, setStatus, snapshot?.session?.entry_fee_cents, snapshot?.session?.name]);

  const onCheckUpdates = useCallback(async (opts = {}) => {
    const silent = Boolean(opts.silent);
    setUpdateInfo((prev) => ({ ...prev, checking: true, error: "" }));
    try {
      const result = await api("/api/app/update-check");
      setUpdateInfo((prev) => ({
        ...prev,
        checking: false,
        currentVersion: String(result.currentVersion ?? ""),
        latestVersion: String(result.latestVersion ?? ""),
        isUpdateAvailable: Boolean(result.isUpdateAvailable),
        releaseUrl: String(result.releaseUrl ?? ""),
        recommendedDownloadUrl: String(result.recommendedDownloadUrl ?? ""),
        recommendedAssetName: String(result.recommendedAssetName ?? ""),
        assets: Array.isArray(result.assets) ? result.assets : [],
        publishedAt: result.publishedAt ?? null,
        error: "",
        lastCheckedAt: new Date().toISOString(),
      }));
      if (!silent) {
        setStatus(
          result.isUpdateAvailable
            ? `Update available: v${result.latestVersion}`
            : `You are up to date (v${result.currentVersion})`,
        );
      }
    } catch (err) {
      setUpdateInfo((prev) => ({
        ...prev,
        checking: false,
        error: err.message || "Unable to check for updates",
        lastCheckedAt: new Date().toISOString(),
      }));
      if (!silent) {
        setStatus(err.message || "Unable to check for updates");
      }
    }
  }, [setStatus]);

  const onOpenReleasePage = useCallback(() => {
    const targetUrl = updateInfo?.recommendedDownloadUrl || updateInfo?.releaseUrl;
    if (!targetUrl) {
      setStatus("No release URL available");
      return;
    }
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      try {
        const link = document.createElement("a");
        link.href = targetUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setStatus(updateInfo?.recommendedDownloadUrl ? "Opening download..." : "Opened release page");
        return;
      } catch {
        if (typeof window.location?.assign === "function") {
          window.location.assign(targetUrl);
          setStatus(updateInfo?.recommendedDownloadUrl ? "Opening download..." : "Opened release page");
          return;
        }
      }
    }
    setStatus("Unable to open release page");
  }, [setStatus, updateInfo?.recommendedDownloadUrl, updateInfo?.releaseUrl]);

  const { init, loadSessions, loadSnapshot, onCreateSession, onRefreshSessions, onSessionChange, onLoadSnapshot } =
    useSessionDataActions({
      activeSessionId,
      setActiveSessionId,
      setSessions,
      setSnapshot,
      setStatus,
      setSessionFormDefaults,
    });
  const { onGenerateBrackets, onPrintBrackets, onPrintAliveList } = useBracketActions({
    activeSessionId,
    sessionCompleted,
    bracketRegenerationLocked,
    snapshot,
    setSnapshot,
    setRefundModalOpen,
    setOwedModalOpen,
    setStatus,
  });
  const { toggleRefundPaid, togglePayoutPaid, toggleOwedPaid } = usePaymentActions({
    activeSessionId,
    sessionCompleted,
    snapshot,
    setSnapshot,
    setStatus,
  });
  const {
    onAddBowler,
    onUpdateAverage,
    updateBowlerField,
    togglePayLater,
    cancelCellEdit,
    onClickDelete,
    confirmDelete,
    onImportBowlersPdf,
  } = useBowlerActions({
    activeSessionId,
    sessionCompleted,
    snapshot,
    averageDrafts,
    bowlerFormDefaults,
    confirmState,
    loadSessions,
    loadSnapshot,
    setBowlerFormDefaults,
    setConfirmState,
    setEditingCell,
    setNameDrafts,
    setLaneNumberDrafts,
    setAverageDrafts,
    setScratchEntriesDrafts,
    setHandicapEntriesDrafts,
    setImportErrorDetails,
    setStatus,
  });
  const { game1Complete, game2Complete, onSaveScores } = useScoreActions({
    activeSessionId,
    gameNumber,
    requiredScorers,
    scoreDrafts,
    sessionCompleted,
    setSnapshot,
    setStatus,
    snapshot,
  });
  const { onCompleteSession, onCloneSession, onAskDeleteSession, onConfirmDeleteSession } = useSessionLifecycleActions({
    activeSessionId,
    loadSessions,
    loadSnapshot,
    setActiveSessionId,
    setActivePage,
    setSessionDeleteModal,
    setSnapshot,
    setStatus,
    sessionDeleteModal,
  });

  const {
    sessionSummary,
    refundTotals,
    payouts,
    owedTotals,
    paidRefundMap,
    paidPayoutMap,
    paidOwedMap,
    kpis,
    owedByBowler,
  } = useDashboardViewModel(snapshot);
  useAppEffects({
    hasLoadedSession,
    activePage,
    setActivePage,
    snapshot,
    setNameDrafts,
    setLaneNumberDrafts,
    setAverageDrafts,
    setScratchEntriesDrafts,
    setHandicapEntriesDrafts,
    setEditingCell,
    activeSessionId,
    setBowlerSearchQuery,
    gameNumber,
    requiredScorers,
    setScoreDrafts,
    init,
    game1Complete,
    game2Complete,
    setGameNumber,
  });

  useEffect(() => {
    void onCheckUpdates({ silent: true });
  }, [onCheckUpdates]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tauriEvent = window.__TAURI__?.event;
    if (!tauriEvent?.listen) return;

    let unlisten = null;
    tauriEvent
      .listen("menu-check-updates", () => {
        void onCheckUpdates();
      })
      .then((dispose) => {
        unlisten = dispose;
      })
      .catch(() => {});

    return () => {
      if (typeof unlisten === "function") {
        unlisten();
      }
    };
  }, [onCheckUpdates]);

  return (
    <>
      <div className="shell">
        <SidebarNav
          snapshot={snapshot}
          hasLoadedSession={hasLoadedSession}
          activePage={activePage}
          setActivePage={setActivePage}
          status={status}
        />

        <main className="content">
          <DashboardTopbar
            snapshot={snapshot}
            sessionCompleted={sessionCompleted}
            status={status}
          />
          <MetricStrip kpis={kpis} />

          <SessionPage
            active={activePage === "session"}
            sessionFormDefaults={sessionFormDefaults}
            setSessionFormDefaults={setSessionFormDefaults}
            onCreateSession={onCreateSession}
            activeSessionId={activeSessionId}
            onSessionChange={onSessionChange}
            sessions={sessions}
            onRefreshSessions={onRefreshSessions}
            onLoadSnapshot={onLoadSnapshot}
            onCloneSession={onCloneSession}
            onCompleteSession={onCompleteSession}
            hasLoadedSession={hasLoadedSession}
            canCompleteSession={
              Boolean(snapshot?.completion?.canComplete) && !sessionCompleted
            }
            sessionSummary={sessionSummary}
          />

          <BowlersPage
            active={activePage === "bowlers"}
            sessionCompleted={sessionCompleted}
            onOpenAddBowler={() => setAddBowlerModalOpen(true)}
            onOpenEntrants={() => setEntrantsModalOpen(true)}
            entriesNeededSummary={entriesNeededSummary}
            bowlerSearchQuery={bowlerSearchQuery}
            setBowlerSearchQuery={setBowlerSearchQuery}
            onImportBowlersPdf={onImportBowlersPdf}
            importErrorDetails={importErrorDetails}
            filteredBowlers={filteredBowlers}
            editingCell={editingCell}
            setEditingCell={setEditingCell}
            nameDrafts={nameDrafts}
            setNameDrafts={setNameDrafts}
            laneNumberDrafts={laneNumberDrafts}
            setLaneNumberDrafts={setLaneNumberDrafts}
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

          <BracketsPage
            active={activePage === "brackets"}
            sessionCompleted={sessionCompleted}
            bracketRegenerationLocked={bracketRegenerationLocked}
            brackets={snapshot?.brackets ?? []}
            onGenerateBrackets={onGenerateBrackets}
            onPrintAliveList={onPrintAliveList}
            onPrintBrackets={() => void onPrintBrackets()}
          />

          <ScoresPage
            active={activePage === "scores"}
            gameNumber={gameNumber}
            setGameNumber={setGameNumber}
            game1Complete={game1Complete}
            game2Complete={game2Complete}
            onSaveScores={onSaveScores}
            sessionCompleted={sessionCompleted}
            requiredScorers={requiredScorers}
            scoreDrafts={scoreDrafts}
            onScoreChange={(bowlerId, value) =>
              setScoreDrafts((prev) => ({
                ...prev,
                [bowlerId]: value,
              }))
            }
          />

          <PayoutsPage
            active={activePage === "payouts"}
            refundTotals={refundTotals}
            owedTotals={owedTotals}
            payouts={payouts}
            paidPayoutMap={paidPayoutMap}
            sessionCompleted={sessionCompleted}
            onOpenRefundModal={() => setRefundModalOpen(true)}
            onOpenOwedModal={() => setOwedModalOpen(true)}
            onTogglePayoutPaid={(bowlerId) => void togglePayoutPaid(bowlerId)}
          />

          <SettingsPage
            active={activePage === "settings"}
            theme={theme}
            onThemeChange={setTheme}
            sessions={sessions}
            onAskDeleteSession={onAskDeleteSession}
            updateInfo={updateInfo}
            onCheckUpdates={() => void onCheckUpdates()}
            onOpenReleasePage={onOpenReleasePage}
          />
        </main>
      </div>

      <ConfirmDeleteModal
        open={confirmState.open}
        message={confirmState.message}
        onCancel={() => {
          setConfirmState({ open: false, bowlerId: null, message: "" });
          setStatus("Delete cancelled");
        }}
        onConfirm={() => void confirmDelete()}
      />

      <RefundModal
        open={refundModalOpen}
        refundTotals={refundTotals}
        paidRefundMap={paidRefundMap}
        sessionCompleted={sessionCompleted}
        onToggleRefundPaid={(bowlerId) => void toggleRefundPaid(bowlerId)}
        onClose={() => setRefundModalOpen(false)}
      />

      <OwedModal
        open={owedModalOpen}
        owedTotals={owedTotals}
        paidOwedMap={paidOwedMap}
        sessionCompleted={sessionCompleted}
        onToggleOwedPaid={(bowlerId) => void toggleOwedPaid(bowlerId)}
        onClose={() => setOwedModalOpen(false)}
      />

      <SessionDeleteModal
        open={sessionDeleteModal.open}
        sessionName={sessionDeleteModal.sessionName}
        onCancel={() =>
          setSessionDeleteModal({
            open: false,
            sessionId: null,
            sessionName: "",
          })
        }
        onConfirm={() => void onConfirmDeleteSession()}
      />

      <AddBowlerModal
        open={addBowlerModalOpen}
        sessionCompleted={sessionCompleted}
        formState={bowlerFormDefaults}
        setFormState={setBowlerFormDefaults}
        onClose={() => setAddBowlerModalOpen(false)}
        onSubmit={onAddBowler}
      />

      <EntrantsModal
        open={entrantsModalOpen}
        rows={entrantsRows}
        entryFeeCents={Number(snapshot?.session?.entry_fee_cents ?? 0)}
        onClose={() => setEntrantsModalOpen(false)}
        onPrint={onPrintEntrants}
      />
    </>
  );
}
