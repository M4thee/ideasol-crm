export type MeetingConfirmationReminderValidationInput = {
  required: boolean;
  reminderAt: string;
  meetingAt?: string;
};

export type MeetingConfirmationReminderMessageInput = {
  advisorName: string;
  clientName: string;
  eventAt: string;
  eventUrl: string;
};

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
}: MeetingConfirmationReminderValidationInput) {
  if (!required) return null;

  if (!reminderAt) {
    return "Wybierz datę i godzinę przypomnienia o potwierdzeniu spotkania.";
  }

  const reminderTime = new Date(reminderAt).getTime();

  if (!Number.isFinite(reminderTime) || reminderTime <= Date.now()) {
    return "Termin przypomnienia o potwierdzeniu musi być w przyszłości.";
  }

  if (meetingAt) {
    const meetingTime = new Date(meetingAt).getTime();

    if (Number.isFinite(meetingTime) && reminderTime >= meetingTime) {
      return "Przypomnienie o potwierdzeniu musi być ustawione przed spotkaniem.";
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
  const meetingDate = new Date(payload.eventAt);
  const advisorFirstName = payload.advisorName.trim().split(/\s+/)[0] || "Doradco";
  const date = new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(meetingDate);
  const time = new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    hour: "2-digit",
    minute: "2-digit",
  }).format(meetingDate);

  return [
    `Cześć <strong>${escapeHtml(advisorFirstName)}</strong>,`,
    "",
    `Twoje spotkanie z klientem <strong>${escapeHtml(payload.clientName.trim() || "Klient")}</strong> w dniu <strong>${date}</strong> o godz. <strong>${time}</strong> wymaga potwierdzenia.`,
    "Skontaktuj się z klientem, celem potwierdzenia.",
    "",
    `<a href="${escapeHtml(payload.eventUrl)}">Otwórz kartę spotkania</a>`,
  ].join("\n");
}
