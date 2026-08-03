export const IDEASOL_BANK_ACCOUNT = "33 1140 2004 0000 3302 8689 3030";
export const IDEASOL_HOTLINE = "41 202 02 38";

export type SaleSmsTemplateType =
  | "deposit_reminder"
  | "payment_reminder_1"
  | "payment_reminder_2"
  | "payment_demand"
  | "installation_confirmation";

export type SaleSmsTemplate = {
  type: SaleSmsTemplateType;
  title: string;
  message: string;
  enabled: boolean;
  reason: string | null;
  tone: "standard" | "warning" | "danger";
};

export type SaleSmsTemplateContext = {
  contractNumber: string;
  depositAmount: number | null;
  outstandingAmount: number | null;
  installationDate: string | null;
  installationTime: string | null;
  installerCompanyName: string | null;
};

export type InstallationReminderContext = {
  contractNumber: string;
  installerCompanyName: string;
  installerContactName: string | null;
  installerPhone: string | null;
};

export function formatSmsAmount(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "";

  return value.toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatSmsInstallationDate(value: string | null) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : "";
}

function createTemplate(
  template: Omit<SaleSmsTemplate, "enabled" | "reason">,
  reason: string | null
): SaleSmsTemplate {
  return {
    ...template,
    enabled: !reason,
    reason,
  };
}

export function buildSaleSmsTemplates(
  context: SaleSmsTemplateContext
): SaleSmsTemplate[] {
  const contractNumber = context.contractNumber.trim();
  const depositAmount = formatSmsAmount(context.depositAmount);
  const outstandingAmount = formatSmsAmount(context.outstandingAmount);
  const installationDate = formatSmsInstallationDate(context.installationDate);
  const installationTime = String(context.installationTime || "").slice(0, 5);
  const installerCompanyName = String(context.installerCompanyName || "").trim();

  return [
    createTemplate(
      {
        type: "deposit_reminder",
        title: "Przypomnienie o wpłacie zaliczki",
        tone: "standard",
        message: `Dzień dobry. Przypominamy o konieczności wpłaty zaliczki w kwocie ${depositAmount} PLN, na rachunek bankowy numer ${IDEASOL_BANK_ACCOUNT}. Tytułem: ${contractNumber}. Jeżeli dokonali Państwo wpłaty, prosimy o potraktowanie tej wiadomości jako nieaktualnej. Z pozdrowieniami, Zespół IdeaSol.`,
      },
      !contractNumber
        ? "Brak numeru umowy."
        : !depositAmount || Number(context.depositAmount) <= 0
          ? "Brak poprawnej kwoty zaliczki."
          : null
    ),
    createTemplate(
      {
        type: "payment_reminder_1",
        title: "Przypomnienie o płatności – I",
        tone: "warning",
        message: `Dzień dobry. Informujemy, że do tej pory nie zaksięgowaliśmy wpłaty do umowy numer ${contractNumber} w kwocie ${outstandingAmount} PLN. Numer konta do wpłaty: ${IDEASOL_BANK_ACCOUNT}. W tytule proszę podać numer umowy. Jeżeli dokonali Państwo wpłaty, prosimy o potraktowanie tej wiadomości jako nieaktualnej. Z pozdrowieniami, Zespół IdeaSol.`,
      },
      !contractNumber
        ? "Brak numeru umowy."
        : !outstandingAmount || Number(context.outstandingAmount) <= 0
          ? "Umowa nie ma dodatniego salda do zapłaty."
          : null
    ),
    createTemplate(
      {
        type: "payment_reminder_2",
        title: "Przypomnienie o płatności – II",
        tone: "warning",
        message: `Szanowny Kliencie. Informujemy, że nadal nie otrzymaliśmy wpłaty do umowy ${contractNumber}. Kwota do zapłaty wynosi ${outstandingAmount} PLN. Prosimy o pilne dokonanie wpłaty na rachunek ${IDEASOL_BANK_ACCOUNT}. W tytule prosimy podać numer umowy. Z pozdrowieniami, Zespół IdeaSol.`,
      },
      !contractNumber
        ? "Brak numeru umowy."
        : !outstandingAmount || Number(context.outstandingAmount) <= 0
          ? "Umowa nie ma dodatniego salda do zapłaty."
          : null
    ),
    createTemplate(
      {
        type: "payment_demand",
        title: "Wezwanie do zapłaty",
        tone: "danger",
        message: "Dzień dobry. Ponieważ wciąż nie otrzymaliśmy wpłaty za wykonane usługi, postanowiliśmy przekazać Państwa dane do zewnętrznej firmy windykacyjnej wraz z dokonaniem wpisu do Krajowego Rejestru Długów. Tylko wpłata w ciągu 48 h pozwoli nam uniknąć tego etapu. Wezwanie do zapłaty zostało przesłane na adres e-mail. Pozdrawiamy, Zespół IdeaSol.",
      },
      !outstandingAmount || Number(context.outstandingAmount) <= 0
        ? "Umowa nie ma dodatniego salda do zapłaty."
        : null
    ),
    createTemplate(
      {
        type: "installation_confirmation",
        title: "Potwierdzenie daty montażu",
        tone: "standard",
        message: `Dzień dobry. Potwierdzamy montaż w dniu ${installationDate} około godziny ${installationTime}. Firma realizująca montaż na zlecenie IdeaSol Sp. z o.o.: ${installerCompanyName}. Infolinia IdeaSol: ${IDEASOL_HOTLINE}.`,
      },
      !installationDate
        ? "Brak daty montażu."
        : !installationTime
          ? "Brak godziny montażu."
          : !installerCompanyName
            ? "Brak wybranego instalatora."
            : null
    ),
  ];
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
