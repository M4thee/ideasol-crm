export type ContractPriceLines = {
  pv: number;
  storage: number;
  inverter: number;
  additionalServices: number;
};

const DEFAULT_ADJUSTMENT_ORDER: Array<keyof ContractPriceLines> = [
  "pv",
  "storage",
  "additionalServices",
  "inverter",
];

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeMoney(value: unknown) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? roundMoney(Math.max(0, parsedValue)) : 0;
}

export function sumContractPriceLines(lines: ContractPriceLines) {
  return roundMoney(
    lines.pv + lines.storage + lines.inverter + lines.additionalServices
  );
}

export function reconcileContractPriceLines(
  totalGross: unknown,
  sourceLines: ContractPriceLines,
  adjustmentOrder: Array<keyof ContractPriceLines> = DEFAULT_ADJUSTMENT_ORDER
) {
  const targetTotal = normalizeMoney(totalGross);
  const lines: ContractPriceLines = {
    pv: normalizeMoney(sourceLines.pv),
    storage: normalizeMoney(sourceLines.storage),
    inverter: normalizeMoney(sourceLines.inverter),
    additionalServices: normalizeMoney(sourceLines.additionalServices),
  };
  const orderedKeys = [
    ...adjustmentOrder,
    ...DEFAULT_ADJUSTMENT_ORDER.filter((key) => !adjustmentOrder.includes(key)),
  ];
  const preferredKey = orderedKeys.find((key) => lines[key] > 0) || orderedKeys[0];
  let difference = roundMoney(targetTotal - sumContractPriceLines(lines));

  if (difference > 0) {
    lines[preferredKey] = roundMoney(lines[preferredKey] + difference);
  } else if (difference < 0) {
    let excess = Math.abs(difference);
    const reductionOrder = ["pv", "storage"]
      .filter((key): key is keyof ContractPriceLines => orderedKeys.includes(key as keyof ContractPriceLines))
      .sort((left, right) => lines[right] - lines[left]);
    const fixedPriceKeys = orderedKeys.filter(
      (key) => !reductionOrder.includes(key)
    );

    for (const key of [...reductionOrder, ...fixedPriceKeys]) {
      if (excess <= 0) break;

      const reduction = Math.min(lines[key], excess);
      lines[key] = roundMoney(lines[key] - reduction);
      excess = roundMoney(excess - reduction);
    }
  }

  difference = roundMoney(targetTotal - sumContractPriceLines(lines));
  lines[preferredKey] = roundMoney(Math.max(0, lines[preferredKey] + difference));

  return lines;
}

function recordMoney(record: Record<string, unknown>, key: string) {
  return normalizeMoney(record[key]);
}

export function reconcileStoredContractFinancialBreakdown(
  source: Record<string, unknown>,
  vatRate: unknown,
  hasPv: boolean
) {
  const normalizedVatRate = Number(vatRate);
  const vatMultiplier =
    Number.isFinite(normalizedVatRate) && normalizedVatRate >= 0
      ? 1 + normalizedVatRate / 100
      : 1.08;
  const totalAfterDiscount =
    recordMoney(source, "contract_total_gross_after_discount") ||
    recordMoney(source, "contract_total_gross");
  const totalBeforeDiscount =
    recordMoney(source, "contract_total_gross_before_discount") ||
    roundMoney(totalAfterDiscount * 1.1111);
  const adjustmentOrder: Array<keyof ContractPriceLines> = hasPv
    ? ["pv", "storage", "additionalServices", "inverter"]
    : ["storage", "additionalServices", "inverter", "pv"];
  const afterDiscount = reconcileContractPriceLines(
    totalAfterDiscount,
    {
      pv: recordMoney(source, "contract_pv_gross_after_discount"),
      storage: recordMoney(source, "contract_storage_gross_after_discount"),
      inverter: recordMoney(source, "contract_inverter_gross_after_discount"),
      additionalServices: recordMoney(
        source,
        "contract_additional_services_gross_after_discount"
      ),
    },
    adjustmentOrder
  );
  const beforeDiscount = reconcileContractPriceLines(
    totalBeforeDiscount,
    {
      pv: recordMoney(source, "contract_pv_gross_before_discount"),
      storage: recordMoney(source, "contract_storage_gross_before_discount"),
      inverter: recordMoney(source, "contract_inverter_gross_before_discount"),
      additionalServices: recordMoney(
        source,
        "contract_additional_services_gross_before_discount"
      ),
    },
    adjustmentOrder
  );

  const netFromGross = (grossValue: number) =>
    roundMoney(grossValue / vatMultiplier);

  return {
    ...source,
    contract_total_gross_after_discount: totalAfterDiscount,
    contract_total_gross_before_discount: totalBeforeDiscount,
    contract_total_gross: totalAfterDiscount,
    contract_pv_gross_after_discount: afterDiscount.pv,
    contract_pv_gross_before_discount: beforeDiscount.pv,
    contract_pv_gross: afterDiscount.pv,
    contract_pv_net_after_discount: netFromGross(afterDiscount.pv),
    contract_storage_gross_after_discount: afterDiscount.storage,
    contract_storage_gross_before_discount: beforeDiscount.storage,
    contract_storage_gross: afterDiscount.storage,
    contract_storage_net_after_discount: netFromGross(afterDiscount.storage),
    contract_inverter_gross_after_discount: afterDiscount.inverter,
    contract_inverter_gross_before_discount: beforeDiscount.inverter,
    contract_inverter_gross: afterDiscount.inverter,
    contract_inverter_net_after_discount: netFromGross(afterDiscount.inverter),
    contract_additional_services_gross_after_discount:
      afterDiscount.additionalServices,
    contract_additional_services_gross_before_discount:
      beforeDiscount.additionalServices,
    contract_additional_services_gross: afterDiscount.additionalServices,
    contract_additional_services_net_after_discount: netFromGross(
      afterDiscount.additionalServices
    ),
  };
}
