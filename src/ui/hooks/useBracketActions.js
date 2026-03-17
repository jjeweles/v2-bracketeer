import { useCallback } from "react";
import { api } from "../lib/api-client";
import { buildAliveListByKind } from "../lib/bracket-format";
import { getDocumentStylesHtml, openAndPrintHtml } from "../lib/print-utils";

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
    const bracketPage = document.querySelector(".page.is-active");
    const content = bracketPage ? bracketPage.outerHTML : document.body.innerHTML;
    const printed = openAndPrintHtml({
      title: "Bracket Print",
      stylesHtml: styles,
      bodyHtml: `<main class="print-brackets-sheet">${content}</main>`,
      windowFeatures: "noopener,noreferrer",
    });

    if (!printed) {
      if (typeof window.print === "function") {
        setStatus("Opening print dialog...");
        window.print();
        return;
      }
      setStatus("Unable to open print dialog");
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
      <h1>Alive List</h1>
      ${sectionHtml("Scratch", alive.scratch)}
      ${sectionHtml("Handicap", alive.handicap)}
    `;

    const printed = openAndPrintHtml({
      title: "Alive List",
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
