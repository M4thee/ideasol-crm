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

export type TeamsMetaLeadNotificationPayload = {
  assignedUserName: string;
  clientName: string;
  clientPhone: string;
  crmUrl?: string | null;
  isFallbackAssignment?: boolean;
  answers: {
    singleFamilyHouse?: string | null;
    yearlyElectricityBills?: string | null;
    hasPhotovoltaics?: string | null;
    postalCode?: string | null;
    preferredContactTime?: string | null;
  };
};

export type TeamsEnergyStorageLeadNotificationPayload = {
  advisorName?: string | null;
  clientName: string;
  clientPhone: string;
  postalCode: string;
  crmUrl?: string | null;
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

export function buildTeamsMetaLeadMessage(payload: TeamsMetaLeadNotificationPayload) {
  const title = payload.isFallbackAssignment
    ? "⚠️ Nowy lead MetaADS wymaga ręcznej weryfikacji lokalizacji"
    : "🔥 Przypisano nowy lead MetaADS";

  const lines = [
    `<strong>${title}</strong>`,
    "",
    `Przypisany użytkownik: <strong>${escapeHtml(payload.assignedUserName)}</strong>`,
    `Klient: <strong>${displayValue(payload.clientName)}</strong>`,
    `Telefon: <strong>${displayValue(payload.clientPhone)}</strong>`,
    "",
    `1. Czy mieszkasz w domu jednorodzinnym? ${displayValue(payload.answers.singleFamilyHouse)}`,
    `2. Ile wynoszą Twoje rachunki? ${displayValue(payload.answers.yearlyElectricityBills)}`,
    `3. Czy masz fotowoltaikę? ${displayValue(payload.answers.hasPhotovoltaics)}`,
    `4. Kod pocztowy inwestycji: ${displayValue(payload.answers.postalCode)}`,
  ];

  if (payload.answers.preferredContactTime) {
    lines.push(
      `5. Preferowana pora kontaktu: ${displayValue(payload.answers.preferredContactTime)}`
    );
  }

  if (payload.crmUrl) {
    lines.push("", `<a href="${escapeHtml(payload.crmUrl)}">Otwórz klienta w CRM</a>`);
  }

  return lines.join("\n");
}

export function buildTeamsEnergyStorageLeadDirectMessage(
  payload: TeamsEnergyStorageLeadNotificationPayload
) {
  const lines = [
    "<strong>🔥 Przypisano Ci nowego leada do obsługi</strong>",
    "",
    "Kampania: <strong>Kalkulator Magazynu Energii</strong>",
    `Klient: <strong>${displayValue(payload.clientName)}</strong>`,
    `Kod pocztowy: <strong>${displayValue(payload.postalCode)}</strong>`,
    `Telefon: <strong>${displayValue(payload.clientPhone)}</strong>`,
  ];

  if (payload.crmUrl) {
    lines.push("", `<a href="${escapeHtml(payload.crmUrl)}">Otwórz klienta w CRM</a>`);
  }

  return lines.join("\n");
}

export function buildTeamsEnergyStorageLeadChannelMessage(
  payload: TeamsEnergyStorageLeadNotificationPayload
) {
  const lines = [
    "<strong>📥 Nowy lead CRM</strong>",
    "",
    "Źródło: <strong>Kalkulator Magazynu Energii</strong>",
    `Klient: <strong>${displayValue(payload.clientName)}</strong>`,
    `Kod pocztowy: <strong>${displayValue(payload.postalCode)}</strong>`,
    `Telefon: <strong>${displayValue(payload.clientPhone)}</strong>`,
    `Przypisano do: <strong>${displayValue(payload.advisorName)}</strong>`,
  ];

  if (payload.crmUrl) {
    lines.push("", `<a href="${escapeHtml(payload.crmUrl)}">Otwórz klienta w CRM</a>`);
  }

  return lines.join("\n");
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

export async function sendTeamsLeadChannelNotification(
  payload: TeamsCalendarNotificationPayload
) {
  const teamId = process.env.MICROSOFT_TEAMS_LEADS_TEAM_ID || requireEnv("MICROSOFT_TEAMS_TEAM_ID");
  const channelId = process.env.MICROSOFT_TEAMS_LEADS_CHANNEL_ID || requireEnv("MICROSOFT_TEAMS_CHANNEL_ID");

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

export async function sendTeamsDirectMetaLeadNotification(payload: TeamsCalendarNotificationPayload) {
  return sendTeamsDirectCalendarNotification(payload);
}

export async function sendTeamsDirectEnergyStorageLeadNotification(payload: TeamsCalendarNotificationPayload) {
  return sendTeamsDirectCalendarNotification(payload);
}
