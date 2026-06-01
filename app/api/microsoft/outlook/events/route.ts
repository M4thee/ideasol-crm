import { NextRequest, NextResponse } from "next/server";
import { createOutlookCalendarEvent, updateOutlookCalendarEvent } from "@/lib/microsoftGraph";

type CreateOutlookEventPayload = {
  userEmail?: string;
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
};

type UpdateOutlookEventPayload = CreateOutlookEventPayload & {
  microsoftEventId?: string;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function buildOutlookBody(payload: CreateOutlookEventPayload) {
  const sections = [
    payload.clientName ? `👤 Klient: ${payload.clientName}` : null,
    payload.clientPhone ? `📞 Telefon: ${payload.clientPhone}` : null,
    payload.clientAddress ? `📍 Adres: ${payload.clientAddress}` : null,
    payload.meetingNote?.trim() ? `📝 Notatka: ${payload.meetingNote.trim()}` : null,
    payload.crmUrl ? `🔗 CRM: ${payload.crmUrl}` : null,
    payload.body?.trim(),
  ].filter(Boolean);

  return sections.join("\n\n");
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as CreateOutlookEventPayload;

    if (!payload.userEmail?.trim()) {
      return badRequest("Brakuje adresu e-mail użytkownika Outlook.");
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
      userEmail: payload.userEmail.trim(),
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

    return NextResponse.json({
      ok: true,
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

    if (!payload.userEmail?.trim()) {
      return badRequest("Brakuje adresu e-mail użytkownika Outlook.");
    }

    if (!payload.microsoftEventId?.trim()) {
      return badRequest("Brakuje identyfikatora wydarzenia Outlook.");
    }

    const updatedEvent = await updateOutlookCalendarEvent({
      userEmail: payload.userEmail.trim(),
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