import type { BusinessArea } from "./businessAreas";

export function getMetaLeadBoardChatId(
  businessArea: BusinessArea,
  env: Record<string, string | undefined> = process.env
) {
  const key = businessArea === "ideatermo"
    ? "MICROSOFT_TEAMS_IDEATERMO_BOARD_CHAT_ID"
    : "MICROSOFT_TEAMS_BOARD_CHAT_ID";
  const chatId = env[key]?.trim();
  if (!chatId) throw new Error(`Brak zmiennej środowiskowej ${key}.`);
  return chatId;
}
