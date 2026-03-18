import { useMemo, useState } from "react";
import { compareDisplayNames, toDisplayName } from "./lib/format";
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
import { DashboardTopbar } from "./components/layout/DashboardTopbar";
import { MetricStrip } from "./components/layout/MetricStrip";
import { SidebarNav } from "./components/layout/SidebarNav";

export function App() {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [status, setStatus] = useState("Ready");
  const [activePage, setActivePage] = useState("session");
  const [gameNumber, setGameNumber] = useState(1);
  const [bowlerSearchQuery, setBowlerSearchQuery] = useState("");
  const [importErrorDetails, setImportErrorDetails] = useState("");

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
    payLater: false,
    allBracketsMode: "off",
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
  const [owedModalOpen, setOwedModalOpen] = useState(false);
  const [addBowlerModalOpen, setAddBowlerModalOpen] = useState(false);
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
    setAddBowlerModalOpen,
    setBowlerFormDefaults,
    setConfirmState,
    setEditingCell,
    setNameDrafts,
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
            bowlerSearchQuery={bowlerSearchQuery}
            setBowlerSearchQuery={setBowlerSearchQuery}
            onImportBowlersPdf={onImportBowlersPdf}
            importErrorDetails={importErrorDetails}
            filteredBowlers={filteredBowlers}
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
    </>
  );
}
