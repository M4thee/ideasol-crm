import { NextRequest, NextResponse } from "next/server";
import {
  createOutlookCalendarEvent,
  refreshMicrosoftDelegatedAccessToken,
  updateOutlookCalendarEvent,
} from "@/lib/microsoftGraph";
import {
  sendTeamsDelegatedDirectCalendarNotification,
  sendTeamsDirectCalendarNotification,
} from "@/lib/microsoftTeams";

type CreateOutlookEventPayload = {
  userEmail?: string;
  assignedUserEmail?: string;
  subject?: string;
  body?: string;
  meetingNote?: string;
  clientName?: string;
  clientPhone?: string;
  clientAddress?: string;
  crmUrl?: string;
  location?: string;
  startDateTime?: string;
  endDateTime?: string;
  timeZone?: string;
  reminderMinutesBeforeStart?: number;
  notificationType?: "meeting_reassigned";
  previousUserEmail?: string;
};

type UpdateOutlookEventPayload = CreateOutlookEventPayload & {
  microsoftEventId?: string;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMultilineText(value: string) {
  return escapeHtml(value.trim()).replaceAll("\n", "<br />");
}

function buildOutlookBody(payload: CreateOutlookEventPayload) {
  const rows = [
    payload.clientName
      ? `<p style="margin:0 0 10px 0;"><strong>👤 Klient:</strong> ${escapeHtml(payload.clientName)}</p>`
      : null,
    payload.clientPhone
      ? `<p style="margin:0 0 10px 0;"><strong>📞 Telefon:</strong> ${escapeHtml(payload.clientPhone)}</p>`
      : null,
    payload.clientAddress
      ? `<p style="margin:0 0 10px 0;"><strong>📍 Adres:</strong> ${escapeHtml(payload.clientAddress)}</p>`
      : null,
    payload.meetingNote?.trim()
      ? `<div style="margin:16px 0 0 0;"><p style="margin:0 0 6px 0;"><strong>📝 Notatka:</strong></p><div style="padding:10px 12px;border-left:3px solid #94a3b8;background:#f8fafc;line-height:1.5;">${formatMultilineText(payload.meetingNote)}</div></div>`
      : null,
    payload.crmUrl
      ? `<p style="margin:16px 0 0 0;"><strong>🔗 CRM:</strong><br /><a href="${escapeHtml(payload.crmUrl)}">${escapeHtml(payload.crmUrl)}</a></p>`
      : null,
    payload.body?.trim()
      ? `<div style="margin:16px 0 0 0;line-height:1.5;">${formatMultilineText(payload.body)}</div>`
      : null,
  ].filter(Boolean);

  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.45;color:#1f2937;">${rows.join("")}</div>`;
}

function buildTeamsMessage(payload: CreateOutlookEventPayload) {
  const meetingDate = payload.startDateTime
    ? new Date(payload.startDateTime).toLocaleString("pl-PL", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Brak terminu";

  return [
    "📅 Nowe spotkanie CRM",
    "",
    payload.subject?.trim() ? `Temat: ${payload.subject.trim()}` : null,
    `Termin: ${meetingDate}`,
    payload.clientName ? `Klient: ${payload.clientName}` : null,
    payload.clientPhone ? `Telefon: ${payload.clientPhone}` : null,
    payload.clientAddress ? `Adres: ${payload.clientAddress}` : null,
    payload.meetingNote?.trim() ? "" : null,
    payload.meetingNote?.trim() ? `Notatka:\n${payload.meetingNote.trim()}` : null,
    payload.crmUrl ? "" : null,
    payload.crmUrl ? `Otwórz w CRM:\n${payload.crmUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildRemovedMeetingTeamsMessage(payload: CreateOutlookEventPayload) {
  const meetingDate = payload.startDateTime
    ? new Date(payload.startDateTime).toLocaleString("pl-PL", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "brak terminu";

  const clientName = payload.clientName?.trim() || "klientem";

  return `Twoje spotkanie z klientem ${clientName} w dniu ${meetingDate} zostało przypisane do innego doradcy.`;
}

async function sendTeamsRawNotification(targetUserEmail: string, message: string) {
  const delegatedRefreshToken = process.env.MICROSOFT_DELEGATED_REFRESH_TOKEN?.trim();

  if (delegatedRefreshToken) {
    const delegatedToken = await refreshMicrosoftDelegatedAccessToken(delegatedRefreshToken);

    if (!delegatedToken.refresh_token) {
      console.warn(
        "Microsoft delegated token refreshed without a new refresh_token. Existing MICROSOFT_DELEGATED_REFRESH_TOKEN remains in use."
      );
    }

    return sendTeamsDelegatedDirectCalendarNotification({
      userEmail: targetUserEmail,
      message,
      accessToken: delegatedToken.access_token || "",
    });
  }

  return sendTeamsDirectCalendarNotification({
    userEmail: targetUserEmail,
    message,
  });
}

async function trySendTeamsRawNotification(targetUserEmail: string, message: string) {
  try {
    const result = await sendTeamsRawNotification(targetUserEmail, message);

    return {
      ok: true,
      result,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Nieznany błąd wysyłki Teams.";

    console.error("Teams notification error:", error);

    return {
      ok: false,
      error: errorMessage,
    };
  }
}

async function sendTeamsNotification(payload: CreateOutlookEventPayload, targetUserEmail: string) {
  return sendTeamsRawNotification(targetUserEmail, buildTeamsMessage(payload));
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as CreateOutlookEventPayload;
    const targetUserEmail = (payload.assignedUserEmail || payload.userEmail || "").trim();

    if (payload.notificationType === "meeting_reassigned") {
      if (!targetUserEmail) {
        return badRequest("Brakuje adresu e-mail nowego doradcy dla powiadomienia Teams.");
      }

      const newAdvisorTeamsNotification = await trySendTeamsRawNotification(
        targetUserEmail,
        buildTeamsMessage(payload)
      );

      const previousUserEmail = payload.previousUserEmail?.trim() || "";
      const previousAdvisorTeamsNotification =
        previousUserEmail && previousUserEmail !== targetUserEmail
          ? await trySendTeamsRawNotification(
              previousUserEmail,
              buildRemovedMeetingTeamsMessage(payload)
            )
          : {
              ok: false,
              error: "Previous advisor notification not attempted.",
            };

      return NextResponse.json({
        ok: true,
        notificationType: payload.notificationType,
        targetUserEmail,
        previousUserEmail: previousUserEmail || null,
        teamsNotification: newAdvisorTeamsNotification,
        previousAdvisorTeamsNotification,
      });
    }

    if (!targetUserEmail) {
      return badRequest("Brakuje adresu e-mail przypisanego użytkownika Outlook.");
    }

    if (!payload.subject?.trim()) {
      return badRequest("Brakuje tytułu wydarzenia Outlook.");
    }

    if (!payload.startDateTime?.trim()) {
      return badRequest("Brakuje daty rozpoczęcia wydarzenia Outlook.");
    }

    if (!payload.endDateTime?.trim()) {
      return badRequest("Brakuje daty zakończenia wydarzenia Outlook.");
    }

    const createdEvent = await createOutlookCalendarEvent({
      userEmail: targetUserEmail,
      subject: payload.subject.trim(),
      body: buildOutlookBody(payload),
      location: payload.location || "",
      startDateTime: payload.startDateTime,
      endDateTime: payload.endDateTime,
      timeZone: payload.timeZone || "Europe/Warsaw",
      reminder: {
        minutesBeforeStart: payload.reminderMinutesBeforeStart ?? 10,
      },
    });

    let teamsNotification:
      | { ok: true; result: unknown }
      | { ok: false; error: string } = {
      ok: false,
      error: "Teams notification not attempted.",
    };

    try {
      const teamsResult = await sendTeamsNotification(payload, targetUserEmail);

      teamsNotification = {
        ok: true,
        result: teamsResult,
      };
    } catch (teamsError) {
      const teamsErrorMessage =
        teamsError instanceof Error
          ? teamsError.message
          : "Nieznany błąd wysyłki Teams.";

      teamsNotification = {
        ok: false,
        error: teamsErrorMessage,
      };

      console.error("Teams notification error:", teamsError);
    }

    return NextResponse.json({
      ok: true,
      targetUserEmail,
      teamsNotification,
      ...createdEvent,
    });
  } catch (error) {
    console.error("Błąd tworzenia wydarzenia Outlook:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się utworzyć wydarzenia Outlook.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = (await request.json()) as UpdateOutlookEventPayload;
    const targetUserEmail = (payload.assignedUserEmail || payload.userEmail || "").trim();

    if (!targetUserEmail) {
      return badRequest("Brakuje adresu e-mail przypisanego użytkownika Outlook.");
    }

    if (!payload.microsoftEventId?.trim()) {
      return badRequest("Brakuje identyfikatora wydarzenia Outlook.");
    }

    const updatedEvent = await updateOutlookCalendarEvent({
      userEmail: targetUserEmail,
      microsoftEventId: payload.microsoftEventId.trim(),
      subject: payload.subject?.trim(),
      body: buildOutlookBody(payload),
      location: payload.location || "",
      startDateTime: payload.startDateTime,
      endDateTime: payload.endDateTime,
      timeZone: payload.timeZone || "Europe/Warsaw",
      reminder: {
        minutesBeforeStart: payload.reminderMinutesBeforeStart ?? 10,
      },
    });

    return NextResponse.json({
      ok: true,
      targetUserEmail,
      ...updatedEvent,
    });
  } catch (error) {
    console.error("Błąd aktualizacji wydarzenia Outlook:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się zaktualizować wydarzenia Outlook.",
      },
      { status: 500 }
    );
  }
}