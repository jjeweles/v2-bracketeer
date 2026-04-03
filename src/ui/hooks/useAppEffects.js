import { useEffect } from "react";

export function useAppEffects({
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
}) {
  useEffect(() => {
    if (!hasLoadedSession && activePage !== "session" && activePage !== "settings") {
      setActivePage("session");
    }
  }, [hasLoadedSession, activePage, setActivePage]);

  useEffect(() => {
    const nextName = {};
    const nextLane = {};
    const next = {};
    const nextScratch = {};
    const nextHandicap = {};
    for (const b of snapshot?.bowlers ?? []) {
      nextName[b.id] = b.name;
      nextLane[b.id] = b.lane_number == null ? "" : String(b.lane_number);
      next[b.id] = String(b.average);
      nextScratch[b.id] = String(b.scratch_entries);
      nextHandicap[b.id] = String(b.handicap_entries);
    }
    setNameDrafts(nextName);
    setLaneNumberDrafts(nextLane);
    setAverageDrafts(next);
    setScratchEntriesDrafts(nextScratch);
    setHandicapEntriesDrafts(nextHandicap);
    setEditingCell(null);
  }, [
    snapshot,
    setNameDrafts,
    setLaneNumberDrafts,
    setAverageDrafts,
    setScratchEntriesDrafts,
    setHandicapEntriesDrafts,
    setEditingCell,
  ]);

  useEffect(() => {
    setBowlerSearchQuery("");
  }, [activeSessionId, setBowlerSearchQuery]);

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
  }, [snapshot, gameNumber, requiredScorers, setScoreDrafts]);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (gameNumber === 3 && !game2Complete) {
      setGameNumber(game1Complete ? 2 : 1);
      return;
    }
    if (gameNumber === 2 && !game1Complete) {
      setGameNumber(1);
    }
  }, [gameNumber, game1Complete, game2Complete, setGameNumber]);
}
