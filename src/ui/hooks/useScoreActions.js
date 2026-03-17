import { useCallback, useMemo } from "react";
import { api } from "../lib/api-client";

export function useScoreActions({
  activeSessionId,
  gameNumber,
  requiredScorers,
  scoreDrafts,
  sessionCompleted,
  setSnapshot,
  setStatus,
  snapshot,
}) {
  const isGameComplete = useCallback(
    (game) => {
      const required = snapshot?.requiredScorersByGame?.[`game${game}`] ?? [];
      if (required.length === 0) return false;
      const existing = new Map();
      for (const row of snapshot?.scores ?? []) {
        if (row.game_number === game) {
          existing.set(row.bowler_id, row.scratch_score);
        }
      }
      return required.every((s) => Number.isFinite(existing.get(s.bowlerId)));
    },
    [snapshot],
  );

  const game1Complete = useMemo(() => isGameComplete(1), [isGameComplete]);
  const game2Complete = useMemo(() => isGameComplete(2), [isGameComplete]);

  const onSaveScores = useCallback(async () => {
    if (!activeSessionId) {
      setStatus("Select session first");
      return;
    }
    if (sessionCompleted) {
      setStatus("Session is completed and read-only");
      return;
    }
    if (requiredScorers.length === 0) {
      setStatus("No active bowlers need scores for this game yet");
      return;
    }

    const parsed = requiredScorers.map((s) => ({
      bowlerId: s.bowlerId,
      scratchScore: Number(scoreDrafts[s.bowlerId]),
      name: s.name,
    }));
    const invalid = parsed.find((row) => !Number.isFinite(row.scratchScore) || row.scratchScore < 0);
    if (invalid) {
      setStatus(`Enter a valid score for ${invalid.name}`);
      return;
    }

    try {
      const nextSnapshot = await api(`/api/sessions/${activeSessionId}/scores`, {
        method: "POST",
        body: JSON.stringify({
          gameNumber,
          scores: parsed.map(({ bowlerId, scratchScore }) => ({
            bowlerId,
            scratchScore,
          })),
        }),
      });
      setSnapshot(nextSnapshot);
      setStatus(`Scores saved for game ${gameNumber}`);
    } catch (err) {
      setStatus(err.message);
    }
  }, [
    activeSessionId,
    gameNumber,
    requiredScorers,
    scoreDrafts,
    sessionCompleted,
    setSnapshot,
    setStatus,
  ]);

  return {
    game1Complete,
    game2Complete,
    onSaveScores,
  };
}
