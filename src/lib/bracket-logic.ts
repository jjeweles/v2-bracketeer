import type { BracketKind, BracketSnapshot, Slot } from "./bracket-types";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildEightManGroups(entryCounts: Map<number, number>) {
  const normalized = new Map<number, number>();
  for (const [id, rawCount] of entryCounts.entries()) {
    const count = Math.max(0, Math.floor(Number(rawCount) || 0));
    if (count > 0) {
      normalized.set(id, count);
    }
  }

  const ids = [...normalized.keys()];
  const totalEntries = [...normalized.values()].reduce((acc, n) => acc + n, 0);
  const uniqueAvailable = ids.length;

  function feasible(bracketCount: number): boolean {
    if (bracketCount <= 0) return true;
    if (uniqueAvailable < 8) return false;
    let capacity = 0;
    for (const count of normalized.values()) {
      capacity += Math.min(count, bracketCount);
    }
    return capacity >= bracketCount * 8;
  }

  const maxByEntries = Math.floor(totalEntries / 8);
  let targetBracketCount = 0;
  for (let candidate = 1; candidate <= maxByEntries; candidate += 1) {
    if (feasible(candidate)) {
      targetBracketCount = candidate;
    } else {
      break;
    }
  }

  if (targetBracketCount === 0) {
    return { brackets: [], leftovers: new Map(entryCounts) };
  }

  const quotas = new Map<number, number>();
  let quotaSum = 0;
  for (const id of ids) {
    const q = Math.min(normalized.get(id) ?? 0, targetBracketCount);
    quotas.set(id, q);
    quotaSum += q;
  }

  let extras = quotaSum - targetBracketCount * 8;
  if (extras > 0) {
    const trimOrder = [...ids].sort((a, b) => {
      const diff = (quotas.get(b) ?? 0) - (quotas.get(a) ?? 0);
      if (diff !== 0) return diff;
      return a - b;
    });
    for (const id of trimOrder) {
      if (extras <= 0) break;
      const current = quotas.get(id) ?? 0;
      const take = Math.min(current, extras);
      quotas.set(id, current - take);
      extras -= take;
    }
  }

  const brackets: number[][] = Array.from({ length: targetBracketCount }, () => []);
  const loads = Array.from({ length: targetBracketCount }, () => 0);
  const assignmentOrder = [...ids].sort((a, b) => {
    const diff = (quotas.get(b) ?? 0) - (quotas.get(a) ?? 0);
    if (diff !== 0) return diff;
    return a - b;
  });

  for (const id of assignmentOrder) {
    const quota = quotas.get(id) ?? 0;
    if (quota <= 0) continue;
    const usedRounds = new Set<number>();

    for (let n = 0; n < quota; n += 1) {
      let bestRound = -1;
      let bestLoad = Number.POSITIVE_INFINITY;

      for (let round = 0; round < targetBracketCount; round += 1) {
        if (usedRounds.has(round)) continue;
        if (loads[round] < bestLoad) {
          bestLoad = loads[round];
          bestRound = round;
        }
      }

      if (bestRound < 0) {
        continue;
      }

      brackets[bestRound].push(id);
      loads[bestRound] += 1;
      usedRounds.add(bestRound);
    }
  }

  const completeBrackets = brackets
    .filter((group) => group.length === 8)
    .map((group) => shuffle(group));
  const usage = new Map<number, number>();
  for (const group of completeBrackets) {
    for (const id of group) {
      usage.set(id, (usage.get(id) ?? 0) + 1);
    }
  }

  const leftovers = new Map(entryCounts);
  for (const [id, used] of usage.entries()) {
    leftovers.set(id, Math.max(0, (leftovers.get(id) ?? 0) - used));
  }

  return { brackets: completeBrackets, leftovers };
}

function getEffectiveScore(
  scoreMap: Map<number, number>,
  kind: BracketKind,
  bowlerId: number,
  handicapValue: number,
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
  scoreByBowler: Map<number, number>,
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

export function createBracketSnapshot(
  bracket: { id: number; kind: BracketKind; bracket_number: number },
  slots: Slot[],
  scoresByGame: [Map<number, number>, Map<number, number>, Map<number, number>],
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
    };
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
  ];

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
  };

  return {
    bracketId: bracket.id,
    kind: bracket.kind,
    bracketNumber: bracket.bracket_number,
    seeds: slots,
    rounds: [
      { round: 1, matches: r1Matches },
      { round: 2, matches: r2Matches },
      { round: 3, matches: [finalsMatch] },
    ],
    winnerBowlerIds: winners,
    secondBowlerIds: second,
  };
}
