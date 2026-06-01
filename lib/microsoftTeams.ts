import { graphApiRequest } from "@/lib/microsoftGraph";

export type TeamsCalendarNotificationPayload = {
  userEmail: string;
  message: string;
};

type GraphChannelMessage = {
  id: string;
};

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Brakuje zmiennej środowiskowej: ${name}`);
  }

  return value;
}

export async function sendTeamsCalendarNotification(
  payload: TeamsCalendarNotificationPayload
) {
  const teamId = requireEnv("MICROSOFT_TEAMS_TEAM_ID");
  const channelId = requireEnv("MICROSOFT_TEAMS_CHANNEL_ID");

  const message = await graphApiRequest<GraphChannelMessage>(
    `https://graph.microsoft.com/v1.0/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        body: {
          contentType: "html",
          content: payload.message.replaceAll("\n", "<br />"),
        },
      }),
    }
  );

  return {
    success: true,
    messageId: message.id,
  };
}
