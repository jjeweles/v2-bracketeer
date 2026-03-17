import type { BracketKind, BracketSnapshot, Slot } from "./bracket-types";

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

export function buildEightManGroups(entryCounts: Map<number, number>) {
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
