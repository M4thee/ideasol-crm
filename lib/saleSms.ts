export const IDEASOL_BANK_ACCOUNT = "33 1140 2004 0000 3302 8689 3030";
export const IDEASOL_HOTLINE = "41 202 02 38";

export const SMS_TEMPLATE_TONES = ["standard", "warning", "danger"] as const;
export const SMS_TEMPLATE_CATEGORIES = [
  "sale",
  "marketing",
  "relationship",
] as const;

export type SmsTemplateTone = (typeof SMS_TEMPLATE_TONES)[number];
export type SmsTemplateCategory = (typeof SMS_TEMPLATE_CATEGORIES)[number];
export type SaleSmsTemplateType = string;

export const SMS_TEMPLATE_REQUIRED_FIELDS = [
  { key: "client_name", label: "Imię/nazwa klienta" },
  { key: "contract_number", label: "Numer umowy" },
  { key: "contract_value", label: "Dodatnia wartość umowy" },
  { key: "deposit_amount", label: "Dodatnia kwota zaliczki" },
  { key: "outstanding_amount", label: "Dodatnie saldo do zapłaty" },
  { key: "installation_date", label: "Data montażu" },
  { key: "installation_time", label: "Godzina montażu" },
  { key: "installer_company_name", label: "Wybrany instalator" },
] as const;

export type SmsTemplateRequiredField =
  (typeof SMS_TEMPLATE_REQUIRED_FIELDS)[number]["key"];

export const SYSTEM_SMS_TEMPLATE_REQUIRED_FIELDS: Record<
  string,
  SmsTemplateRequiredField[]
> = {
  deposit_reminder: ["contract_number", "deposit_amount"],
  payment_reminder_1: ["contract_number", "outstanding_amount"],
  payment_reminder_2: ["contract_number", "outstanding_amount"],
  payment_demand: ["outstanding_amount"],
  installation_confirmation: [
    "installation_date",
    "installation_time",
    "installer_company_name",
  ],
};

export const SMS_TEMPLATE_VARIABLES = [
  { key: "client_name", label: "Klient", example: "Jan Kowalski" },
  { key: "contract_number", label: "Numer umowy", example: "IS/01/2026" },
  { key: "contract_value", label: "Wartość umowy", example: "50 000,00" },
  { key: "deposit_amount", label: "Kwota zaliczki", example: "10 000,00" },
  { key: "paid_total", label: "Suma wpłat", example: "20 000,00" },
  { key: "outstanding_amount", label: "Pozostało do zapłaty", example: "30 000,00" },
  { key: "installation_date", label: "Data montażu", example: "12.08.2026" },
  { key: "installation_time", label: "Godzina montażu", example: "08:30" },
  { key: "installer_company_name", label: "Nazwa instalatora", example: "Montaże PV" },
  { key: "installer_contact_name", label: "Kontakt u instalatora", example: "Jan Nowak" },
  { key: "installer_phone", label: "Telefon instalatora", example: "500 600 700" },
  { key: "bank_account", label: "Rachunek IdeaSol", example: IDEASOL_BANK_ACCOUNT },
  { key: "hotline", label: "Infolinia IdeaSol", example: IDEASOL_HOTLINE },
] as const;

export type SmsTemplateVariableKey =
  (typeof SMS_TEMPLATE_VARIABLES)[number]["key"];

export type SmsTemplateDefinition = {
  id?: string;
  type: string;
  title: string;
  messageTemplate: string;
  tone: SmsTemplateTone;
  category?: SmsTemplateCategory;
  requiredFields: SmsTemplateRequiredField[];
  isActive?: boolean;
  isSystem?: boolean;
  sortOrder?: number;
};

export type SaleSmsTemplate = {
  id?: string;
  type: string;
  title: string;
  message: string;
  enabled: boolean;
  reason: string | null;
  tone: SmsTemplateTone;
  category: SmsTemplateCategory;
  isSystem?: boolean;
};

export type SaleSmsTemplateContext = {
  clientName?: string | null;
  contractNumber: string;
  contractValue?: number | null;
  depositAmount: number | null;
  paidTotal?: number | null;
  outstandingAmount: number | null;
  installationDate: string | null;
  installationTime: string | null;
  installerCompanyName: string | null;
  installerContactName?: string | null;
  installerPhone?: string | null;
};

export type InstallationReminderContext = {
  contractNumber: string;
  installerCompanyName: string;
  installerContactName: string | null;
  installerPhone: string | null;
};

export const DEFAULT_SALE_SMS_TEMPLATE_DEFINITIONS: SmsTemplateDefinition[] = [
  {
    type: "deposit_reminder",
    title: "Przypomnienie o wpłacie zaliczki",
    tone: "standard",
    category: "sale",
    requiredFields: ["contract_number", "deposit_amount"],
    sortOrder: 10,
    isSystem: true,
    messageTemplate:
      "Dzień dobry. Przypominamy o konieczności wpłaty zaliczki w kwocie {{deposit_amount}} PLN, na rachunek bankowy numer {{bank_account}}. Tytułem: {{contract_number}}. Jeżeli dokonali Państwo wpłaty, prosimy o potraktowanie tej wiadomości jako nieaktualnej. Z pozdrowieniami, Zespół IdeaSol.",
  },
  {
    type: "payment_reminder_1",
    title: "Przypomnienie o płatności – I",
    tone: "warning",
    category: "sale",
    requiredFields: ["contract_number", "outstanding_amount"],
    sortOrder: 20,
    isSystem: true,
    messageTemplate:
      "Dzień dobry. Informujemy, że do tej pory nie zaksięgowaliśmy wpłaty do umowy numer {{contract_number}} w kwocie {{outstanding_amount}} PLN. Numer konta do wpłaty: {{bank_account}}. W tytule proszę podać numer umowy. Jeżeli dokonali Państwo wpłaty, prosimy o potraktowanie tej wiadomości jako nieaktualnej. Z pozdrowieniami, Zespół IdeaSol.",
  },
  {
    type: "payment_reminder_2",
    title: "Przypomnienie o płatności – II",
    tone: "warning",
    category: "sale",
    requiredFields: ["contract_number", "outstanding_amount"],
    sortOrder: 30,
    isSystem: true,
    messageTemplate:
      "Szanowny Kliencie. Informujemy, że nadal nie otrzymaliśmy wpłaty do umowy {{contract_number}}. Kwota do zapłaty wynosi {{outstanding_amount}} PLN. Prosimy o pilne dokonanie wpłaty na rachunek {{bank_account}}. W tytule prosimy podać numer umowy. Z pozdrowieniami, Zespół IdeaSol.",
  },
  {
    type: "payment_demand",
    title: "Wezwanie do zapłaty",
    tone: "danger",
    category: "sale",
    requiredFields: ["outstanding_amount"],
    sortOrder: 40,
    isSystem: true,
    messageTemplate:
      "Dzień dobry. Ponieważ wciąż nie otrzymaliśmy wpłaty za wykonane usługi, postanowiliśmy przekazać Państwa dane do zewnętrznej firmy windykacyjnej wraz z dokonaniem wpisu do Krajowego Rejestru Długów. Tylko wpłata w ciągu 48 h pozwoli nam uniknąć tego etapu. Wezwanie do zapłaty zostało przesłane na adres e-mail. Pozdrawiamy, Zespół IdeaSol.",
  },
  {
    type: "installation_confirmation",
    title: "Potwierdzenie daty montażu",
    tone: "standard",
    category: "sale",
    requiredFields: [
      "installation_date",
      "installation_time",
      "installer_company_name",
    ],
    sortOrder: 50,
    isSystem: true,
    messageTemplate:
      "Dzień dobry. Potwierdzamy montaż w dniu {{installation_date}} około godziny {{installation_time}}. Firma realizująca montaż na zlecenie IdeaSol Sp. z o.o.: {{installer_company_name}}. Infolinia IdeaSol: {{hotline}}.",
  },
];

const VARIABLE_KEYS = new Set<string>(
  SMS_TEMPLATE_VARIABLES.map((variable) => variable.key)
);

const VARIABLE_REQUIREMENTS: Partial<
  Record<SmsTemplateVariableKey, SmsTemplateRequiredField>
> = {
  client_name: "client_name",
  contract_number: "contract_number",
  contract_value: "contract_value",
  deposit_amount: "deposit_amount",
  outstanding_amount: "outstanding_amount",
  installation_date: "installation_date",
  installation_time: "installation_time",
  installer_company_name: "installer_company_name",
};

export function formatSmsAmount(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";

  return value.toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatSmsInstallationDate(value: string | null | undefined) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : "";
}

export function getSmsTemplatePlaceholders(messageTemplate: string) {
  return [...messageTemplate.matchAll(/{{\s*([^{}]+?)\s*}}/g)].map((match) =>
    String(match[1] || "").trim().toLowerCase()
  );
}

export function getUnknownSmsTemplatePlaceholders(messageTemplate: string) {
  return [...new Set(getSmsTemplatePlaceholders(messageTemplate))].filter(
    (key) => !VARIABLE_KEYS.has(key)
  );
}

function getTemplateValues(context: SaleSmsTemplateContext) {
  return {
    client_name: String(context.clientName || "").trim(),
    contract_number: String(context.contractNumber || "").trim(),
    contract_value: formatSmsAmount(context.contractValue),
    deposit_amount: formatSmsAmount(context.depositAmount),
    paid_total: formatSmsAmount(context.paidTotal ?? 0),
    outstanding_amount: formatSmsAmount(context.outstandingAmount),
    installation_date: formatSmsInstallationDate(context.installationDate),
    installation_time: String(context.installationTime || "").slice(0, 5),
    installer_company_name: String(context.installerCompanyName || "").trim(),
    installer_contact_name: String(context.installerContactName || "").trim(),
    installer_phone: String(context.installerPhone || "").trim(),
    bank_account: IDEASOL_BANK_ACCOUNT,
    hotline: IDEASOL_HOTLINE,
  } satisfies Record<SmsTemplateVariableKey, string>;
}

function getRequirementReason(
  field: SmsTemplateRequiredField,
  context: SaleSmsTemplateContext
) {
  if (field === "client_name" && !String(context.clientName || "").trim()) {
    return "Brak imienia lub nazwy klienta.";
  }
  if (field === "contract_number" && !String(context.contractNumber || "").trim()) {
    return "Brak numeru umowy.";
  }
  if (field === "contract_value" && Number(context.contractValue) <= 0) {
    return "Brak poprawnej wartości umowy.";
  }
  if (field === "deposit_amount" && Number(context.depositAmount) <= 0) {
    return "Brak poprawnej kwoty zaliczki.";
  }
  if (field === "outstanding_amount" && Number(context.outstandingAmount) <= 0) {
    return "Umowa nie ma dodatniego salda do zapłaty.";
  }
  if (field === "installation_date" && !formatSmsInstallationDate(context.installationDate)) {
    return "Brak daty montażu.";
  }
  if (field === "installation_time" && !String(context.installationTime || "").slice(0, 5)) {
    return "Brak godziny montażu.";
  }
  if (
    field === "installer_company_name" &&
    !String(context.installerCompanyName || "").trim()
  ) {
    return "Brak wybranego instalatora.";
  }
  return null;
}

export function buildSaleSmsTemplates(
  context: SaleSmsTemplateContext,
  definitions: SmsTemplateDefinition[] = DEFAULT_SALE_SMS_TEMPLATE_DEFINITIONS
): SaleSmsTemplate[] {
  const values = getTemplateValues(context);

  return [...definitions]
    .filter((definition) => definition.isActive !== false)
    .sort((left, right) => (left.sortOrder ?? 100) - (right.sortOrder ?? 100))
    .map((definition) => {
      const placeholders = getSmsTemplatePlaceholders(definition.messageTemplate);
      const placeholderRequirements = placeholders
        .map((key) => VARIABLE_REQUIREMENTS[key as SmsTemplateVariableKey])
        .filter((field): field is SmsTemplateRequiredField => Boolean(field));
      const requiredFields = [
        ...new Set([...definition.requiredFields, ...placeholderRequirements]),
      ];
      const requirementReason = requiredFields
        .map((field) => getRequirementReason(field, context))
        .find(Boolean);
      const missingVariable = placeholders.find(
        (key) => !String(values[key as SmsTemplateVariableKey] || "").trim()
      );
      const missingVariableLabel = SMS_TEMPLATE_VARIABLES.find(
        (variable) => variable.key === missingVariable
      )?.label;
      const reason =
        requirementReason ||
        (missingVariableLabel ? `Brak danych: ${missingVariableLabel}.` : null);
      const message = definition.messageTemplate.replace(
        /{{\s*([a-z0-9_]+)\s*}}/gi,
        (_match, rawKey: string) => {
          const key = rawKey.toLowerCase() as SmsTemplateVariableKey;
          return values[key] || `[brak: ${key}]`;
        }
      );

      return {
        id: definition.id,
        type: definition.type,
        title: definition.title,
        message,
        enabled: !reason,
        reason: reason || null,
        tone: definition.tone,
        category: definition.category || "sale",
        isSystem: definition.isSystem,
      };
    });
}

export function buildInstallationReminderMessage(
  context: InstallationReminderContext
) {
  const installerContact =
    context.installerContactName && context.installerPhone
      ? ` lub bezpośrednio z instalatorem: ${context.installerContactName}, tel. ${context.installerPhone}`
      : "";

  return `Dzień dobry. Przypominamy, że w dniu jutrzejszym odbędzie się montaż do umowy nr ${context.contractNumber}. Montaż realizuje firma ${context.installerCompanyName}. W razie nagłej zmiany planów prosimy o kontakt pod nr infolinii ${IDEASOL_HOTLINE}${installerContact}. Pozdrawiamy, Zespół IdeaSol.`;
}
