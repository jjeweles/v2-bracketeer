import {
  BRACKET_SEED_LAYOUT,
  formatContenderById,
  getRoundMatch,
  groupDisplay,
  truncateLabel,
  winnerDisplay,
} from "../lib/bracket-format";

export function VisualBracket({ bracket }) {
  const seedByNumber = new Map((bracket.seeds ?? []).map((seed) => [seed.seed, seed]));
  const nameById = new Map((bracket.seeds ?? []).map((seed) => [seed.bowlerId, seed.bowlerName]));
  const handicapById = new Map((bracket.seeds ?? []).map((seed) => [seed.bowlerId, seed.handicapValue]));
  const round1 = bracket.rounds.find((round) => round.round === 1)?.matches ?? [];
  const round2 = bracket.rounds.find((round) => round.round === 2)?.matches ?? [];
  const final = getRoundMatch(bracket, 3, 0);
  const g1ScoreByBowlerId = new Map();
  for (const match of round1) {
    for (const contender of match.contenders) {
      if (contender.score != null) {
        g1ScoreByBowlerId.set(contender.bowlerId, contender.score);
      }
    }
  }
  const g2ScoreByBowlerId = new Map();
  for (const match of round2) {
    for (const contender of match.contenders) {
      if (contender.score != null) {
        g2ScoreByBowlerId.set(contender.bowlerId, contender.score);
      }
    }
  }
  const g3ScoreByBowlerId = new Map();
  for (const contender of final?.contenders ?? []) {
    if (contender.score != null) {
      g3ScoreByBowlerId.set(contender.bowlerId, contender.score);
    }
  }

  const seedLabel = (seed) => {
    const slot = seedByNumber.get(seed);
    if (!slot) return `${seed}. TBD`;
    const line = formatContenderById(slot.bowlerId, {
      kind: bracket.kind,
      handicapById,
      scoreById: g1ScoreByBowlerId,
      nameById,
    });
    return `${seed}. ${line}`;
  };

  const winner = winnerDisplay(bracket, handicapById);

  const points = {
    seedY: {
      1: 40,
      8: 96,
      4: 176,
      5: 232,
      3: 308,
      6: 364,
      2: 444,
      7: 500,
    },
    xStart: 24,
    xRound1: 288,
    xRound2: 552,
    xFinal: 840,
    xWinner: 1048,
  };

  const pairToMid = (a, b) => (points.seedY[a] + points.seedY[b]) / 2;
  const r1Top = pairToMid(1, 8);
  const r1UpperMid = pairToMid(4, 5);
  const r1LowerMid = pairToMid(3, 6);
  const r1Bottom = pairToMid(2, 7);
  const semiTopMid = (r1Top + r1UpperMid) / 2;
  const semiBottomMid = (r1LowerMid + r1Bottom) / 2;
  const finalMid = (semiTopMid + semiBottomMid) / 2;

  const firstRoundPairs = [
    [1, 8],
    [4, 5],
    [3, 6],
    [2, 7],
  ];

  const r2TopTopGroup = round1[0]?.advancers ?? [];
  const r2TopBottomGroup = round1[3]?.advancers ?? [];
  const r2BottomTopGroup = round1[1]?.advancers ?? [];
  const r2BottomBottomGroup = round1[2]?.advancers ?? [];
  const finalTopGroup = round2[0]?.advancers ?? [];
  const finalBottomGroup = round2[1]?.advancers ?? [];

  return (
    <div className="visual-bracket-wrap">
      <svg className="visual-bracket" viewBox="0 0 1180 540" role="img" aria-label={`${bracket.kind} bracket`}>
        <g className="vb-lines">
          {firstRoundPairs.map(([seedA, seedB]) => {
            const yA = points.seedY[seedA];
            const yB = points.seedY[seedB];
            const midY = (yA + yB) / 2;
            return (
              <g key={`${seedA}-${seedB}`}>
                <line x1={points.xStart} y1={yA} x2={points.xRound1} y2={yA} />
                <line x1={points.xStart} y1={yB} x2={points.xRound1} y2={yB} />
                <line x1={points.xRound1} y1={yA} x2={points.xRound1} y2={yB} />
                <line x1={points.xRound1} y1={midY} x2={points.xRound2} y2={midY} />
              </g>
            );
          })}

          <line x1={points.xRound2} y1={r1Top} x2={points.xRound2} y2={r1UpperMid} />
          <line x1={points.xRound2} y1={semiTopMid} x2={points.xFinal} y2={semiTopMid} />

          <line x1={points.xRound2} y1={r1LowerMid} x2={points.xRound2} y2={r1Bottom} />
          <line x1={points.xRound2} y1={semiBottomMid} x2={points.xFinal} y2={semiBottomMid} />

          <line x1={points.xFinal} y1={semiTopMid} x2={points.xFinal} y2={semiBottomMid} />
          <line x1={points.xFinal} y1={finalMid} x2={points.xWinner} y2={finalMid} />
        </g>

        <g className="vb-seed-text">
          {BRACKET_SEED_LAYOUT.map((seed) => (
            <text key={seed} x={8} y={points.seedY[seed] - 7}>
              {truncateLabel(seedLabel(seed), 34)}
            </text>
          ))}
        </g>

        <g className="vb-round-text">
          <text x={points.xRound1 + 14} y={r1Top - 10}>
            {truncateLabel(
              groupDisplay(r2TopTopGroup, {
                kind: bracket.kind,
                handicapById,
                scoreById: g2ScoreByBowlerId,
                nameById,
              }),
              40
            )}
          </text>
          <text x={points.xRound1 + 14} y={r1UpperMid - 10}>
            {truncateLabel(
              groupDisplay(r2TopBottomGroup, {
                kind: bracket.kind,
                handicapById,
                scoreById: g2ScoreByBowlerId,
                nameById,
              }),
              40
            )}
          </text>
          <text x={points.xRound1 + 14} y={r1LowerMid - 10}>
            {truncateLabel(
              groupDisplay(r2BottomTopGroup, {
                kind: bracket.kind,
                handicapById,
                scoreById: g2ScoreByBowlerId,
                nameById,
              }),
              40
            )}
          </text>
          <text x={points.xRound1 + 14} y={r1Bottom - 10}>
            {truncateLabel(
              groupDisplay(r2BottomBottomGroup, {
                kind: bracket.kind,
                handicapById,
                scoreById: g2ScoreByBowlerId,
                nameById,
              }),
              40
            )}
          </text>
          <text x={points.xRound2 + 14} y={semiTopMid - 10}>
            {truncateLabel(
              groupDisplay(finalTopGroup, {
                kind: bracket.kind,
                handicapById,
                scoreById: g3ScoreByBowlerId,
                nameById,
              }),
              40
            )}
          </text>
          <text x={points.xRound2 + 14} y={semiBottomMid - 10}>
            {truncateLabel(
              groupDisplay(finalBottomGroup, {
                kind: bracket.kind,
                handicapById,
                scoreById: g3ScoreByBowlerId,
                nameById,
              }),
              40
            )}
          </text>
          <text className="vb-winner-label" x={points.xFinal + 2} y={finalMid - 10}>
            {`Winner: ${truncateLabel(winner, 26)}`}
          </text>
        </g>
      </svg>
    </div>
  );
}
