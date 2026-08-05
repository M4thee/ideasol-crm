export type MeetingConfirmationReminderValidationInput = {
  required: boolean;
  reminderAt: string;
  meetingAt?: string;
  kind?: "meeting" | "phone";
};

export type MeetingConfirmationReminderMessageInput = {
  advisorName: string;
  clientName: string;
  eventAt: string;
  eventUrl: string;
  kind?: "meeting" | "phone";
};

export type MeetingConfirmationReminderEligibilityInput = {
  eventType: "meeting" | "reminder" | "phone_call";
  eventAt: string;
  now?: Date;
  phoneGraceMinutes?: number;
};

export function isMeetingConfirmationReminderEligible({
  eventType,
  eventAt,
  now = new Date(),
  phoneGraceMinutes = 10,
}: MeetingConfirmationReminderEligibilityInput) {
  const eventTime = new Date(eventAt).getTime();

  if (!Number.isFinite(eventTime)) return false;

  if (eventType === "meeting") {
    return eventTime > now.getTime();
  }

  return eventTime >= now.getTime() - phoneGraceMinutes * 60 * 1000;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function validateMeetingConfirmationReminder({
  required,
  reminderAt,
  meetingAt,
  kind = "meeting",
}: MeetingConfirmationReminderValidationInput) {
  if (!required) return null;

  const isPhoneReminder = kind === "phone";

  if (!reminderAt) {
    return isPhoneReminder
      ? "Wybierz datę i godzinę przypomnienia o ponownym kontakcie telefonicznym."
      : "Wybierz datę i godzinę przypomnienia o potwierdzeniu spotkania.";
  }

  const reminderTime = new Date(reminderAt).getTime();

  if (!Number.isFinite(reminderTime) || reminderTime <= Date.now()) {
    return isPhoneReminder
      ? "Termin przypomnienia o kontakcie telefonicznym musi być w przyszłości."
      : "Termin przypomnienia o potwierdzeniu musi być w przyszłości.";
  }

  if (meetingAt) {
    const meetingTime = new Date(meetingAt).getTime();

    const isAfterAllowedTime = isPhoneReminder
      ? reminderTime > meetingTime
      : reminderTime >= meetingTime;

    if (Number.isFinite(meetingTime) && isAfterAllowedTime) {
      return isPhoneReminder
        ? "Przypomnienie nie może być ustawione po terminie ponownego kontaktu."
        : "Przypomnienie o potwierdzeniu musi być ustawione przed spotkaniem.";
    }
  }

  return null;
}

export function meetingConfirmationReminderToIso(required: boolean, reminderAt: string) {
  return required && reminderAt ? new Date(reminderAt).toISOString() : null;
}

export function buildMeetingConfirmationReminderMessage(
  payload: MeetingConfirmationReminderMessageInput
) {
  const eventDate = new Date(payload.eventAt);
  const isPhoneReminder = payload.kind === "phone";
  const advisorFirstName = payload.advisorName.trim().split(/\s+/)[0] || "Doradco";
  const date = new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(eventDate);
  const time = new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    hour: "2-digit",
    minute: "2-digit",
  }).format(eventDate);

  const clientName = escapeHtml(payload.clientName.trim() || "Klient");

  if (isPhoneReminder) {
    return [
      `Cześć <strong>${escapeHtml(advisorFirstName)}</strong>,`,
      "",
      `Masz zaplanowany ponowny kontakt telefoniczny z klientem <strong>${clientName}</strong> w dniu <strong>${date}</strong> o godz. <strong>${time}</strong>.`,
      "Skontaktuj się z klientem o zaplanowanej porze.",
      "",
      `<a href="${escapeHtml(payload.eventUrl)}">Otwórz kartę kontaktu</a>`,
    ].join("\n");
  }

  return [
    `Cześć <strong>${escapeHtml(advisorFirstName)}</strong>,`,
    "",
    `Twoje spotkanie z klientem <strong>${clientName}</strong> w dniu <strong>${date}</strong> o godz. <strong>${time}</strong> wymaga potwierdzenia.`,
    "Skontaktuj się z klientem, celem potwierdzenia.",
    "",
    `<a href="${escapeHtml(payload.eventUrl)}">Otwórz kartę spotkania</a>`,
  ].join("\n");
}
