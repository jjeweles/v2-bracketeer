import { useCallback } from "react";
import { api } from "../lib/api-client";

const SESSION_DEFAULTS = {
  name: "",
  entryFeeDollars: 5,
  handicapPercent: 80,
  handicapBase: 220,
  payoutFirstDollars: 25,
  payoutSecondDollars: 10,
};

export function useSessionDataActions({
  activeSessionId,
  setActiveSessionId,
  setSessions,
  setSnapshot,
  setStatus,
  setSessionFormDefaults,
}) {
  const loadSessions = useCallback(async () => {
    const data = await api("/api/sessions");
    if (!data || !Array.isArray(data.sessions)) {
      throw new Error("API unavailable. If this is desktop build, backend did not start.");
    }
    setSessions(data.sessions);
    return data.sessions;
  }, [setSessions]);

  const loadSnapshot = useCallback(
    async (sessionId = activeSessionId) => {
      if (!sessionId) {
        setStatus("Select a session first");
        return null;
      }

      const nextSnapshot = await api(`/api/sessions/${sessionId}/snapshot`);
      setSnapshot(nextSnapshot);
      return nextSnapshot;
    },
    [activeSessionId, setSnapshot, setStatus],
  );

  const init = useCallback(async () => {
    try {
      let loadedSessions = [];
      let lastErr = null;
      for (let attempt = 0; attempt < 15; attempt += 1) {
        try {
          loadedSessions = await loadSessions();
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
      if (lastErr) throw lastErr;
      setActiveSessionId(null);
      setSnapshot(null);
      setStatus(loadedSessions.length > 0 ? "Ready - select or create a session" : "Ready - create a session");
    } catch (err) {
      setStatus(err.message);
    }
  }, [loadSessions, setActiveSessionId, setSnapshot, setStatus]);

  const onCreateSession = useCallback(
    async (e) => {
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

        setSessionFormDefaults(SESSION_DEFAULTS);
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
    },
    [loadSessions, loadSnapshot, setActiveSessionId, setSessionFormDefaults, setStatus],
  );

  const onRefreshSessions = useCallback(async () => {
    try {
      await loadSessions();
      setStatus("Sessions refreshed");
    } catch (err) {
      setStatus(err.message);
    }
  }, [loadSessions, setStatus]);

  const onSessionChange = useCallback(
    async (e) => {
      if (!e.target.value) {
        setActiveSessionId(null);
        setSnapshot(null);
        setStatus("Ready - select or create a session");
        return;
      }
      const nextId = Number(e.target.value);
      setActiveSessionId(nextId);
      try {
        await loadSnapshot(nextId);
        setStatus("Session loaded");
      } catch (err) {
        setSnapshot(null);
        setStatus(err.message);
      }
    },
    [loadSnapshot, setActiveSessionId, setSnapshot, setStatus],
  );

  const onLoadSnapshot = useCallback(async () => {
    try {
      await loadSnapshot();
      setStatus("Session loaded");
    } catch (err) {
      setSnapshot(null);
      setStatus(err.message);
    }
  }, [loadSnapshot, setSnapshot, setStatus]);

  return {
    init,
    loadSessions,
    loadSnapshot,
    onCreateSession,
    onRefreshSessions,
    onSessionChange,
    onLoadSnapshot,
  };
}
