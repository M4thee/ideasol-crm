import {
  graphApiRequest,
  graphApiRequestWithAccessToken,
} from "@/lib/microsoftGraph";

export type TeamsCalendarNotificationPayload = {
  userEmail: string;
  message: string;
};

export type TeamsDelegatedCalendarNotificationPayload = TeamsCalendarNotificationPayload & {
  accessToken: string;
};

type GraphChannelMessage = {
  id: string;
};

type GraphChat = {
  id: string;
};

type GraphUser = {
  id: string;
  mail?: string | null;
  userPrincipalName?: string | null;
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

export async function sendTeamsDirectCalendarNotification(
  payload: TeamsCalendarNotificationPayload
) {
  const senderEmail = requireEnv("MICROSOFT_TEAMS_SENDER_EMAIL");
  const targetEmail = payload.userEmail.trim();

  if (!targetEmail) {
    throw new Error("Brakuje adresu e-mail odbiorcy Teams.");
  }

  const sender = await graphApiRequest<GraphUser>(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderEmail)}?$select=id,mail,userPrincipalName`
  );

  const recipient = await graphApiRequest<GraphUser>(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(targetEmail)}?$select=id,mail,userPrincipalName`
  );

  const chat = await graphApiRequest<GraphChat>(
    "https://graph.microsoft.com/v1.0/chats",
    {
      method: "POST",
      body: JSON.stringify({
        chatType: "oneOnOne",
        members: [
          {
            "@odata.type": "#microsoft.graph.aadUserConversationMember",
            roles: ["owner"],
            "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${sender.id}')`,
          },
          {
            "@odata.type": "#microsoft.graph.aadUserConversationMember",
            roles: ["owner"],
            "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${recipient.id}')`,
          },
        ],
      }),
    }
  );

  const message = await graphApiRequest<GraphChannelMessage>(
    `https://graph.microsoft.com/v1.0/chats/${encodeURIComponent(chat.id)}/messages`,
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
    chatId: chat.id,
    messageId: message.id,
  };
}

export async function sendTeamsDelegatedDirectCalendarNotification(
  payload: TeamsDelegatedCalendarNotificationPayload
) {
  const targetEmail = payload.userEmail.trim();

  if (!targetEmail) {
    throw new Error("Brakuje adresu e-mail odbiorcy Teams.");
  }

  const me = await graphApiRequestWithAccessToken<GraphUser>(
    "https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName",
    payload.accessToken
  );

  const recipient = await graphApiRequestWithAccessToken<GraphUser>(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(targetEmail)}?$select=id,mail,userPrincipalName`,
    payload.accessToken
  );


  if (me.id === recipient.id) {
    throw new Error(
      `Nie można wysłać prywatnej wiadomości Teams 1:1 do tego samego konta. Nadawca tokenu: ${me.mail || me.userPrincipalName || me.id}. Odbiorca: ${recipient.mail || recipient.userPrincipalName || recipient.id}. Wygeneruj MICROSOFT_DELEGATED_REFRESH_TOKEN na koncie technicznym, np. crm@ideasol.pl, albo przetestuj spotkanie przypisane do innego użytkownika.`
    );
  }

  const chat = await graphApiRequestWithAccessToken<GraphChat>(
    "https://graph.microsoft.com/v1.0/chats",
    payload.accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        chatType: "oneOnOne",
        members: [
          {
            "@odata.type": "#microsoft.graph.aadUserConversationMember",
            roles: ["owner"],
            "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${me.id}')`,
          },
          {
            "@odata.type": "#microsoft.graph.aadUserConversationMember",
            roles: ["owner"],
            "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${recipient.id}')`,
          },
        ],
      }),
    }
  );

  const message = await graphApiRequestWithAccessToken<GraphChannelMessage>(
    `https://graph.microsoft.com/v1.0/chats/${encodeURIComponent(chat.id)}/messages`,
    payload.accessToken,
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
    chatId: chat.id,
    messageId: message.id,
  };
}
