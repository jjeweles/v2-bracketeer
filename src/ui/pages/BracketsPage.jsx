import { VisualBracket } from "../components/VisualBracket";

function isBracketComplete(bracket) {
  return bracket.rounds.every((round) => round.matches.every((match) => match.status === "complete"));
}

export function BracketsPage({
  active,
  sessionCompleted,
  bracketRegenerationLocked,
  brackets,
  onGenerateBrackets,
  onPrintAliveList,
  onPrintBrackets,
}) {
  return (
    <section className={`page ${active ? "is-active" : ""}`}>
      <header className="page-head">
        <div>
          <p className="eyebrow">Brackets</p>
          <h1>Generate brackets</h1>
          <p className="subhead">Create the bracket structure once the roster is locked.</p>
        </div>
      </header>

      <section className="card">
        <div className="row">
          <button
            type="button"
            onClick={onGenerateBrackets}
            disabled={sessionCompleted || bracketRegenerationLocked}
          >
            Generate Brackets
          </button>
          <button
            type="button"
            className="secondary"
            onClick={onPrintAliveList}
            disabled={(brackets?.length ?? 0) === 0}
          >
            Print Alive List
          </button>
          <button
            type="button"
            className="secondary"
            onClick={onPrintBrackets}
            disabled={(brackets?.length ?? 0) === 0}
          >
            Print Brackets
          </button>
        </div>

        <div className="panel">
          {(brackets?.length ?? 0) === 0 ? (
            <div>No brackets generated</div>
          ) : (
            brackets.map((br) => (
              <div className="bracket-card" key={`${br.kind}-${br.bracketNumber}`}>
                <div className="bracket-card-head">
                  <strong>{`${br.kind.toUpperCase()} Bracket #${br.bracketNumber}`}</strong>
                  <span className={`bracket-status ${isBracketComplete(br) ? "is-complete" : "is-live"}`}>
                    {isBracketComplete(br) ? "Complete" : "In Progress"}
                  </span>
                </div>
                <VisualBracket bracket={br} />
              </div>
            ))
          )}
        </div>
      </section>
    </section>
  );
}
