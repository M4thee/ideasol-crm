"use client";

import { useEffect, useRef } from "react";

export const CRM_RESUME_EVENT = "ideasol:crm-resume";

export type CrmResumeReason =
  | "visibility"
  | "pageshow"
  | "focus"
  | "online";

type CrmResumeEventDetail = {
  reason: CrmResumeReason;
  resumedAt: string;
};

export function emitCrmResume(reason: CrmResumeReason) {
  window.dispatchEvent(
    new CustomEvent<CrmResumeEventDetail>(CRM_RESUME_EVENT, {
      detail: {
        reason,
        resumedAt: new Date().toISOString(),
      },
    })
  );
}

export function useCrmResumeRefresh(refresh: () => void | Promise<void>) {
  const refreshRef = useRef(refresh);
  const refreshInFlightRef = useRef(false);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    function handleCrmResume() {
      if (refreshInFlightRef.current) return;

      refreshInFlightRef.current = true;

      Promise.resolve(refreshRef.current())
        .catch((error) => {
          console.error("Nie udało się odświeżyć danych po wznowieniu CRM:", error);
        })
        .finally(() => {
          refreshInFlightRef.current = false;
        });
    }

    window.addEventListener(CRM_RESUME_EVENT, handleCrmResume);

    return () => {
      window.removeEventListener(CRM_RESUME_EVENT, handleCrmResume);
    };
  }, []);
}
