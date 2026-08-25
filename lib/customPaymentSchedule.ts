export const MAX_CUSTOM_PAYMENT_INSTALLMENTS = 8;

export type CustomPaymentAmountType = "percent" | "gross_amount";
export type CustomPaymentTimingRelation = "before" | "after" | "on";
export type CustomPaymentTimingEvent =
  | "contract_signing"
  | "installation_start"
  | "installation_completion";

export type CustomPaymentInstallment = {
  id: string;
  label: string;
  amount: number;
  amountType: CustomPaymentAmountType;
  days: number;
  timingRelation: CustomPaymentTimingRelation;
  timingEvent: CustomPaymentTimingEvent;
};

export type CustomPaymentSchedule = {
  enabled: boolean;
  installments: CustomPaymentInstallment[];
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function toNumber(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toInteger(value: unknown) {
  return Math.max(0, Math.min(365, Math.floor(toNumber(value))));
}

function amountType(value: unknown): CustomPaymentAmountType {
  return value === "gross_amount" || value === "amount" || value === "pln"
    ? "gross_amount"
    : "percent";
}

function timingRelation(value: unknown): CustomPaymentTimingRelation {
  if (value === "before" || value === "on") return value;
  return "after";
}

function timingEvent(value: unknown): CustomPaymentTimingEvent {
  if (value === "contract_signing" || value === "installation_start") return value;
  return "installation_completion";
}

export function createDefaultCustomPaymentInstallments(): CustomPaymentInstallment[] {
  return [
    {
      id: "installment-1",
      label: "zaliczka",
      amount: 25,
      amountType: "percent",
      days: 0,
      timingRelation: "after",
      timingEvent: "contract_signing",
    },
    {
      id: "installment-2",
      label: "płatność końcowa",
      amount: 75,
      amountType: "percent",
      days: 3,
      timingRelation: "after",
      timingEvent: "installation_completion",
    },
  ];
}

export function createEmptyCustomPaymentSchedule(): CustomPaymentSchedule {
  return {
    enabled: false,
    installments: createDefaultCustomPaymentInstallments(),
  };
}

export function normalizeCustomPaymentSchedule(value: unknown): CustomPaymentSchedule {
  const record = asRecord(value);
  const rawInstallments = Array.isArray(record.installments)
    ? record.installments
    : Array.isArray(record.rows)
      ? record.rows
      : [];
  const installments = rawInstallments
    .slice(0, MAX_CUSTOM_PAYMENT_INSTALLMENTS)
    .map((rawInstallment, index) => {
      const installment = asRecord(rawInstallment);
      const relation = timingRelation(
        installment.timingRelation ?? installment.timing_relation ?? installment.relation
      );

      return {
        id: String(installment.id || `installment-${index + 1}`),
        label: String(installment.label || "").trim(),
        amount: toNumber(installment.amount ?? installment.value),
        amountType: amountType(installment.amountType ?? installment.amount_type),
        days: relation === "on" ? 0 : toInteger(installment.days),
        timingRelation: relation,
        timingEvent: timingEvent(
          installment.timingEvent ?? installment.timing_event ?? installment.event
        ),
      } satisfies CustomPaymentInstallment;
    });

  return {
    enabled: record.enabled === true,
    installments:
      installments.length > 0 ? installments : createDefaultCustomPaymentInstallments(),
  };
}

export function getCustomPaymentScheduleFromOffer(source: unknown): CustomPaymentSchedule {
  const record = asRecord(source);
  const offerData = asRecord(record.offer_data ?? record.offerData);
  const candidates = [
    record.customPaymentSchedule,
    record.custom_payment_schedule,
    offerData.customPaymentSchedule,
    offerData.custom_payment_schedule,
    asRecord(record.form).customPaymentSchedule,
    asRecord(record.form).custom_payment_schedule,
    asRecord(offerData.form).customPaymentSchedule,
    asRecord(offerData.form).custom_payment_schedule,
  ];

  for (const candidate of candidates) {
    const schedule = normalizeCustomPaymentSchedule(candidate);
    if (schedule.enabled) return schedule;
  }

  return createEmptyCustomPaymentSchedule();
}

export function getCustomPaymentScheduleFromSale(source: unknown): CustomPaymentSchedule {
  const sale = asRecord(source);
  const candidates = [
    asRecord(sale.customer_data).custom_payment_schedule,
    asRecord(sale.customer_data).customPaymentSchedule,
    sale.offer_snapshot,
    sale.offer_data,
    sale,
  ];

  for (const candidate of candidates) {
    const schedule = getCustomPaymentScheduleFromOffer(candidate);
    if (schedule.enabled) return schedule;
  }

  return createEmptyCustomPaymentSchedule();
}

export function validateCustomPaymentSchedule(
  value: unknown,
  totalGross?: number
): string {
  const schedule = normalizeCustomPaymentSchedule(value);

  if (!schedule.enabled) return "";
  if (schedule.installments.length < 1) return "Dodaj co najmniej jedną transzę płatności.";
  if (schedule.installments.length > MAX_CUSTOM_PAYMENT_INSTALLMENTS) {
    return `Harmonogram może zawierać maksymalnie ${MAX_CUSTOM_PAYMENT_INSTALLMENTS} transz.`;
  }

  for (const [index, installment] of schedule.installments.entries()) {
    const rowNumber = index + 1;
    if (!installment.label.trim()) return `Uzupełnij etykietę transzy ${rowNumber}.`;
    if (!Number.isFinite(installment.amount) || installment.amount <= 0) {
      return `Kwota lub procent transzy ${rowNumber} musi być większy od zera.`;
    }
    if (!Number.isInteger(installment.days) || installment.days < 0 || installment.days > 365) {
      return `Liczba dni w transzy ${rowNumber} musi mieścić się w zakresie 0-365.`;
    }
  }

  const amountTypes = new Set(schedule.installments.map((installment) => installment.amountType));
  if (amountTypes.size !== 1) {
    return "Wszystkie transze muszą być zapisane w tej samej jednostce: procentach albo PLN brutto.";
  }

  const total = schedule.installments.reduce((sum, installment) => sum + installment.amount, 0);
  const type = schedule.installments[0]?.amountType;

  if (type === "percent" && Math.abs(total - 100) > 0.01) {
    return `Suma transz wynosi ${formatCustomPaymentNumber(total)}%. Powinna wynosić dokładnie 100%.`;
  }

  if (
    type === "gross_amount" &&
    Number.isFinite(totalGross) &&
    Number(totalGross) > 0 &&
    Math.abs(total - Number(totalGross)) > 0.01
  ) {
    return `Suma transz wynosi ${formatCustomPaymentMoney(total)}, a cena brutto ${formatCustomPaymentMoney(
      Number(totalGross)
    )}.`;
  }

  return "";
}

export function formatCustomPaymentNumber(value: number) {
  return Number(value || 0).toLocaleString("pl-PL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function formatCustomPaymentMoney(value: number) {
  return `${Number(value || 0).toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} zł brutto`;
}

export function formatCustomPaymentAmount(installment: CustomPaymentInstallment) {
  return installment.amountType === "percent"
    ? `${formatCustomPaymentNumber(installment.amount)}% całkowitego wynagrodzenia brutto`
    : formatCustomPaymentMoney(installment.amount);
}

function formatDays(days: number) {
  return days === 1 ? "1 dnia" : `${days} dni`;
}

function eventLabel(
  event: CustomPaymentTimingEvent,
  relation: CustomPaymentTimingRelation
) {
  if (relation === "on") {
    if (event === "contract_signing") return "podpisania Umowy";
    if (event === "installation_start") return "rozpoczęcia montażu";
    return "zakończenia montażu";
  }

  if (relation === "before") {
    if (event === "contract_signing") return "podpisaniem Umowy";
    if (event === "installation_start") return "rozpoczęciem montażu";
    return "zakończeniem montażu";
  }

  if (event === "contract_signing") return "podpisaniu Umowy";
  if (event === "installation_start") return "rozpoczęciu montażu";
  return "zakończeniu montażu";
}

export function formatCustomPaymentTiming(installment: CustomPaymentInstallment) {
  const event = eventLabel(installment.timingEvent, installment.timingRelation);

  if (installment.timingRelation === "on") return `w dniu ${event}`;
  if (installment.days === 0) {
    return installment.timingRelation === "before" ? `przed ${event}` : `po ${event}`;
  }

  return installment.timingRelation === "before"
    ? `${formatDays(installment.days)} przed ${event}`
    : `do ${formatDays(installment.days)} po ${event}`;
}

export function formatCustomPaymentInstallment(installment: CustomPaymentInstallment) {
  return `${installment.label}: ${formatCustomPaymentAmount(installment)}, ${formatCustomPaymentTiming(
    installment
  )}.`;
}

export function isCustomPaymentDeposit(installment: CustomPaymentInstallment) {
  return /\bzadatek\b/i.test(installment.label.trim());
}

export function hasCustomPaymentDeposit(schedule: CustomPaymentSchedule) {
  return schedule.installments.some(isCustomPaymentDeposit);
}
