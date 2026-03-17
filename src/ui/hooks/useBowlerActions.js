import { useCallback } from "react";
import { api } from "../lib/api-client";

const BOWLER_DEFAULTS = {
  name: "",
  average: "",
  scratchEntries: 0,
  handicapEntries: 0,
  payLater: false,
  allBracketsMode: "off",
};

export function useBowlerActions({
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
}) {
  const onAddBowler = useCallback(
    async (e) => {
      e.preventDefault();
      if (!activeSessionId) {
        setStatus("Select session first");
        return;
      }
      if (sessionCompleted) {
        setStatus("Session is completed and read-only");
        return;
      }

      const payload = {
        name: bowlerFormDefaults.name,
        average: Number(bowlerFormDefaults.average),
        scratchEntries: Number(bowlerFormDefaults.scratchEntries),
        handicapEntries: Number(bowlerFormDefaults.handicapEntries),
        payLater: Boolean(bowlerFormDefaults.payLater),
        allBracketsMode: bowlerFormDefaults.allBracketsMode,
      };

      try {
        await api(`/api/sessions/${activeSessionId}/bowlers`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        await loadSnapshot(activeSessionId);
        setBowlerFormDefaults(BOWLER_DEFAULTS);
        setAddBowlerModalOpen(false);
        setStatus("Bowler added");
      } catch (err) {
        setStatus(err.message);
      }
    },
    [
      activeSessionId,
      bowlerFormDefaults,
      loadSnapshot,
      sessionCompleted,
      setAddBowlerModalOpen,
      setBowlerFormDefaults,
      setStatus,
    ],
  );

  const updateBowlerField = useCallback(
    async (bowlerId, patch, label) => {
      if (!activeSessionId) {
        setStatus("Select session first");
        return;
      }
      if (sessionCompleted) {
        setStatus("Session is completed and read-only");
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
    },
    [activeSessionId, loadSessions, loadSnapshot, sessionCompleted, setEditingCell, setStatus],
  );

  const onUpdateAverage = useCallback(
    async (bowlerId) => {
      const average = Number(averageDrafts[bowlerId]);
      await updateBowlerField(bowlerId, { average }, "Average");
    },
    [averageDrafts, updateBowlerField],
  );

  const togglePayLater = useCallback(
    async (bowler) => {
      await updateBowlerField(bowler.id, { payLater: !bowler.pay_later }, "Pay later");
    },
    [updateBowlerField],
  );

  const cancelCellEdit = useCallback(
    (bowlerId, field, sourceBowler) => {
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
    },
    [setAverageDrafts, setEditingCell, setHandicapEntriesDrafts, setNameDrafts, setScratchEntriesDrafts],
  );

  const onClickDelete = useCallback(
    (bowlerId) => {
      if (sessionCompleted) {
        setStatus("Session is completed and read-only");
        return;
      }
      const hasBrackets = (snapshot?.brackets?.length ?? 0) > 0;
      setConfirmState({
        open: true,
        bowlerId,
        message: hasBrackets
          ? "Delete this bowler? Existing brackets and refunds will be cleared and must be regenerated."
          : "Delete this bowler? This action cannot be undone.",
      });
    },
    [sessionCompleted, setConfirmState, setStatus, snapshot?.brackets?.length],
  );

  const confirmDelete = useCallback(async () => {
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
  }, [activeSessionId, confirmState.bowlerId, loadSnapshot, setConfirmState, setStatus]);

  const onImportBowlersPdf = useCallback(
    async (e) => {
      e.preventDefault();
      setImportErrorDetails("");
      setStatus("PDF import is temporarily disabled in desktop builds.");
    },
    [setImportErrorDetails, setStatus],
  );

  return {
    onAddBowler,
    onUpdateAverage,
    updateBowlerField,
    togglePayLater,
    cancelCellEdit,
    onClickDelete,
    confirmDelete,
    onImportBowlersPdf,
  };
}
