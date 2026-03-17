import { useCallback } from "react";
import { api } from "../lib/api-client";

export function usePaymentActions({ activeSessionId, sessionCompleted, snapshot, setSnapshot, setStatus }) {
  const toggleRefundPaid = useCallback(
    async (bowlerId) => {
      if (!activeSessionId) return;
      if (sessionCompleted) {
        setStatus("Session is completed and read-only");
        return;
      }
      const isPaid = (snapshot?.paidRefundBowlerIds ?? []).includes(bowlerId);
      try {
        const nextSnapshot = await api(`/api/sessions/${activeSessionId}/refunds/${bowlerId}/paid`, {
          method: "PATCH",
          body: JSON.stringify({ paid: !isPaid }),
        });
        setSnapshot(nextSnapshot);
      } catch (err) {
        setStatus(err.message);
      }
    },
    [activeSessionId, sessionCompleted, setSnapshot, setStatus, snapshot?.paidRefundBowlerIds],
  );

  const togglePayoutPaid = useCallback(
    async (bowlerId) => {
      if (!activeSessionId) return;
      if (sessionCompleted) {
        setStatus("Session is completed and read-only");
        return;
      }
      const isPaid = (snapshot?.paidPayoutBowlerIds ?? []).includes(bowlerId);
      try {
        const nextSnapshot = await api(`/api/sessions/${activeSessionId}/payouts/${bowlerId}/paid`, {
          method: "PATCH",
          body: JSON.stringify({ paid: !isPaid }),
        });
        setSnapshot(nextSnapshot);
      } catch (err) {
        setStatus(err.message);
      }
    },
    [activeSessionId, sessionCompleted, setSnapshot, setStatus, snapshot?.paidPayoutBowlerIds],
  );

  const toggleOwedPaid = useCallback(
    async (bowlerId) => {
      if (!activeSessionId) return;
      if (sessionCompleted) {
        setStatus("Session is completed and read-only");
        return;
      }
      const isPaid = (snapshot?.paidOwedBowlerIds ?? []).includes(bowlerId);
      try {
        const nextSnapshot = await api(`/api/sessions/${activeSessionId}/owes/${bowlerId}/paid`, {
          method: "PATCH",
          body: JSON.stringify({ paid: !isPaid }),
        });
        setSnapshot(nextSnapshot);
      } catch (err) {
        setStatus(err.message);
      }
    },
    [activeSessionId, sessionCompleted, setSnapshot, setStatus, snapshot?.paidOwedBowlerIds],
  );

  return {
    toggleRefundPaid,
    togglePayoutPaid,
    toggleOwedPaid,
  };
}
