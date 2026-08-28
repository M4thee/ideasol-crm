export type CreditInterestRateType = "monthly_flat" | "annual_nominal";

export type CreditOffer = {
  id: number;
  bank_id: number;
  name: string;
  min_term_months: number;
  max_term_months: number;
  min_amount: number;
  max_amount: number;
  interest_rate_type: CreditInterestRateType;
  interest_rate: number;
  active: boolean;
};

export type CreditBank = {
  id: number;
  name: string;
  logo_path: string | null;
  display_order: number;
  active: boolean;
};

export type CreditCalculation = {
  installment: number;
  totalRepayment: number;
  totalCreditCost: number;
  nominalAnnualRate: number;
  rrso: number;
};

function calculateEquivalentAnnualRates(
  principal: number,
  installment: number,
  termMonths: number
) {
  if (installment * termMonths <= principal) {
    return {
      nominalAnnualRate: 0,
      effectiveAnnualRate: 0,
    };
  }

  const presentValue = (monthlyRate: number) =>
    installment * (1 - (1 + monthlyRate) ** -termMonths) / monthlyRate;

  let lowerRate = 0;
  let upperRate = 1;

  while (presentValue(upperRate) > principal && upperRate < 1024) {
    upperRate *= 2;
  }

  for (let iteration = 0; iteration < 100; iteration += 1) {
    const middleRate = (lowerRate + upperRate) / 2;

    if (presentValue(middleRate) > principal) {
      lowerRate = middleRate;
    } else {
      upperRate = middleRate;
    }
  }

  const monthlyRate = (lowerRate + upperRate) / 2;
  return {
    nominalAnnualRate: monthlyRate * 12 * 100,
    effectiveAnnualRate: ((1 + monthlyRate) ** 12 - 1) * 100,
  };
}

export function parseMoneyInput(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");

  if (!normalized) return 0;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function calculateCreditInstallment(
  principal: number,
  interestRate: number,
  termMonths: number,
  interestRateType: CreditInterestRateType
): CreditCalculation | null {
  if (
    !Number.isFinite(principal) ||
    !Number.isFinite(interestRate) ||
    !Number.isInteger(termMonths) ||
    principal <= 0 ||
    interestRate < 0 ||
    termMonths <= 0 ||
    !["monthly_flat", "annual_nominal"].includes(interestRateType)
  ) {
    return null;
  }

  if (interestRateType === "monthly_flat") {
    const totalCreditCost = principal * (interestRate / 100) * termMonths;
    const totalRepayment = principal + totalCreditCost;
    const installment = totalRepayment / termMonths;
    const equivalentAnnualRates = calculateEquivalentAnnualRates(
      principal,
      installment,
      termMonths
    );

    return {
      installment,
      totalRepayment,
      totalCreditCost,
      nominalAnnualRate: equivalentAnnualRates.nominalAnnualRate,
      rrso: equivalentAnnualRates.effectiveAnnualRate,
    };
  }

  const monthlyRate = interestRate / 100 / 12;
  const installment = monthlyRate === 0
    ? principal / termMonths
    : principal * monthlyRate / (1 - (1 + monthlyRate) ** -termMonths);
  const totalRepayment = installment * termMonths;
  const equivalentAnnualRates = calculateEquivalentAnnualRates(
    principal,
    installment,
    termMonths
  );

  return {
    installment,
    totalRepayment,
    totalCreditCost: Math.max(0, totalRepayment - principal),
    nominalAnnualRate: interestRate,
    rrso: equivalentAnnualRates.effectiveAnnualRate,
  };
}

export function validateCreditAmount(amount: number, offer: CreditOffer) {
  if (!Number.isFinite(amount) || amount <= 0) {
    return "Kwota kredytu musi być większa od 0 zł.";
  }

  if (amount < offer.min_amount) {
    return `Minimalna kwota dla tej oferty to ${offer.min_amount.toLocaleString("pl-PL")} zł.`;
  }

  if (amount > offer.max_amount) {
    return `Maksymalna kwota dla tej oferty to ${offer.max_amount.toLocaleString("pl-PL")} zł.`;
  }

  return null;
}
