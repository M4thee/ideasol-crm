type MicrosoftGraphTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type OutlookReminder = {
  minutesBeforeStart?: number;
};

type CreateOutlookCalendarEventInput = {
  userEmail: string;
  subject: string;
  body?: string;
  location?: string;
  startDateTime: string;
  endDateTime: string;
  timeZone?: string;
  reminder?: OutlookReminder;
};

type UpdateOutlookCalendarEventInput = {
  userEmail: string;
  microsoftEventId: string;
  subject?: string;
  body?: string;
  location?: string;
  startDateTime?: string;
  endDateTime?: string;
  timeZone?: string;
  reminder?: OutlookReminder;
};

type MicrosoftGraphEventResponse = {
  id?: string;
  webLink?: string;
  subject?: string;
};

function getMicrosoftGraphEnv() {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "Brakuje konfiguracji Microsoft Graph: MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID lub MICROSOFT_CLIENT_SECRET."
    );
  }

  return {
    tenantId,
    clientId,
    clientSecret,
  };
}

export async function getMicrosoftGraphAccessToken() {
  const { tenantId, clientId, clientSecret } = getMicrosoftGraphEnv();

  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    }
  );

  const tokenData = (await tokenResponse.json()) as MicrosoftGraphTokenResponse;

  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(
      tokenData.error_description ||
        tokenData.error ||
        "Nie udało się pobrać tokena Microsoft Graph."
    );
  }

  return tokenData.access_token;
}

export async function createOutlookCalendarEvent(input: CreateOutlookCalendarEventInput) {
  const accessToken = await getMicrosoftGraphAccessToken();
  const timeZone = input.timeZone || "Europe/Warsaw";
  const reminderMinutes = input.reminder?.minutesBeforeStart ?? 10;

  const eventPayload = {
    subject: input.subject,
    body: {
      contentType: "HTML",
      content: input.body || "",
    },
    start: {
      dateTime: input.startDateTime,
      timeZone,
    },
    end: {
      dateTime: input.endDateTime,
      timeZone,
    },
    location: {
      displayName: input.location || "",
    },
    isReminderOn: reminderMinutes > 0,
    reminderMinutesBeforeStart: reminderMinutes,
  };

  const graphResponse = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(input.userEmail)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventPayload),
    }
  );

  const graphData = (await graphResponse.json()) as MicrosoftGraphEventResponse & {
    error?: { message?: string; code?: string };
  };

  if (!graphResponse.ok) {
    throw new Error(
      graphData.error?.message ||
        graphData.error?.code ||
        "Nie udało się utworzyć wydarzenia w kalendarzu Outlook."
    );
  }

  return {
    microsoftEventId: graphData.id || "",
    microsoftEventUrl: graphData.webLink || "",
    subject: graphData.subject || input.subject,
  };
}

export async function updateOutlookCalendarEvent(input: UpdateOutlookCalendarEventInput) {
  const accessToken = await getMicrosoftGraphAccessToken();
  const timeZone = input.timeZone || "Europe/Warsaw";
  const reminderMinutes = input.reminder?.minutesBeforeStart ?? 10;

  const eventPayload: Record<string, unknown> = {};

  if (input.subject !== undefined) {
    eventPayload.subject = input.subject;
  }

  if (input.body !== undefined) {
    eventPayload.body = {
      contentType: "HTML",
      content: input.body || "",
    };
  }

  if (input.startDateTime !== undefined) {
    eventPayload.start = {
      dateTime: input.startDateTime,
      timeZone,
    };
  }

  if (input.endDateTime !== undefined) {
    eventPayload.end = {
      dateTime: input.endDateTime,
      timeZone,
    };
  }

  if (input.location !== undefined) {
    eventPayload.location = {
      displayName: input.location || "",
    };
  }

  eventPayload.isReminderOn = reminderMinutes > 0;
  eventPayload.reminderMinutesBeforeStart = reminderMinutes;

  const graphResponse = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(input.userEmail)}/events/${encodeURIComponent(input.microsoftEventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventPayload),
    }
  );

  if (graphResponse.status === 204) {
    return {
      microsoftEventId: input.microsoftEventId,
      microsoftEventUrl: "",
      subject: input.subject || "",
    };
  }

  const graphData = (await graphResponse.json()) as MicrosoftGraphEventResponse & {
    error?: { message?: string; code?: string };
  };

  if (!graphResponse.ok) {
    throw new Error(
      graphData.error?.message ||
        graphData.error?.code ||
        "Nie udało się zaktualizować wydarzenia w kalendarzu Outlook."
    );
  }

  return {
    microsoftEventId: graphData.id || input.microsoftEventId,
    microsoftEventUrl: graphData.webLink || "",
    subject: graphData.subject || input.subject || "",
  };
}

export async function graphApiRequest<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const accessToken = await getMicrosoftGraphAccessToken();

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Microsoft Graph error ${response.status}`);
  }

  return (await response.json()) as T;
}
