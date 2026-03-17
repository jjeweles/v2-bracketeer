export type BracketKind = "scratch" | "handicap";

export type Slot = {
  seed: number;
  bowlerId: number;
  bowlerName: string;
  handicapValue: number;
};

export type BracketSnapshot = {
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
