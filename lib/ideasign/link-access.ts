import type { IdeaSignStatus } from "./types";

export type IdeaSignLinkSignerStatus =
  | "oczekuje"
  | "otwarty"
  | "uwierzytelniony"
  | "podpisany";

const TERMINAL_SESSION_STATUSES = new Set<IdeaSignStatus>([
  "zawarta",
  "wygasła",
  "anulowana",
]);

function isFutureTimestamp(value: string, nowMs: number) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > nowMs;
}

export function canExchangeIdeaSignLink(params: {
  signerStatus: IdeaSignLinkSignerStatus;
  signerExpiresAt: string;
  sessionStatus: IdeaSignStatus;
  sessionExpiresAt: string;
  nowMs?: number;
}) {
  const nowMs = params.nowMs ?? Date.now();

  return (
    params.signerStatus !== "podpisany" &&
    !TERMINAL_SESSION_STATUSES.has(params.sessionStatus) &&
    isFutureTimestamp(params.signerExpiresAt, nowMs) &&
    isFutureTimestamp(params.sessionExpiresAt, nowMs)
  );
}
