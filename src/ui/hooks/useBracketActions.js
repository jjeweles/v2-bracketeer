import { useCallback } from "react";
import { api } from "../lib/api-client";
import { buildAliveListByKind } from "../lib/bracket-format";
import { getDocumentStylesHtml, openAndPrintHtml } from "../lib/print-utils";

function inferAliveListGameNumber(snapshot) {
  if (!snapshot) return 1;
  const isGameComplete = (game) => {
    const required = snapshot?.requiredScorersByGame?.[`game${game}`] ?? [];
    if (required.length === 0) return false;
    const existing = new Map();
    for (const row of snapshot?.scores ?? []) {
      if (row.game_number === game) {
        existing.set(row.bowler_id, row.scratch_score);
      }
    }
    return required.every((s) => Number.isFinite(existing.get(s.bowlerId)));
  };

  if (!isGameComplete(1)) return 1;
  if (!isGameComplete(2)) return 2;
  return 3;
}

const BRACKET_PRINT_STYLES = `<style>
  @page { margin: 10mm; }
  body { margin: 0; background: #ffffff; color: #111111; }
  .print-brackets-sheet.print-grid-6 { display: block; width: 100%; }
  .print-brackets-sheet.print-grid-6 .print-brackets-page {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-template-rows: repeat(2, minmax(0, 1fr));
    gap: 6mm;
    break-after: page;
    page-break-after: always;
  }
  .print-brackets-sheet.print-grid-6 .print-brackets-page:last-child {
    break-after: auto;
    page-break-after: auto;
  }
  .print-brackets-sheet.print-grid-6 .print-brackets-page .bracket-card {
    break-inside: avoid;
    page-break-inside: avoid;
    border: 1px solid #999999;
    border-radius: 8px;
    background: #ffffff;
    color: #111111;
    margin: 0;
    padding: 2.5mm;
  }
  .bracket-card-head { display: flex; justify-content: space-between; align-items: center; gap: 4mm; margin-bottom: 2mm; }
  .bracket-status { color: #111111 !important; border: 1px solid #555555; background: #ffffff; border-radius: 999px; padding: 1mm 2mm; font-size: 10px; }
  .visual-bracket-wrap { border: 1px solid #b3b3b3; background: #ffffff; overflow: visible; padding: 1mm; }
  .visual-bracket { width: 100%; min-width: 0; height: auto; }
  .vb-lines line { stroke: #222222 !important; }
  .vb-seed-text text, .vb-round-text text, .vb-winner-label { fill: #111111 !important; }
</style>`;

export function useBracketActions({
  activeSessionId,
  sessionCompleted,
  bracketRegenerationLocked,
  snapshot,
  setSnapshot,
  setRefundModalOpen,
  setOwedModalOpen,
  setStatus,
}) {
  const onGenerateBrackets = useCallback(async () => {
    if (!activeSessionId) {
      setStatus("Select session first");
      return;
    }
    if (sessionCompleted) {
      setStatus("Session is completed and read-only");
      return;
    }
    if (bracketRegenerationLocked) {
      setStatus("Bracket regeneration is locked after scores are entered or brackets are printed");
      return;
    }

    try {
      const nextSnapshot = await api(`/api/sessions/${activeSessionId}/generate-brackets`, {
        method: "POST",
      });
      setSnapshot(nextSnapshot);
      setRefundModalOpen(false);
      setOwedModalOpen(false);
      setStatus("Brackets generated");
    } catch (err) {
      setStatus(err.message);
    }
  }, [
    activeSessionId,
    bracketRegenerationLocked,
    sessionCompleted,
    setOwedModalOpen,
    setRefundModalOpen,
    setSnapshot,
    setStatus,
  ]);

  const onPrintBrackets = useCallback(async () => {
    if ((snapshot?.brackets?.length ?? 0) === 0) {
      setStatus("No brackets to print");
      return;
    }
    if (typeof window === "undefined") {
      setStatus("Printing is unavailable in this environment");
      return;
    }
    if (!activeSessionId) {
      setStatus("Select session first");
      return;
    }

    try {
      const lockedSnapshot = await api(`/api/sessions/${activeSessionId}/mark-brackets-printed`, {
        method: "POST",
      });
      setSnapshot(lockedSnapshot);
    } catch (err) {
      setStatus(err.message);
      return;
    }

    const styles = getDocumentStylesHtml(document);
    const cards = Array.from(document.querySelectorAll(".bracket-card"));
    if (cards.length === 0) {
      setStatus("No brackets to print");
      return;
    }

    const pageHtml = [];
    for (let i = 0; i < cards.length; i += 6) {
      const cardsHtml = cards
        .slice(i, i + 6)
        .map((card) => card.outerHTML)
        .join("");
      pageHtml.push(`<section class="print-brackets-page">${cardsHtml}</section>`);
    }
    const printed = openAndPrintHtml({
      title: "Bracket Print",
      stylesHtml: `${styles}\n${BRACKET_PRINT_STYLES}`,
      bodyHtml: `<main class="print-brackets-sheet print-grid-6">${pageHtml.join("")}</main>`,
      windowFeatures: "noopener,noreferrer",
    });

    if (!printed) {
      const containerId = "brackets-print-fallback";
      let container = document.getElementById(containerId);
      if (!container) {
        container = document.createElement("div");
        container.id = containerId;
        container.className = "brackets-print-fallback print-brackets-sheet print-grid-6";
        document.body.appendChild(container);
      }
      container.innerHTML = pageHtml.join("");

      const cleanup = () => {
        document.body.classList.remove("is-printing-brackets");
        window.removeEventListener("afterprint", cleanup);
      };

      document.body.classList.add("is-printing-brackets");
      window.addEventListener("afterprint", cleanup);
      setStatus("Opening print dialog...");
      window.print();
      return;
    }
    setStatus("Opening print dialog...");
  }, [activeSessionId, setSnapshot, setStatus, snapshot?.brackets?.length]);

  const onPrintAliveList = useCallback(() => {
    if ((snapshot?.brackets?.length ?? 0) === 0) {
      setStatus("No brackets to print");
      return;
    }
    if (typeof window === "undefined") {
      setStatus("Printing is unavailable in this environment");
      return;
    }

    const alive = buildAliveListByKind(snapshot);
    const gameNumber = inferAliveListGameNumber(snapshot);
    const sectionHtml = (title, rows) => {
      const items =
        rows.length === 0
          ? `<li class="alive-empty">No entries</li>`
          : rows
              .map((row) => `<li>${row.bowlerName}${row.aliveCount > 0 ? ` (${row.aliveCount})` : ""}</li>`)
              .join("");
      return `<section class="alive-section"><h2>${title}</h2><ol>${items}</ol></section>`;
    };

    const aliveContentHtml = `
      <h1>Alive List - Game ${gameNumber}</h1>
      ${sectionHtml("Scratch", alive.scratch)}
      ${sectionHtml("Handicap", alive.handicap)}
    `;

    const printed = openAndPrintHtml({
      title: `Alive List - Game ${gameNumber}`,
      bodyHtml: aliveContentHtml,
      stylesHtml: `<style>
      @page { size: portrait; margin: 12mm; }
      body { font-family: Arial, sans-serif; color: #111; margin: 0; }
      h1 { margin: 0 0 10px; font-size: 22px; }
      h2 { margin: 14px 0 8px; font-size: 18px; }
      .alive-section { break-inside: avoid; page-break-inside: avoid; }
      ol { margin: 0; padding-left: 22px; }
      li { margin: 0 0 6px; font-size: 15px; line-height: 1.3; }
      .alive-empty { color: #666; }
    </style>`,
    });

    if (!printed) {
      const containerId = "alive-print-fallback";
      let container = document.getElementById(containerId);
      if (!container) {
        container = document.createElement("div");
        container.id = containerId;
        container.className = "alive-print-fallback";
        document.body.appendChild(container);
      }
      container.innerHTML = aliveContentHtml;

      const cleanup = () => {
        document.body.classList.remove("is-printing-alive-list");
        window.removeEventListener("afterprint", cleanup);
      };

      document.body.classList.add("is-printing-alive-list");
      window.addEventListener("afterprint", cleanup);
      setStatus("Opening print dialog...");
      window.print();
      return;
    }
    setStatus("Opening print dialog...");
  }, [setStatus, snapshot]);

  return {
    onGenerateBrackets,
    onPrintBrackets,
    onPrintAliveList,
  };
}
