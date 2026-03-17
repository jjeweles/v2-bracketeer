import { useMemo } from "react";
import { toMoney } from "../lib/format";

export function useDashboardViewModel(snapshot) {
  return useMemo(() => {
    const sessionSummary = snapshot
      ? {
          name: snapshot.session.name,
          entryFee: toMoney(snapshot.session.entry_fee_cents),
          handicap: `${snapshot.session.handicap_percent}% of ${snapshot.session.handicap_base}`,
          payoutFirst: toMoney(snapshot.session.payout_first_cents),
          payoutSecond: toMoney(snapshot.session.payout_second_cents),
          status: snapshot.session.is_completed ? "Completed" : "Open",
          completedAt: snapshot.session.completed_at,
        }
      : null;

    const refundTotals = snapshot?.refundTotals ?? [];
    const payouts = snapshot?.payoutTotals ?? [];
    const owedTotals = snapshot?.owedTotals ?? [];

    const paidRefundMap = new Set(snapshot?.paidRefundBowlerIds ?? []);
    const paidPayoutMap = new Set(snapshot?.paidPayoutBowlerIds ?? []);
    const paidOwedMap = new Set(snapshot?.paidOwedBowlerIds ?? []);

    const totalRefunds = refundTotals.reduce((acc, row) => acc + row.amountCents, 0);
    const totalPayouts = payouts.reduce((acc, row) => acc + row.amountCents, 0);

    const paidRefundsTotal = refundTotals.reduce((acc, row) => {
      return acc + (paidRefundMap.has(row.bowlerId) ? row.amountCents : 0);
    }, 0);
    const paidPayoutsTotal = payouts.reduce((acc, row) => {
      return acc + (paidPayoutMap.has(row.bowlerId) ? row.amountCents : 0);
    }, 0);

    const outstandingRefunds =
      snapshot?.completion?.refundsOutstandingCents ??
      Math.max(0, totalRefunds - paidRefundsTotal);
    const outstandingPayouts =
      snapshot?.completion?.payoutsOutstandingCents ??
      Math.max(0, totalPayouts - paidPayoutsTotal);
    const outstandingOwed = snapshot?.completion?.owedOutstandingCents ?? 0;

    const kpis = [
      { label: "Active Bowlers", value: String(snapshot?.bowlers?.length ?? 0) },
      {
        label: "Generated Brackets",
        value: String(snapshot?.brackets?.length ?? 0),
      },
      {
        label: "Refunds Outstanding",
        value:
          refundTotals.length === 0
            ? ""
            : outstandingRefunds === 0
              ? "All Refunded"
              : toMoney(outstandingRefunds),
      },
      {
        label: "Payouts Outstanding",
        value:
          payouts.length === 0
            ? ""
            : outstandingPayouts === 0
              ? "All Paid"
              : toMoney(outstandingPayouts),
      },
      {
        label: "Owed Outstanding",
        value:
          owedTotals.length === 0
            ? ""
            : outstandingOwed === 0
              ? "Settled"
              : toMoney(outstandingOwed),
      },
    ];

    const owedByBowler = new Map(
      owedTotals.map((row) => [row.bowlerId, row.netOwedCents]),
    );

    return {
      sessionSummary,
      refundTotals,
      payouts,
      owedTotals,
      paidRefundMap,
      paidPayoutMap,
      paidOwedMap,
      kpis,
      owedByBowler,
    };
  }, [snapshot]);
}
