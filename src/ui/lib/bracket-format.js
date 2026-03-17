export const BRACKET_SEED_LAYOUT = [1, 8, 4, 5, 3, 6, 2, 7];

export function truncateLabel(value, max = 30) {
  const text = String(value ?? "");
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}...`;
}

export function formatContenderById(bowlerId, options = {}) {
  const { kind = "scratch", handicapById = new Map(), scoreById = new Map(), nameById = new Map() } = options;
  if (bowlerId == null) return "TBD";
  const name = nameById.get(bowlerId) ?? `#${bowlerId}`;
  const handicap = kind === "handicap" ? Number(handicapById.get(bowlerId) ?? 0) : null;
  const score = scoreById.get(bowlerId);
  if (kind === "handicap") {
    return score == null ? `${name} (${handicap})` : `${name} (${handicap}) - ${score}`;
  }
  return score == null ? name : `${name} - ${score}`;
}

export function getRoundMatch(bracket, roundNumber, matchIndex) {
  const round = bracket.rounds.find((item) => item.round === roundNumber);
  return round?.matches?.[matchIndex] ?? null;
}

export function groupDisplay(ids, options = {}) {
  if (!Array.isArray(ids) || ids.length === 0) return "TBD";
  return ids.map((bowlerId) => formatContenderById(bowlerId, options)).join(" / ");
}

export function winnerDisplay(bracket, handicapById = new Map()) {
  const final = getRoundMatch(bracket, 3, 0);
  if (!final || final.advancers.length === 0) return "TBD";
  const scoreById = new Map(final.contenders.map((contender) => [contender.bowlerId, contender.score]));
  const nameById = new Map((bracket.seeds ?? []).map((seed) => [seed.bowlerId, seed.bowlerName]));
  return final.advancers
    .map((bowlerId) => formatContenderById(bowlerId, { kind: bracket.kind, handicapById, scoreById, nameById }))
    .join(" / ");
}

export function buildAliveListByKind(snapshot) {
  const result = {
    scratch: [],
    handicap: [],
  };
  const brackets = snapshot?.brackets ?? [];

  for (const kind of ["scratch", "handicap"]) {
    const enteredById = new Map();
    const aliveCountById = new Map();

    for (const bracket of brackets.filter((item) => item.kind === kind)) {
      const aliveInBracket = new Set((bracket.seeds ?? []).map((seed) => seed.bowlerId));
      for (const round of bracket.rounds ?? []) {
        for (const match of round.matches ?? []) {
          if (match.status !== "complete") continue;
          const advancers = new Set(match.advancers ?? []);
          for (const contender of match.contenders ?? []) {
            if (!advancers.has(contender.bowlerId)) {
              aliveInBracket.delete(contender.bowlerId);
            }
          }
        }
      }

      for (const seed of bracket.seeds ?? []) {
        enteredById.set(seed.bowlerId, seed.bowlerName);
      }
      for (const bowlerId of aliveInBracket) {
        aliveCountById.set(bowlerId, (aliveCountById.get(bowlerId) ?? 0) + 1);
      }
    }

    const rows = Array.from(enteredById.entries()).map(([bowlerId, bowlerName]) => ({
      bowlerId,
      bowlerName,
      aliveCount: aliveCountById.get(bowlerId) ?? 0,
    }));
    rows.sort((a, b) => a.bowlerName.localeCompare(b.bowlerName, undefined, { sensitivity: "base" }));
    result[kind] = rows;
  }

  return result;
}
