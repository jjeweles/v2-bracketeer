import { useCallback } from "react";
import { api } from "../lib/api-client";

export function useSessionLifecycleActions({
  activeSessionId,
  loadSessions,
  loadSnapshot,
  setActiveSessionId,
  setActivePage,
  setSessionDeleteModal,
  setSnapshot,
  setStatus,
  sessionDeleteModal,
}) {
  const onCompleteSession = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      const nextSnapshot = await api(`/api/sessions/${activeSessionId}/complete`, { method: "POST" });
      setSnapshot(nextSnapshot);
      await loadSessions();
      setStatus("Session marked complete");
    } catch (err) {
      setStatus(err.message);
    }
  }, [activeSessionId, loadSessions, setSnapshot, setStatus]);

  const onCloneSession = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      const result = await api(`/api/sessions/${activeSessionId}/clone`, { method: "POST", body: JSON.stringify({}) });
      await loadSessions();
      const newId = result?.session?.id;
      if (newId) {
        setActiveSessionId(newId);
        await loadSnapshot(newId);
        setActivePage("bowlers");
      }
      setStatus("New session created from current session");
    } catch (err) {
      setStatus(err.message);
    }
  }, [activeSessionId, loadSessions, loadSnapshot, setActivePage, setActiveSessionId, setStatus]);

  const onAskDeleteSession = useCallback(
    (session) => {
      setSessionDeleteModal({ open: true, sessionId: session.id, sessionName: session.name });
    },
    [setSessionDeleteModal],
  );

  const onConfirmDeleteSession = useCallback(async () => {
    const targetId = sessionDeleteModal.sessionId;
    setSessionDeleteModal({ open: false, sessionId: null, sessionName: "" });
    if (!Number.isFinite(targetId)) return;

    try {
      await api(`/api/sessions/${targetId}`, { method: "DELETE" });
      const loadedSessions = await loadSessions();

      if (activeSessionId === targetId) {
        const nextId = loadedSessions[0]?.id ?? null;
        setActiveSessionId(nextId);
        if (nextId) {
          await loadSnapshot(nextId);
        } else {
          setSnapshot(null);
          setActivePage("session");
        }
      } else if (activeSessionId) {
        await loadSnapshot(activeSessionId);
      }

      setStatus("Session deleted");
    } catch (err) {
      setStatus(err.message);
    }
  }, [
    activeSessionId,
    loadSessions,
    loadSnapshot,
    sessionDeleteModal.sessionId,
    setActivePage,
    setActiveSessionId,
    setSessionDeleteModal,
    setSnapshot,
    setStatus,
  ]);

  return {
    onCompleteSession,
    onCloneSession,
    onAskDeleteSession,
    onConfirmDeleteSession,
  };
}
