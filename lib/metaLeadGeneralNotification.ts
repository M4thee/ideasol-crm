export type TeamsGeneralMetaLeadNotificationPayload = {
  campaignName: string;
  adName: string;
  campaignLeadCount: number | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function displayValue(value?: string | null) {
  const normalizedValue = value?.trim();
  return normalizedValue ? escapeHtml(normalizedValue) : "brak danych";
}

export function buildTeamsGeneralMetaLeadMessage(
  payload: TeamsGeneralMetaLeadNotificationPayload
) {
  const leadCount = Number.isFinite(payload.campaignLeadCount)
    ? String(payload.campaignLeadCount)
    : "brak danych";

  return [
    `Nowy Lead z kampanii <strong>${displayValue(payload.campaignName)}</strong> kreacja <strong>${displayValue(payload.adName)}</strong>.`,
    "",
    `Suma leadów z tej kampanii <strong>${leadCount}</strong>`,
  ].join("\n");
}
