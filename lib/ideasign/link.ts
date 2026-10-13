import type { IdeaSignStatus } from "./types";

export type IdeaSignSignerStatus =
  | "oczekuje"
  | "otwarty"
  | "uwierzytelniony"
  | "podpisany";

const TERMINAL_SESSION_STATUSES = new Set<IdeaSignStatus>([
  "zawarta",
  "wygasła",
  "anulowana",
]);

function futureTimestamp(value: string, now: number) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > now;
}

export function canExchangeIdeaSignLink(params: {
  signerStatus: IdeaSignSignerStatus;
  signerLinkExpiresAt: string;
  sessionStatus: IdeaSignStatus;
  sessionExpiresAt: string;
  now?: number;
}) {
  const now = params.now ?? Date.now();

  return (
    params.signerStatus !== "podpisany" &&
    !TERMINAL_SESSION_STATUSES.has(params.sessionStatus) &&
    futureTimestamp(params.signerLinkExpiresAt, now) &&
    futureTimestamp(params.sessionExpiresAt, now)
  );
}

export function signerStatusAfterOpening(status: IdeaSignSignerStatus) {
  return status === "oczekuje" ? "otwarty" : status;
}

export function getIdeaSignAccessExpiresAt(params: {
  signerLinkExpiresAt: string;
  sessionExpiresAt: string;
  accessTtlSeconds: number;
  now?: number;
}) {
  const now = params.now ?? Date.now();
  const expiresAt = Math.min(
    now + params.accessTtlSeconds * 1000,
    new Date(params.signerLinkExpiresAt).getTime(),
    new Date(params.sessionExpiresAt).getTime()
  );

  return new Date(expiresAt).toISOString();
}
