import { db } from "./db";
import { buildEightManGroups, createBracketSnapshot } from "./bracket-logic";
import type { BracketKind, BracketSnapshot, Slot } from "./bracket-types";
export type { BracketKind } from "./bracket-types";

type Bowler = {
  id: number;
  session_id: number;
  name: string;
  lane_number: number | null;
  average: number;
  handicap_value: number;
  scratch_entries: number;
  handicap_entries: number;
  pay_later: number;
  all_brackets: number;
  all_brackets_count: number;
  all_brackets_mode: "off" | "both" | "scratch" | "handicap";
};

type Session = {
  id: number;
  name: string;
  entry_fee_cents: number;
  handicap_percent: number;
  handicap_base: number;
  payout_first_cents: number;
  payout_second_cents: number;
  is_completed: number;
  brackets_printed_at: string | null;
  completed_at: string | null;
};

const getSessionStmt = db.query(
  `SELECT id, name, entry_fee_cents, handicap_percent, handicap_base, payout_first_cents, payout_second_cents, is_completed, brackets_printed_at, completed_at FROM sessions WHERE id = ?`
);
const getBowlersStmt = db.query(
  `SELECT id, session_id, name, lane_number, average, handicap_value, scratch_entries, handicap_entries, pay_later, all_brackets, all_brackets_count, all_brackets_mode
   FROM bowlers WHERE session_id = ? ORDER BY id`
);
const getBowlerStmt = db.query(
  `SELECT id, session_id, name, lane_number, average, handicap_value, scratch_entries, handicap_entries, pay_later, all_brackets, all_brackets_count, all_brackets_mode
   FROM bowlers WHERE id = ? AND session_id = ?`
);

function normalizeAllBracketsMode(mode: unknown): "off" | "both" | "scratch" | "handicap" {
  return mode === "both" || mode === "scratch" || mode === "handicap" ? mode : "off";
}

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

function allModeAppliesToKind(mode: Bowler["all_brackets_mode"], kind: BracketKind): boolean {
  return mode === "both" || mode === kind;
}

export function listSessions() {
  return db
    .query(
      `SELECT id, name, entry_fee_cents, handicap_percent, handicap_base, payout_first_cents, payout_second_cents, is_completed, brackets_printed_at, completed_at, created_at
       FROM sessions ORDER BY id DESC`
    )
    .all();
}

function getSessionOrThrow(sessionId: number): Session {
  const session = getSessionStmt.get(sessionId) as Session | null;
  if (!session) {
    throw new Error("Session not found");
  }
  return session;
}

function assertSessionEditable(sessionId: number): Session {
  const session = getSessionOrThrow(sessionId);
  if (session.is_completed) {
    throw new Error("Session is completed and read-only");
  }
  return session;
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
    laneNumber?: number | null;
    average: number;
    scratchEntries: number;
    handicapEntries: number;
    payLater?: boolean;
    allBracketsMode?: "off" | "both" | "scratch" | "handicap";
    allBracketsCount?: number;
  }
) {
  const session = assertSessionEditable(sessionId);

  const handicapValue = calculateHandicap(input.average, session.handicap_percent, session.handicap_base);

  const stmt = db.query(
    `INSERT INTO bowlers (session_id, name, lane_number, average, handicap_value, scratch_entries, handicap_entries, pay_later, all_brackets, all_brackets_count, all_brackets_mode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  );
  const allBracketsMode = normalizeAllBracketsMode(input.allBracketsMode);
  const allBracketsCount = allBracketsMode === "off" ? 0 : Math.max(1, Number(input.allBracketsCount ?? 1));
  const allBrackets = allBracketsMode === "off" ? 0 : 1;
  const laneNumber =
    input.laneNumber == null || !Number.isFinite(input.laneNumber) || input.laneNumber < 1
      ? null
      : Math.floor(input.laneNumber);

  return stmt.get(
    sessionId,
    input.name.trim(),
    laneNumber,
    input.average,
    handicapValue,
    input.scratchEntries,
    input.handicapEntries,
    input.payLater ? 1 : 0,
    allBrackets,
    allBracketsCount,
    allBracketsMode
  );
}

export function listBowlers(sessionId: number) {
  return getBowlersStmt.all(sessionId);
}

function dateSuffix() {
  return new Date().toISOString().slice(0, 10);
}

function uniqueSessionName(baseName: string): string {
  const base = baseName.trim();
  const exists = db.query(`SELECT 1 FROM sessions WHERE name = ? LIMIT 1`);
  if (!exists.get(base)) {
    return base;
  }

  const baseWithoutCounter = base.replace(/\s\(\d+\)$/, "");
  const alreadyDated = /\s-\s\d{4}-\d{2}-\d{2}$/.test(baseWithoutCounter);
  const dated = alreadyDated ? baseWithoutCounter : `${baseWithoutCounter} - ${dateSuffix()}`;
  if (!exists.get(dated)) {
    return dated;
  }

  let n = 2;
  while (exists.get(`${dated} (${n})`)) {
    n += 1;
  }
  return `${dated} (${n})`;
}

export function cloneSessionFromExisting(sessionId: number, name?: string) {
  const source = getSessionOrThrow(sessionId);
  const clonedName = uniqueSessionName(name?.trim() || source.name);
  const created = createSession({
    name: clonedName,
    entryFeeDollars: source.entry_fee_cents / 100,
    handicapPercent: source.handicap_percent,
    handicapBase: source.handicap_base,
    payoutFirstDollars: source.payout_first_cents / 100,
    payoutSecondDollars: source.payout_second_cents / 100,
  }) as Session;

  const sourceBowlers = getBowlersStmt.all(sessionId) as Bowler[];
  for (const bowler of sourceBowlers) {
    addBowler(created.id, {
      name: bowler.name,
      average: bowler.average,
      scratchEntries: 0,
      handicapEntries: 0,
      payLater: false,
      allBracketsMode: "off",
      allBracketsCount: 0,
    });
  }

  return created;
}

export function deleteSession(sessionId: number) {
  const session = getSessionOrThrow(sessionId);
  db.query(`DELETE FROM sessions WHERE id = ?`).run(session.id);
  return { deleted: true };
}

export function updateBowler(
  sessionId: number,
  bowlerId: number,
  input: {
    name?: string;
    laneNumber?: number | null;
    average?: number;
    scratchEntries?: number;
    handicapEntries?: number;
    payLater?: boolean;
    allBracketsMode?: "off" | "both" | "scratch" | "handicap";
    allBracketsCount?: number;
  }
) {
  const session = assertSessionEditable(sessionId);

  const bowler = getBowlerStmt.get(bowlerId, sessionId) as Bowler | null;
  if (!bowler) {
    throw new Error("Bowler not found");
  }

  const nextName = input.name == null ? bowler.name : input.name.trim();
  const nextLaneNumber =
    input.laneNumber === undefined
      ? bowler.lane_number
      : input.laneNumber === null || !Number.isFinite(input.laneNumber) || input.laneNumber < 1
      ? null
      : Math.floor(input.laneNumber);
  const nextAverage = input.average == null ? bowler.average : input.average;
  const nextScratchEntries = input.scratchEntries == null ? bowler.scratch_entries : input.scratchEntries;
  const nextHandicapEntries = input.handicapEntries == null ? bowler.handicap_entries : input.handicapEntries;
  const nextPayLater = input.payLater == null ? bowler.pay_later : input.payLater ? 1 : 0;
  const nextAllMode = input.allBracketsMode == null ? bowler.all_brackets_mode : normalizeAllBracketsMode(input.allBracketsMode);
  const nextAllBrackets = nextAllMode === "off" ? 0 : 1;
  const nextAllBracketsCount =
    nextAllMode === "off"
      ? 0
      : input.allBracketsCount == null
      ? Math.max(1, bowler.all_brackets_count || 1)
      : Math.max(1, Number(input.allBracketsCount));
  const handicapValue = calculateHandicap(nextAverage, session.handicap_percent, session.handicap_base);

  const updated = db
    .query(
      `UPDATE bowlers
       SET name = ?, lane_number = ?, average = ?, handicap_value = ?, scratch_entries = ?, handicap_entries = ?, pay_later = ?, all_brackets = ?, all_brackets_count = ?, all_brackets_mode = ?
       WHERE id = ? AND session_id = ?
       RETURNING *`
    )
    .get(
      nextName,
      nextLaneNumber,
      nextAverage,
      handicapValue,
      nextScratchEntries,
      nextHandicapEntries,
      nextPayLater,
      nextAllBrackets,
      nextAllBracketsCount,
      nextAllMode,
      bowlerId,
      sessionId
    ) as Bowler | null;

  if (!updated) {
    throw new Error("Failed to update bowler");
  }

  return updated;
}

export function deleteBowler(sessionId: number, bowlerId: number) {
  assertSessionEditable(sessionId);

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

export function setRefundPaid(sessionId: number, bowlerId: number, paid: boolean) {
  assertSessionEditable(sessionId);
  if (paid) {
    db.query(
      `INSERT INTO refund_payments (session_id, bowler_id)
       VALUES (?, ?)
       ON CONFLICT(session_id, bowler_id) DO UPDATE SET paid_at = datetime('now')`
    ).run(sessionId, bowlerId);
  } else {
    db.query(`DELETE FROM refund_payments WHERE session_id = ? AND bowler_id = ?`).run(sessionId, bowlerId);
  }
  return getSessionSnapshot(sessionId);
}

export function setPayoutPaid(sessionId: number, bowlerId: number, paid: boolean) {
  assertSessionEditable(sessionId);
  if (paid) {
    db.query(
      `INSERT INTO payout_payments (session_id, bowler_id)
       VALUES (?, ?)
       ON CONFLICT(session_id, bowler_id) DO UPDATE SET paid_at = datetime('now')`
    ).run(sessionId, bowlerId);
  } else {
    db.query(`DELETE FROM payout_payments WHERE session_id = ? AND bowler_id = ?`).run(sessionId, bowlerId);
  }
  return getSessionSnapshot(sessionId);
}

export function setOwedPaid(sessionId: number, bowlerId: number, paid: boolean) {
  assertSessionEditable(sessionId);
  if (paid) {
    db.query(
      `INSERT INTO owed_payments (session_id, bowler_id)
       VALUES (?, ?)
       ON CONFLICT(session_id, bowler_id) DO UPDATE SET paid_at = datetime('now')`
    ).run(sessionId, bowlerId);
  } else {
    db.query(`DELETE FROM owed_payments WHERE session_id = ? AND bowler_id = ?`).run(sessionId, bowlerId);
  }
  return getSessionSnapshot(sessionId);
}

export function generateBrackets(sessionId: number) {
  const session = assertSessionEditable(sessionId);
  const hasExistingScores = db.query(`SELECT 1 FROM bowler_scores WHERE session_id = ? LIMIT 1`).get(sessionId);
  if (session.brackets_printed_at || hasExistingScores) {
    throw new Error("Bracket regeneration is locked after scores are entered or brackets are printed");
  }

  const bowlers = getBowlersStmt.all(sessionId) as Bowler[];

  db.transaction(() => {
    db.query(`DELETE FROM refund_payments WHERE session_id = ?`).run(sessionId);
    db.query(`DELETE FROM payout_payments WHERE session_id = ?`).run(sessionId);
    db.query(`DELETE FROM owed_payments WHERE session_id = ?`).run(sessionId);
    db.query(`DELETE FROM refunds WHERE session_id = ?`).run(sessionId);
    db.query(`DELETE FROM bracket_slots WHERE bracket_id IN (SELECT id FROM brackets WHERE session_id = ?)`).run(sessionId);
    db.query(`DELETE FROM brackets WHERE session_id = ?`).run(sessionId);

    for (const kind of ["scratch", "handicap"] as const) {
      const forcedAll = bowlers.filter((bowler) => allModeAppliesToKind(bowler.all_brackets_mode, kind));
      const counts = new Map<number, number>();

      if (forcedAll.length > 0 && forcedAll.length < 8) {
        const slotsPerBracket = 8 - forcedAll.length;
        let nonAllTotalEntries = 0;

        for (const bowler of bowlers) {
          if (allModeAppliesToKind(bowler.all_brackets_mode, kind)) {
            continue;
          }
          const configuredCount = kind === "scratch" ? bowler.scratch_entries : bowler.handicap_entries;
          const normalized = Math.max(0, configuredCount);
          counts.set(bowler.id, normalized);
          nonAllTotalEntries += normalized;
        }

        const bracketCount = Math.max(0, Math.floor(nonAllTotalEntries / slotsPerBracket));
        for (const bowler of forcedAll) {
          counts.set(bowler.id, bracketCount);
        }
      } else {
        for (const bowler of bowlers) {
          const configuredCount = kind === "scratch" ? bowler.scratch_entries : bowler.handicap_entries;
          let count = configuredCount;
          if (allModeAppliesToKind(bowler.all_brackets_mode, kind)) {
            count = 1;
          }
          counts.set(bowler.id, Math.max(0, count));
        }
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

export function markBracketsPrinted(sessionId: number) {
  assertSessionEditable(sessionId);
  db.query(
    `UPDATE sessions
     SET brackets_printed_at = COALESCE(brackets_printed_at, datetime('now'))
     WHERE id = ?`
  ).run(sessionId);
  return getSessionSnapshot(sessionId);
}

function getScoreMap(sessionId: number, gameNumber: number): Map<number, number> {
  const rows = db
    .query(`SELECT bowler_id, scratch_score FROM bowler_scores WHERE session_id = ? AND game_number = ?`)
    .all(sessionId, gameNumber) as { bowler_id: number; scratch_score: number }[];
  return new Map(rows.map((row) => [row.bowler_id, row.scratch_score]));
}

export function upsertGameScores(
  sessionId: number,
  gameNumber: number,
  scores: Array<{ bowlerId: number; scratchScore: number }>
) {
  assertSessionEditable(sessionId);
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
  const session = getSessionOrThrow(sessionId);
  const hasAnyScores = Boolean(db.query(`SELECT 1 FROM bowler_scores WHERE session_id = ? LIMIT 1`).get(sessionId));
  const bracketRegenerationLocked = Boolean(session.brackets_printed_at || hasAnyScores);

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
          laneNumber: bowler?.lane_number ?? null,
          name: displayNameById.get(bowlerId) ?? (bowler ? toDisplayName(bowler.name) : `#${bowlerId}`),
        };
      })
      .sort((a, b) => {
        const aLane = a.laneNumber == null ? Number.POSITIVE_INFINITY : a.laneNumber;
        const bLane = b.laneNumber == null ? Number.POSITIVE_INFINITY : b.laneNumber;
        if (aLane !== bLane) {
          return aLane - bLane;
        }
        return compareDisplayNames(a.name, b.name);
      });
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

  const scratchBracketCount = bracketSnapshots.filter((bracket) => bracket.kind === "scratch").length;
  const handicapBracketCount = bracketSnapshots.filter((bracket) => bracket.kind === "handicap").length;

  const grossOwedByBowler = new Map<number, number>();
  for (const bowler of bowlers) {
    if (!bowler.pay_later) continue;
    const scratchEntries =
      bowler.all_brackets_mode === "both" || bowler.all_brackets_mode === "scratch"
        ? scratchBracketCount
        : bowler.scratch_entries;
    const handicapEntries =
      bowler.all_brackets_mode === "both" || bowler.all_brackets_mode === "handicap"
        ? handicapBracketCount
        : bowler.handicap_entries;
    const grossOwedCents = Math.max(0, scratchEntries + handicapEntries) * session.entry_fee_cents;
    grossOwedByBowler.set(bowler.id, grossOwedCents);
  }

  const payoutTotals = [...payoutTotalsMap.entries()]
    .map(([bowlerId, amountCents]) => {
      const netAmountCents = Math.max(0, amountCents - (grossOwedByBowler.get(bowlerId) ?? 0));
      return {
        bowlerId,
        name: displayNameById.get(bowlerId) ?? `#${bowlerId}`,
        amountCents: netAmountCents,
      };
    })
    .filter((row) => row.amountCents > 0)
    .sort((a, b) => compareDisplayNames(a.name, b.name));

  const paidRefundBowlerIds = new Set(
    (
      db
        .query(`SELECT bowler_id FROM refund_payments WHERE session_id = ?`)
        .all(sessionId) as { bowler_id: number }[]
    ).map((row) => row.bowler_id)
  );
  const paidPayoutBowlerIds = new Set(
    (
      db
        .query(`SELECT bowler_id FROM payout_payments WHERE session_id = ?`)
        .all(sessionId) as { bowler_id: number }[]
    ).map((row) => row.bowler_id)
  );
  const paidOwedBowlerIds = new Set(
    (
      db
        .query(`SELECT bowler_id FROM owed_payments WHERE session_id = ?`)
        .all(sessionId) as { bowler_id: number }[]
    ).map((row) => row.bowler_id)
  );

  const refundsOutstandingCents = refundTotals.reduce((acc, row) => {
    return acc + (paidRefundBowlerIds.has(row.bowlerId) ? 0 : row.amountCents);
  }, 0);
  const payoutsOutstandingCents = payoutTotals.reduce((acc, row) => {
    return acc + (paidPayoutBowlerIds.has(row.bowlerId) ? 0 : row.amountCents);
  }, 0);

  const payoutByBowler = payoutTotalsMap;
  const owedTotals = bowlers
    .filter((bowler) => bowler.pay_later)
    .map((bowler) => {
      const scratchEntries =
        bowler.all_brackets_mode === "both" || bowler.all_brackets_mode === "scratch"
          ? scratchBracketCount
          : bowler.scratch_entries;
      const handicapEntries =
        bowler.all_brackets_mode === "both" || bowler.all_brackets_mode === "handicap"
          ? handicapBracketCount
          : bowler.handicap_entries;
      const grossOwedCents = Math.max(0, scratchEntries + handicapEntries) * session.entry_fee_cents;
      const payoutCreditCents = payoutByBowler.get(bowler.id) ?? 0;
      const netOwedCents = Math.max(0, grossOwedCents - payoutCreditCents);
      return {
        bowlerId: bowler.id,
        name: displayNameById.get(bowler.id) ?? toDisplayName(bowler.name),
        grossOwedCents,
        payoutCreditCents,
        netOwedCents,
        isPaid: paidOwedBowlerIds.has(bowler.id),
      };
    })
    .sort((a, b) => compareDisplayNames(a.name, b.name));

  const owedOutstandingCents = owedTotals.reduce((acc, row) => {
    return acc + (row.isPaid || row.netOwedCents === 0 ? 0 : row.netOwedCents);
  }, 0);

  const scoringComplete =
    bracketSnapshots.length > 0 &&
    bracketSnapshots.every((bracket) =>
      bracket.rounds.every((round) => round.matches.every((match) => match.status === "complete"))
    );
  const canComplete =
    scoringComplete && refundsOutstandingCents === 0 && payoutsOutstandingCents === 0 && owedOutstandingCents === 0;

  return {
    session,
    hasAnyScores,
    bracketRegenerationLocked,
    bowlers,
    refunds,
    refundTotals,
    scores: scoreRows,
    brackets: bracketSnapshots,
    payoutTotals,
    paidRefundBowlerIds: [...paidRefundBowlerIds],
    paidPayoutBowlerIds: [...paidPayoutBowlerIds],
    owedTotals,
    paidOwedBowlerIds: [...paidOwedBowlerIds],
    completion: {
      canComplete,
      scoringComplete,
      refundsOutstandingCents,
      payoutsOutstandingCents,
      owedOutstandingCents,
    },
    requiredScorersByGame: {
      game1: sortedBowlerRows(requiredGame1),
      game2: sortedBowlerRows(requiredGame2),
      game3: sortedBowlerRows(requiredGame3),
    },
  };
}

export function completeSession(sessionId: number) {
  assertSessionEditable(sessionId);
  const snapshot = getSessionSnapshot(sessionId) as {
    completion: {
      canComplete: boolean;
      scoringComplete: boolean;
      refundsOutstandingCents: number;
      payoutsOutstandingCents: number;
      owedOutstandingCents: number;
    };
  };

  if (!snapshot.completion.canComplete) {
    throw new Error(
      `Session cannot be completed yet (scoringComplete=${snapshot.completion.scoringComplete}, refundsOutstanding=${snapshot.completion.refundsOutstandingCents}, payoutsOutstanding=${snapshot.completion.payoutsOutstandingCents}, owedOutstanding=${snapshot.completion.owedOutstandingCents})`
    );
  }

  db.query(`UPDATE sessions SET is_completed = 1, completed_at = datetime('now') WHERE id = ?`).run(sessionId);
  return getSessionSnapshot(sessionId);
}
