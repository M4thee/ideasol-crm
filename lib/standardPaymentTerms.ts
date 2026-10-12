export const STANDARD_DEPOSIT_PERCENT = 50;

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateStandardPaymentAmounts(grossValue: unknown) {
  const totalGross = Number(grossValue);

  if (!Number.isFinite(totalGross) || totalGross <= 0) {
    return {
      depositGross: 0,
      finalPaymentGross: 0,
    };
  }

  const depositGross = roundMoney(
    totalGross * (STANDARD_DEPOSIT_PERCENT / 100)
  );

  return {
    depositGross,
    finalPaymentGross: roundMoney(totalGross - depositGross),
  };
}
