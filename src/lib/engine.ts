import { db } from "./db";

export type BracketKind = "scratch" | "handicap";

type Bowler = {
  id: number;
  session_id: number;
  name: string;
  average: number;
  handicap_value: number;
  scratch_entries: number;
  handicap_entries: number;
};

type Session = {
  id: number;
  name: string;
  entry_fee_cents: number;
  handicap_percent: number;
  handicap_base: number;
  payout_first_cents: number;
  payout_second_cents: number;
};

type Slot = { seed: number; bowlerId: number; bowlerName: string; handicapValue: number };
type BracketSnapshot = {
  bracketId: number;
  kind: BracketKind;
  bracketNumber: number;
  seeds: Slot[];
  rounds: {
    round: number;
    matches: Array<{
      label: string;
      contenders: Array<{ bowlerId: number; name: string; score: number | null }>;
      advancers: number[];
      status: "pending" | "complete";
    }>;
  }[];
  winnerBowlerIds: number[];
  secondBowlerIds: number[];
};

const getSessionStmt = db.query(
  `SELECT id, name, entry_fee_cents, handicap_percent, handicap_base, payout_first_cents, payout_second_cents FROM sessions WHERE id = ?`
);
const getBowlersStmt = db.query(
  `SELECT id, session_id, name, average, handicap_value, scratch_entries, handicap_entries FROM bowlers WHERE session_id = ? ORDER BY id`
);
const getBowlerStmt = db.query(
  `SELECT id, session_id, name, average, handicap_value, scratch_entries, handicap_entries FROM bowlers WHERE id = ? AND session_id = ?`
);

function calculateHandicap(average: number, percent: number, base: number): number {
  const raw = ((base - average) * percent) / 100;
  return Math.max(0, Math.round(raw));
}

function toDisplayName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/);
  const last = parts.pop() ?? "";
  const first = parts.join(" ");
  return first ? `${last}, ${first}` : last;
}

function compareDisplayNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

export function listSessions() {
  return db
    .query(
      `SELECT id, name, entry_fee_cents, handicap_percent, handicap_base, payout_first_cents, payout_second_cents, created_at
       FROM sessions ORDER BY id DESC`
    )
    .all();
}

export function createSession(input: {
  name: string;
  entryFeeDollars: number;
  handicapPercent: number;
  handicapBase: number;
  payoutFirstDollars: number;
  payoutSecondDollars: number;
}) {
  const stmt = db.query(
    `INSERT INTO sessions (name, entry_fee_cents, handicap_percent, handicap_base, payout_first_cents, payout_second_cents)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
  );

  return stmt.get(
    input.name.trim(),
    Math.round(input.entryFeeDollars * 100),
    input.handicapPercent,
    input.handicapBase,
    Math.round(input.payoutFirstDollars * 100),
    Math.round(input.payoutSecondDollars * 100)
  );
}

export function addBowler(
  sessionId: number,
  input: {
    name: string;
    average: number;
    scratchEntries: number;
    handicapEntries: number;
  }
) {
  const session = getSessionStmt.get(sessionId) as Session | null;
  if (!session) {
    throw new Error("Session not found");
  }

  const handicapValue = calculateHandicap(input.average, session.handicap_percent, session.handicap_base);

  const stmt = db.query(
    `INSERT INTO bowlers (session_id, name, average, handicap_value, scratch_entries, handicap_entries)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
  );

  return stmt.get(
    sessionId,
    input.name.trim(),
    input.average,
    handicapValue,
    input.scratchEntries,
    input.handicapEntries
  );
}

export function listBowlers(sessionId: number) {
  return getBowlersStmt.all(sessionId);
}

export function updateBowler(
  sessionId: number,
  bowlerId: number,
  input: {
    name?: string;
    average?: number;
    scratchEntries?: number;
    handicapEntries?: number;
  }
) {
  const session = getSessionStmt.get(sessionId) as Session | null;
  if (!session) {
    throw new Error("Session not found");
  }

  const bowler = getBowlerStmt.get(bowlerId, sessionId) as Bowler | null;
  if (!bowler) {
    throw new Error("Bowler not found");
  }

  const nextName = input.name == null ? bowler.name : input.name.trim();
  const nextAverage = input.average == null ? bowler.average : input.average;
  const nextScratchEntries = input.scratchEntries == null ? bowler.scratch_entries : input.scratchEntries;
  const nextHandicapEntries = input.handicapEntries == null ? bowler.handicap_entries : input.handicapEntries;
  const handicapValue = calculateHandicap(nextAverage, session.handicap_percent, session.handicap_base);

  const updated = db
    .query(
      `UPDATE bowlers
       SET name = ?, average = ?, handicap_value = ?, scratch_entries = ?, handicap_entries = ?
       WHERE id = ? AND session_id = ?
       RETURNING *`
    )
    .get(
      nextName,
      nextAverage,
      handicapValue,
      nextScratchEntries,
      nextHandicapEntries,
      bowlerId,
      sessionId
    ) as Bowler | null;

  if (!updated) {
    throw new Error("Failed to update bowler");
  }

  return updated;
}

export function deleteBowler(sessionId: number, bowlerId: number) {
  const session = getSessionStmt.get(sessionId) as Session | null;
  if (!session) {
    throw new Error("Session not found");
  }

  const bowler = getBowlerStmt.get(bowlerId, sessionId) as Bowler | null;
  if (!bowler) {
    throw new Error("Bowler not found");
  }

  const hasBrackets = db
    .query(`SELECT 1 FROM brackets WHERE session_id = ? LIMIT 1`)
    .get(sessionId) as { 1: number } | null;
  if (hasBrackets) {
    db.transaction(() => {
      db.query(`DELETE FROM refunds WHERE session_id = ?`).run(sessionId);
      db.query(`DELETE FROM bracket_slots WHERE bracket_id IN (SELECT id FROM brackets WHERE session_id = ?)`).run(
        sessionId
      );
      db.query(`DELETE FROM brackets WHERE session_id = ?`).run(sessionId);
    })();
  }

  db.query(`DELETE FROM bowlers WHERE id = ? AND session_id = ?`).run(bowlerId, sessionId);
  return { deleted: true };
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function weightedPick(ids: number[], counts: Map<number, number>): number {
  const weighted: number[] = [];
  for (const id of ids) {
    const count = counts.get(id) ?? 0;
    for (let i = 0; i < count; i += 1) {
      weighted.push(id);
    }
  }
  return weighted[Math.floor(Math.random() * weighted.length)];
}

function buildEightManGroups(entryCounts: Map<number, number>) {
  const working = new Map(entryCounts);
  const brackets: number[][] = [];

  while (true) {
    const totalEntries = Array.from(working.values()).reduce((acc, n) => acc + n, 0);
    const uniqueAvailable = Array.from(working.entries())
      .filter(([, count]) => count > 0)
      .map(([id]) => id);

    if (totalEntries < 8 || uniqueAvailable.length < 8) {
      break;
    }

    let success: number[] | null = null;

    for (let attempt = 0; attempt < 200; attempt += 1) {
      const temp = new Map(working);
      const selected = new Set<number>();
      const result: number[] = [];

      for (let seed = 1; seed <= 8; seed += 1) {
        const eligible = Array.from(temp.entries())
          .filter(([id, count]) => count > 0 && !selected.has(id))
          .map(([id]) => id);

        if (eligible.length === 0) {
          result.length = 0;
          break;
        }

        const picked = weightedPick(eligible, temp);
        selected.add(picked);
        result.push(picked);
        temp.set(picked, (temp.get(picked) ?? 0) - 1);
      }

      if (result.length === 8) {
        success = result;
        for (const bowlerId of success) {
          working.set(bowlerId, (working.get(bowlerId) ?? 0) - 1);
        }
        break;
      }
    }

    if (!success) {
      break;
    }

    brackets.push(shuffle(success));
  }

  return { brackets, leftovers: working };
}

export function generateBrackets(sessionId: number) {
  const session = getSessionStmt.get(sessionId) as Session | null;
  if (!session) {
    throw new Error("Session not found");
  }

  const bowlers = getBowlersStmt.all(sessionId) as Bowler[];

  db.transaction(() => {
    db.query(`DELETE FROM refunds WHERE session_id = ?`).run(sessionId);
    db.query(`DELETE FROM bracket_slots WHERE bracket_id IN (SELECT id FROM brackets WHERE session_id = ?)`).run(sessionId);
    db.query(`DELETE FROM brackets WHERE session_id = ?`).run(sessionId);

    for (const kind of ["scratch", "handicap"] as const) {
      const counts = new Map<number, number>();
      for (const bowler of bowlers) {
        const count = kind === "scratch" ? bowler.scratch_entries : bowler.handicap_entries;
        counts.set(bowler.id, Math.max(0, count));
      }

      const { brackets, leftovers } = buildEightManGroups(counts);

      brackets.forEach((bowlerIds, index) => {
        const bracket = db
          .query(
            `INSERT INTO brackets (session_id, kind, bracket_number)
             VALUES (?, ?, ?) RETURNING id`
          )
          .get(sessionId, kind, index + 1) as { id: number };

        bowlerIds.forEach((bowlerId, idx) => {
          db.query(`INSERT INTO bracket_slots (bracket_id, seed, bowler_id) VALUES (?, ?, ?)`).run(
            bracket.id,
            idx + 1,
            bowlerId
          );
        });
      });

      leftovers.forEach((count, bowlerId) => {
        if (count <= 0) {
          return;
        }
        db.query(
          `INSERT INTO refunds (session_id, bowler_id, kind, entry_count, amount_cents)
           VALUES (?, ?, ?, ?, ?)`
        ).run(sessionId, bowlerId, kind, count, count * session.entry_fee_cents);
      });
    }
  })();

  return getSessionSnapshot(sessionId);
}

function getScoreMap(sessionId: number, gameNumber: number): Map<number, number> {
  const rows = db
    .query(`SELECT bowler_id, scratch_score FROM bowler_scores WHERE session_id = ? AND game_number = ?`)
    .all(sessionId, gameNumber) as { bowler_id: number; scratch_score: number }[];
  return new Map(rows.map((row) => [row.bowler_id, row.scratch_score]));
}

function getEffectiveScore(
  scoreMap: Map<number, number>,
  kind: BracketKind,
  bowlerId: number,
  handicapValue: number
): number | null {
  const scratch = scoreMap.get(bowlerId);
  if (scratch == null) {
    return null;
  }
  return kind === "handicap" ? scratch + handicapValue : scratch;
}

function resolvePair(
  candidatesA: number[],
  candidatesB: number[],
  scoreByBowler: Map<number, number>
): number[] {
  if (candidatesA.length === 0 && candidatesB.length === 0) {
    return [];
  }

  const aMax = Math.max(...candidatesA.map((id) => scoreByBowler.get(id) ?? -Infinity));
  const bMax = Math.max(...candidatesB.map((id) => scoreByBowler.get(id) ?? -Infinity));

  const aWinners = candidatesA.filter((id) => (scoreByBowler.get(id) ?? -Infinity) === aMax);
  const bWinners = candidatesB.filter((id) => (scoreByBowler.get(id) ?? -Infinity) === bMax);

  if (aMax > bMax) {
    return aWinners;
  }
  if (bMax > aMax) {
    return bWinners;
  }
  return [...aWinners, ...bWinners];
}

function createBracketSnapshot(
  bracket: { id: number; kind: BracketKind; bracket_number: number },
  slots: Slot[],
  scoresByGame: [Map<number, number>, Map<number, number>, Map<number, number>]
): BracketSnapshot {
  const bySeed = new Map(slots.map((s) => [s.seed, s]));
  const nameById = new Map(slots.map((s) => [s.bowlerId, s.bowlerName]));
  const hById = new Map(slots.map((s) => [s.bowlerId, s.handicapValue]));

  const round1Pairs: [number, number, string][] = [
    [1, 8, "1v8"],
    [2, 7, "2v7"],
    [3, 6, "3v6"],
    [4, 5, "4v5"],
  ];

  const g1Scores = new Map<number, number>();
  for (const slot of slots) {
    const effective = getEffectiveScore(scoresByGame[0], bracket.kind, slot.bowlerId, slot.handicapValue);
    if (effective != null) {
      g1Scores.set(slot.bowlerId, effective);
    }
  }

  const r1Advancers: number[][] = [];
  const r1Matches = round1Pairs.map(([aSeed, bSeed, label]) => {
    const a = bySeed.get(aSeed)!;
    const b = bySeed.get(bSeed)!;
    const aScore = g1Scores.get(a.bowlerId) ?? null;
    const bScore = g1Scores.get(b.bowlerId) ?? null;

    let advancers: number[] = [];
    if (aScore != null && bScore != null) {
      if (aScore > bScore) advancers = [a.bowlerId];
      else if (bScore > aScore) advancers = [b.bowlerId];
      else advancers = [a.bowlerId, b.bowlerId];
    }

    r1Advancers.push(advancers);
    return {
      label,
      contenders: [
        { bowlerId: a.bowlerId, name: a.bowlerName, score: aScore },
        { bowlerId: b.bowlerId, name: b.bowlerName, score: bScore },
      ],
      advancers,
      status: advancers.length > 0 ? (aScore != null && bScore != null ? "complete" : "pending") : "pending",
    } as const;
  });

  const g2Scores = new Map<number, number>();
  for (const slot of slots) {
    const effective = getEffectiveScore(scoresByGame[1], bracket.kind, slot.bowlerId, hById.get(slot.bowlerId) ?? 0);
    if (effective != null) g2Scores.set(slot.bowlerId, effective);
  }

  const sideAIn = [r1Advancers[0], r1Advancers[3]];
  const sideBIn = [r1Advancers[1], r1Advancers[2]];

  const sideAOut =
    sideAIn[0].length > 0 &&
    sideAIn[1].length > 0 &&
    sideAIn.flat().every((id) => g2Scores.has(id))
      ? resolvePair(sideAIn[0], sideAIn[1], g2Scores)
      : [];
  const sideBOut =
    sideBIn[0].length > 0 &&
    sideBIn[1].length > 0 &&
    sideBIn.flat().every((id) => g2Scores.has(id))
      ? resolvePair(sideBIn[0], sideBIn[1], g2Scores)
      : [];

  const r2Matches = [
    {
      label: "(1v8) vs (4v5)",
      contenders: [...sideAIn[0], ...sideAIn[1]].map((id) => ({
        bowlerId: id,
        name: nameById.get(id) ?? `#${id}`,
        score: g2Scores.get(id) ?? null,
      })),
      advancers: sideAOut,
      status: sideAOut.length > 0 ? "complete" : "pending",
    },
    {
      label: "(2v7) vs (3v6)",
      contenders: [...sideBIn[0], ...sideBIn[1]].map((id) => ({
        bowlerId: id,
        name: nameById.get(id) ?? `#${id}`,
        score: g2Scores.get(id) ?? null,
      })),
      advancers: sideBOut,
      status: sideBOut.length > 0 ? "complete" : "pending",
    },
  ] as const;

  const g3Scores = new Map<number, number>();
  for (const slot of slots) {
    const effective = getEffectiveScore(scoresByGame[2], bracket.kind, slot.bowlerId, hById.get(slot.bowlerId) ?? 0);
    if (effective != null) g3Scores.set(slot.bowlerId, effective);
  }

  const finalsReady =
    sideAOut.length > 0 &&
    sideBOut.length > 0 &&
    [...sideAOut, ...sideBOut].every((id) => g3Scores.has(id));
  const winners = finalsReady ? resolvePair(sideAOut, sideBOut, g3Scores) : [];

  let second: number[] = [];
  if (finalsReady && winners.length > 0) {
    const sideAWinning = winners.some((id) => sideAOut.includes(id));
    const sideBWinning = winners.some((id) => sideBOut.includes(id));
    if (sideAWinning && !sideBWinning) {
      const bMax = Math.max(...sideBOut.map((id) => g3Scores.get(id) ?? -Infinity));
      second = sideBOut.filter((id) => (g3Scores.get(id) ?? -Infinity) === bMax);
    } else if (sideBWinning && !sideAWinning) {
      const aMax = Math.max(...sideAOut.map((id) => g3Scores.get(id) ?? -Infinity));
      second = sideAOut.filter((id) => (g3Scores.get(id) ?? -Infinity) === aMax);
    }
  }

  const finalsMatch = {
    label: "Final",
    contenders: [...sideAOut, ...sideBOut].map((id) => ({
      bowlerId: id,
      name: nameById.get(id) ?? `#${id}`,
      score: g3Scores.get(id) ?? null,
    })),
    advancers: winners,
    status: winners.length > 0 ? "complete" : "pending",
  } as const;

  return {
    bracketId: bracket.id,
    kind: bracket.kind,
    bracketNumber: bracket.bracket_number,
    seeds: slots,
    rounds: [
      { round: 1, matches: [...r1Matches] },
      { round: 2, matches: [...r2Matches] },
      { round: 3, matches: [finalsMatch] },
    ],
    winnerBowlerIds: winners,
    secondBowlerIds: second,
  };
}

export function upsertGameScores(
  sessionId: number,
  gameNumber: number,
  scores: Array<{ bowlerId: number; scratchScore: number }>
) {
  const stmt = db.query(
    `INSERT INTO bowler_scores (session_id, bowler_id, game_number, scratch_score)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(session_id, bowler_id, game_number)
     DO UPDATE SET scratch_score = excluded.scratch_score`
  );

  const tx = db.transaction(() => {
    for (const row of scores) {
      stmt.run(sessionId, row.bowlerId, gameNumber, row.scratchScore);
    }
  });

  tx();

  return getSessionSnapshot(sessionId);
}

export function getSessionSnapshot(sessionId: number) {
  const session = getSessionStmt.get(sessionId) as Session | null;
  if (!session) {
    throw new Error("Session not found");
  }

  const rawBowlers = getBowlersStmt.all(sessionId) as Bowler[];
  const bowlers = rawBowlers.map((b) => ({
    ...b,
    handicap_value: calculateHandicap(b.average, session.handicap_percent, session.handicap_base),
  }));
  const bowlerById = new Map(bowlers.map((b) => [b.id, b]));
  const displayNameById = new Map(bowlers.map((b) => [b.id, toDisplayName(b.name)]));

  const brackets = db
    .query(`SELECT id, kind, bracket_number FROM brackets WHERE session_id = ? ORDER BY kind, bracket_number`)
    .all(sessionId) as { id: number; kind: BracketKind; bracket_number: number }[];

  const slotsByBracket = new Map<number, Slot[]>();
  const slotRows = db
    .query(
      `SELECT bs.bracket_id, bs.seed, b.id AS bowler_id, b.name, b.handicap_value
       FROM bracket_slots bs
       JOIN bowlers b ON b.id = bs.bowler_id
       WHERE bs.bracket_id IN (SELECT id FROM brackets WHERE session_id = ?)
       ORDER BY bs.bracket_id, bs.seed`
    )
    .all(sessionId) as {
    bracket_id: number;
    seed: number;
    bowler_id: number;
    name: string;
    handicap_value: number;
  }[];

  for (const row of slotRows) {
    if (!slotsByBracket.has(row.bracket_id)) {
      slotsByBracket.set(row.bracket_id, []);
    }
    const bowler = bowlerById.get(row.bowler_id);
    slotsByBracket.get(row.bracket_id)!.push({
      seed: row.seed,
      bowlerId: row.bowler_id,
      bowlerName: row.name,
      handicapValue: bowler ? bowler.handicap_value : row.handicap_value,
    });
  }

  const refunds = db
    .query(
      `SELECT r.id, r.kind, r.entry_count, r.amount_cents, r.bowler_id, b.name AS bowler_name
       FROM refunds r JOIN bowlers b ON b.id = r.bowler_id
       WHERE r.session_id = ?`
    )
    .all(sessionId) as {
    id: number;
    kind: BracketKind;
    entry_count: number;
    amount_cents: number;
    bowler_id: number;
    bowler_name: string;
  }[];

  const scoreRows = db
    .query(
      `SELECT bowler_id, game_number, scratch_score
       FROM bowler_scores
       WHERE session_id = ?
       ORDER BY game_number, bowler_id`
    )
    .all(sessionId) as { bowler_id: number; game_number: number; scratch_score: number }[];

  const scoresByGame: [Map<number, number>, Map<number, number>, Map<number, number>] = [
    getScoreMap(sessionId, 1),
    getScoreMap(sessionId, 2),
    getScoreMap(sessionId, 3),
  ];

  const bracketSnapshots = brackets.map((bracket) =>
    createBracketSnapshot(bracket, slotsByBracket.get(bracket.id) ?? [], scoresByGame)
  );

  const requiredGame1 = new Set<number>();
  const requiredGame2 = new Set<number>();
  const requiredGame3 = new Set<number>();

  for (const bracket of bracketSnapshots) {
    for (const seed of bracket.seeds) {
      requiredGame1.add(seed.bowlerId);
    }
    for (const match of bracket.rounds[0].matches) {
      for (const bowlerId of match.advancers) {
        requiredGame2.add(bowlerId);
      }
    }
    for (const match of bracket.rounds[1].matches) {
      for (const bowlerId of match.advancers) {
        requiredGame3.add(bowlerId);
      }
    }
  }

  function sortedBowlerRows(ids: Set<number>) {
    return [...ids]
      .map((bowlerId) => {
        const bowler = bowlerById.get(bowlerId);
        return {
          bowlerId,
          name: displayNameById.get(bowlerId) ?? (bowler ? toDisplayName(bowler.name) : `#${bowlerId}`),
        };
      })
      .sort((a, b) => compareDisplayNames(a.name, b.name));
  }

  const refundTotalsMap = new Map<number, number>();
  for (const refund of refunds) {
    refundTotalsMap.set(refund.bowler_id, (refundTotalsMap.get(refund.bowler_id) ?? 0) + refund.amount_cents);
  }

  const refundTotals = [...refundTotalsMap.entries()]
    .map(([bowlerId, amountCents]) => ({
      bowlerId,
      name: displayNameById.get(bowlerId) ?? `#${bowlerId}`,
      amountCents,
    }))
    .sort((a, b) => compareDisplayNames(a.name, b.name));

  const payoutTotalsMap = new Map<number, number>();
  for (const bracket of bracketSnapshots) {
    for (const winnerId of bracket.winnerBowlerIds) {
      payoutTotalsMap.set(winnerId, (payoutTotalsMap.get(winnerId) ?? 0) + session.payout_first_cents);
    }
    for (const secondId of bracket.secondBowlerIds) {
      payoutTotalsMap.set(secondId, (payoutTotalsMap.get(secondId) ?? 0) + session.payout_second_cents);
    }
  }

  const payoutTotals = [...payoutTotalsMap.entries()]
    .map(([bowlerId, amountCents]) => ({
      bowlerId,
      name: displayNameById.get(bowlerId) ?? `#${bowlerId}`,
      amountCents,
    }))
    .sort((a, b) => compareDisplayNames(a.name, b.name));

  return {
    session,
    bowlers,
    refunds,
    refundTotals,
    scores: scoreRows,
    brackets: bracketSnapshots,
    payoutTotals,
    requiredScorersByGame: {
      game1: sortedBowlerRows(requiredGame1),
      game2: sortedBowlerRows(requiredGame2),
      game3: sortedBowlerRows(requiredGame3),
    },
  };
}
