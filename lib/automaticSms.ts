import { IDEASOL_HOTLINE } from "@/lib/saleSms";

export const SMS_AUTOMATION_TRIGGERS = [
  "meeting_created",
  "before_meeting",
  "before_installation",
] as const;

export type SmsAutomationTrigger = (typeof SMS_AUTOMATION_TRIGGERS)[number];

export type SmsAutomation = {
  id: string;
  automation_key: string;
  message_type: string;
  title: string;
  trigger_type: SmsAutomationTrigger;
  message_template: string;
  offset_minutes: number;
  is_active: boolean;
  is_system: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export const SMS_AUTOMATION_VARIABLES = [
  { key: "client_name", label: "Klient", triggers: SMS_AUTOMATION_TRIGGERS },
  {
    key: "event_date",
    label: "Data spotkania",
    triggers: ["meeting_created", "before_meeting"],
  },
  {
    key: "event_time",
    label: "Godzina spotkania",
    triggers: ["meeting_created", "before_meeting"],
  },
  {
    key: "advisor_name",
    label: "Imię doradcy",
    triggers: ["meeting_created", "before_meeting"],
  },
  {
    key: "advisor_phone",
    label: "Telefon doradcy",
    triggers: ["meeting_created", "before_meeting"],
  },
  {
    key: "contract_number",
    label: "Numer umowy",
    triggers: ["before_installation"],
  },
  {
    key: "installation_date",
    label: "Data montażu",
    triggers: ["before_installation"],
  },
  {
    key: "installation_time",
    label: "Godzina montażu",
    triggers: ["before_installation"],
  },
  {
    key: "installer_company_name",
    label: "Firma instalatorska",
    triggers: ["before_installation"],
  },
  {
    key: "installer_contact_name",
    label: "Osoba kontaktowa instalatora",
    triggers: ["before_installation"],
  },
  {
    key: "installer_phone",
    label: "Telefon instalatora",
    triggers: ["before_installation"],
  },
  { key: "hotline", label: "Infolinia IdeaSol", triggers: SMS_AUTOMATION_TRIGGERS },
] as const;

const VARIABLE_KEYS = new Set<string>(
  SMS_AUTOMATION_VARIABLES.map((variable) => variable.key)
);

export function getSmsAutomationVariables(trigger: SmsAutomationTrigger) {
  return SMS_AUTOMATION_VARIABLES.filter((variable) =>
    (variable.triggers as readonly string[]).includes(trigger)
  );
}

export function getSmsAutomationPlaceholders(template: string) {
  return [...template.matchAll(/{{\s*([^{}]+?)\s*}}/g)].map((match) =>
    String(match[1] || "").trim().toLowerCase()
  );
}

export function getInvalidSmsAutomationPlaceholders(
  template: string,
  trigger: SmsAutomationTrigger
) {
  const allowed = new Set<string>(
    getSmsAutomationVariables(trigger).map((variable) => variable.key)
  );

  return [...new Set(getSmsAutomationPlaceholders(template))].filter(
    (key) => !VARIABLE_KEYS.has(key) || !allowed.has(key)
  );
}

export function renderSmsAutomationTemplate(
  template: string,
  values: Record<string, string | null | undefined>
) {
  return template.replace(/{{\s*([^{}]+?)\s*}}/g, (_match, rawKey: string) => {
    const key = String(rawKey || "").trim().toLowerCase();
    return String(values[key] || "").trim();
  });
}

export function formatSmsAutomationDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Nieprawidłowy termin automatycznej wiadomości SMS.");
  }

  return {
    date: date.toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Europe/Warsaw",
    }),
    time: date.toLocaleTimeString("pl-PL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Warsaw",
    }),
  };
}

export function getSmsAutomationWindow(offsetMinutes: number, now = Date.now()) {
  const target = now + offsetMinutes * 60_000;

  return {
    from: new Date(target - 30 * 60_000).toISOString(),
    to: new Date(target).toISOString(),
  };
}

export function getSmsAutomationTimingLabel(automation: {
  trigger_type: SmsAutomationTrigger;
  offset_minutes: number;
}) {
  if (automation.trigger_type === "meeting_created") return "Natychmiast po zapisaniu spotkania";

  const minutes = automation.offset_minutes;
  if (minutes % 1440 === 0) return `${minutes / 1440} dni przed terminem`;
  if (minutes % 60 === 0) return `${minutes / 60} godz. przed terminem`;
  return `${minutes} min przed terminem`;
}

export function getBaseSmsAutomationValues() {
  return { hotline: IDEASOL_HOTLINE };
}
