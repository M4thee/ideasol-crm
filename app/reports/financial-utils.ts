

import type { FinancialSaleRow, FinancialSummary } from "./types";
import { grossFromNet, netFromGross, normalizeText, toNumber } from "./utils";

export const EMPTY_FINANCIAL_SUMMARY: FinancialSummary = {
  totalRevenueGross: 0,
  revenueGross: 0,
  lostRevenueGross: 0,
  guaranteeFund: 0,
  marketingFund: 0,
  equipmentCost: 0,
  equipmentCostGross: 0,
  installationCost: 0,
  installationCostGross: 0,
  sellerCommissions: 0,
  managerCommissions: 0,
  companyProfit: 0,
  ownerProfit: 0,
  advisorCommissionForecast: 0,
  advisorCommissionPayable: 0,
  managerFeeForecast: 0,
  managerFeePayable: 0,
  managerOwnSalesCommissionForecast: 0,
  managerOwnSalesCommissionPayable: 0,
  salesCount: 0,
};

export function getSaleRevenueGross(sale: FinancialSaleRow) {
  return firstPositiveNumber(
    sale.contract_value_gross,
    sale.contract_value,
    sale.total_gross,
    sale.final_gross,
    sale.gross_value,
    getNestedNumber(sale.financial_data, "contract_value_gross"),
    getNestedNumber(sale.financial_data, "total_gross"),
    getNestedNumber(sale.offer_snapshot, "totalGross"),
    getNestedNumber(sale.offer_snapshot, "total_gross"),
    getNestedNumber(sale.offer_data, "totalGross"),
    getNestedNumber(sale.offer_data, "total_gross")
  );
}

export function getSaleRevenueNet(sale: FinancialSaleRow) {
  return firstPositiveNumber(
    sale.total_net,
    sale.final_net,
    getNestedNumber(sale.financial_data, "total_net"),
    getNestedNumber(sale.financial_data, "revenue_net"),
    netFromGross(getSaleRevenueGross(sale), 0.08)
  );
}

export function getEquipmentCostNet(sale: FinancialSaleRow) {
  return firstPositiveNumber(
    sale.equipment_cost_net,
    sale.equipment_cost,
    getNestedNumber(sale.financial_data, "equipment_cost_net"),
    getNestedNumber(sale.financial_data, "equipmentCostNet"),
    getNestedNumber(sale.offer_snapshot, "equipmentCostNet"),
    getNestedNumber(sale.offer_data, "equipmentCostNet")
  );
}

export function getEquipmentCostGross(sale: FinancialSaleRow) {
  return grossFromNet(getEquipmentCostNet(sale), 0.23);
}

export function getInstallationCostNet(sale: FinancialSaleRow) {
  return firstPositiveNumber(
    sale.installation_cost_net,
    sale.installation_cost,
    getNestedNumber(sale.financial_data, "installation_cost_net"),
    getNestedNumber(sale.financial_data, "installationCostNet"),
    getNestedNumber(sale.offer_snapshot, "installationCostNet"),
    getNestedNumber(sale.offer_data, "installationCostNet")
  );
}

export function getInstallationCostGross(sale: FinancialSaleRow) {
  return grossFromNet(getInstallationCostNet(sale), 0.08);
}

export function getSellerCommissionNet(sale: FinancialSaleRow) {
  return firstPositiveNumber(
    sale.seller_commission_net,
    sale.seller_commission,
    sale.seller_margin,
    sale.seller_markup_net,
    getNestedNumber(sale.financial_data, "seller_commission_net"),
    getNestedNumber(sale.financial_data, "sellerCommissionNet"),
    getNestedNumber(sale.offer_snapshot, "sellerCommissionNet"),
    getNestedNumber(sale.offer_data, "sellerCommissionNet")
  );
}

export function getManagerCommissionNet(sale: FinancialSaleRow) {
  return firstPositiveNumber(
    sale.manager_fee_net,
    sale.manager_fee,
    getNestedNumber(sale.financial_data, "manager_fee_net"),
    getNestedNumber(sale.financial_data, "managerFeeNet"),
    getNestedNumber(sale.offer_snapshot, "managerFeeNet"),
    getNestedNumber(sale.offer_data, "managerFeeNet")
  );
}

export function getGuaranteeFundNet(sale: FinancialSaleRow) {
  return firstPositiveNumber(
    sale.guarantee_fund_net,
    sale.warranty_fund_net,
    sale.guarantee_fund,
    sale.warranty_fund,
    getNestedNumber(sale.financial_data, "guarantee_fund_net"),
    getNestedNumber(sale.financial_data, "warranty_fund_net"),
    getNestedNumber(sale.financial_data, "guaranteeFundNet"),
    getNestedNumber(sale.offer_snapshot, "guaranteeFundNet"),
    getNestedNumber(sale.offer_data, "guaranteeFundNet")
  );
}

export function getMarketingFundNet(sale: FinancialSaleRow) {
  return firstPositiveNumber(
    sale.marketing_fund,
    sale.marketing_cost_net,
    sale.marketing_cost,
    getNestedNumber(sale.financial_data, "marketing_fund"),
    getNestedNumber(sale.financial_data, "marketing_cost_net"),
    getNestedNumber(sale.financial_data, "marketingFundNet"),
    getNestedNumber(sale.offer_snapshot, "marketingFundNet"),
    getNestedNumber(sale.offer_data, "marketingFundNet")
  );
}

export function getOwnerProfitNet(sale: FinancialSaleRow) {
  return firstPositiveNumber(
    sale.owner_margin_net,
    sale.owner_margin,
    getNestedNumber(sale.financial_data, "owner_margin_net"),
    getNestedNumber(sale.financial_data, "ownerMarginNet"),
    getNestedNumber(sale.offer_snapshot, "ownerMarginNet"),
    getNestedNumber(sale.offer_data, "ownerMarginNet")
  );
}

export function getCompanyProfitNet(sale: FinancialSaleRow) {
  return firstPositiveNumber(
    sale.company_margin_net,
    sale.company_margin,
    getNestedNumber(sale.financial_data, "company_margin_net"),
    getNestedNumber(sale.financial_data, "companyMarginNet"),
    getNestedNumber(sale.offer_snapshot, "companyMarginNet"),
    getNestedNumber(sale.offer_data, "companyMarginNet"),
    getSaleRevenueNet(sale) - getEquipmentCostNet(sale) - getInstallationCostNet(sale) - getSellerCommissionNet(sale) - getManagerCommissionNet(sale)
  );
}

export function isLostSale(sale: FinancialSaleRow) {
  const status = String(sale.status || "").toLowerCase();
  return status.includes("anul") || status.includes("utrac") || status.includes("rezygn");
}

export function summarizeFinancialSales(sales: FinancialSaleRow[]): FinancialSummary {
  return sales.reduce<FinancialSummary>((summary, sale) => {
    const revenueGross = getSaleRevenueGross(sale);
    const lost = isLostSale(sale);

    summary.totalRevenueGross += revenueGross;
    summary.salesCount += 1;

    if (lost) {
      summary.lostRevenueGross += revenueGross;
      return summary;
    }

    summary.revenueGross += revenueGross;
    summary.guaranteeFund += getGuaranteeFundNet(sale);
    summary.marketingFund += getMarketingFundNet(sale);
    summary.equipmentCost += getEquipmentCostNet(sale);
    summary.equipmentCostGross += getEquipmentCostGross(sale);
    summary.installationCost += getInstallationCostNet(sale);
    summary.installationCostGross += getInstallationCostGross(sale);
    summary.sellerCommissions += getSellerCommissionNet(sale);
    summary.managerCommissions += getManagerCommissionNet(sale);
    summary.ownerProfit += getOwnerProfitNet(sale);
    summary.companyProfit += getCompanyProfitNet(sale);
    summary.advisorCommissionForecast += getSellerCommissionNet(sale);
    summary.advisorCommissionPayable += getSellerCommissionNet(sale);
    summary.managerFeeForecast += getManagerCommissionNet(sale);
    summary.managerFeePayable += getManagerCommissionNet(sale);

    return summary;
  }, { ...EMPTY_FINANCIAL_SUMMARY });
}

export function firstPositiveNumber(...values: unknown[]) {
  for (const value of values) {
    const numberValue = toNumber(value);
    if (numberValue > 0) return numberValue;
  }
  return 0;
}

export function getNestedNumber(source: unknown, key: string) {
  if (!source || typeof source !== "object") return 0;
  const record = source as Record<string, unknown>;
  return toNumber(record[key]);
}
export function readNumberFromObject(source: unknown, keys: string[]) {
  if (!source || typeof source !== "object") return 0;
  const objectSource = source as Record<string, unknown>;

  for (const key of keys) {
    const value = objectSource[key];
    const numericValue = Number(value || 0);
    if (Number.isFinite(numericValue) && numericValue !== 0) return numericValue;
  }

  return 0;
}

export function readSaleNumber(sale: FinancialSaleRow, keys: string[]) {
  const directValue = readNumberFromObject(sale, keys);
  if (directValue) return directValue;

  return (
    readNumberFromObject(sale.financial_data, keys) ||
    readNumberFromObject(sale.offer_snapshot, keys) ||
    readNumberFromObject(sale.offer_data, keys) ||
    readNumberFromObject(sale.customer_data, keys)
  );
}
export function normalizeObjectKey(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

export function sumNumbersByKeysDeep(source: unknown, keys: string[]) {
  if (!source || typeof source !== "object") return 0;

  const normalizedKeys = new Set(keys.map(normalizeObjectKey));
  let sum = 0;

  function walk(value: unknown) {
    if (!value || typeof value !== "object") return;

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    Object.entries(value as Record<string, unknown>).forEach(([key, entryValue]) => {
      if (normalizedKeys.has(normalizeObjectKey(key))) {
        const numericValue = Number(entryValue || 0);
        if (Number.isFinite(numericValue)) sum += numericValue;
      }

      if (entryValue && typeof entryValue === "object") {
        walk(entryValue);
      }
    });
  }

  walk(source);
  return sum;
}

export function hasMatchingLineItemLabel(source: Record<string, unknown>, labels: string[]) {
  const labelFields = ["label", "name", "title", "type", "category", "component", "item", "key"];
  const normalizedLabels = labels.map(normalizeObjectKey);

  return labelFields.some((field) => {
    const value = source[field];
    if (typeof value !== "string") return false;

    const normalizedValue = normalizeObjectKey(value);
    return normalizedLabels.some((label) => normalizedValue.includes(label) || label.includes(normalizedValue));
  });
}

export function readLineItemNetValue(source: Record<string, unknown>) {
  const preferredKeys = [
    "net",
    "netValue",
    "valueNet",
    "costNet",
    "priceNet",
    "purchaseNet",
    "totalNet",
    "amountNet",
    "netAmount",
    "value",
    "cost",
    "price",
    "amount",
    "total",
  ];

  for (const key of preferredKeys) {
    const directValue = source[key];
    const numericValue = Number(directValue || 0);
    if (Number.isFinite(numericValue) && numericValue !== 0) return numericValue;

    const normalizedKey = normalizeObjectKey(key);
    const matchingEntry = Object.entries(source).find(([entryKey]) => normalizeObjectKey(entryKey) === normalizedKey);

    if (matchingEntry) {
      const matchingValue = Number(matchingEntry[1] || 0);
      if (Number.isFinite(matchingValue) && matchingValue !== 0) return matchingValue;
    }
  }

  return 0;
}

export function sumLineItemsByLabelsDeep(source: unknown, labels: string[]) {
  if (!source || typeof source !== "object") return 0;

  let sum = 0;

  function walk(value: unknown) {
    if (!value || typeof value !== "object") return;

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    const objectValue = value as Record<string, unknown>;

    if (hasMatchingLineItemLabel(objectValue, labels)) {
      sum += readLineItemNetValue(objectValue);
    }

    Object.values(objectValue).forEach((entryValue) => {
      if (entryValue && typeof entryValue === "object") walk(entryValue);
    });
  }

  walk(source);
  return sum;
}


export function readSaleLineItemSum(sale: FinancialSaleRow, keys: string[], labels: string[]) {
  const directValue = readNumberFromObject(sale, keys);
  if (directValue !== 0) return directValue;

  const sources = [sale.financial_data, sale.offer_snapshot, sale.offer_data, sale.customer_data];

  for (const source of sources) {
    const byKeys = sumNumbersByKeysDeep(source, keys);
    if (byKeys !== 0) return byKeys;

    const byLabels = sumLineItemsByLabelsDeep(source, labels);
    if (byLabels !== 0) return byLabels;
  }

  return 0;
}

export function readNestedValue(source: unknown, path: string[]) {
  return path.reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}

export function getOfferBreakdownRows(sale: FinancialSaleRow) {
  const possibleBreakdowns = [
    readNestedValue(sale.offer_snapshot, ["offer_data", "result", "breakdown"]),
    readNestedValue(sale.offer_snapshot, ["offer_data", "form", "result", "breakdown"]),
    readNestedValue(sale.offer_snapshot, ["result", "breakdown"]),
    readNestedValue(sale.offer_snapshot, ["breakdown"]),
    readNestedValue(sale.financial_data, ["breakdown"]),
    readNestedValue(sale.customer_data, ["breakdown"]),
  ];

  return possibleBreakdowns.find(Array.isArray) as Array<Record<string, unknown>> | undefined;
}

export function sumOfferBreakdownValues(sale: FinancialSaleRow, labels: string[]) {
  const rows = getOfferBreakdownRows(sale);
  if (!rows) return 0;

  const normalizedLabels = labels.map(normalizeObjectKey);

  return rows.reduce((sum, row) => {
    const label = typeof row.label === "string" ? normalizeObjectKey(row.label) : "";
    const isMatchingLabel = normalizedLabels.some((expectedLabel) => label === expectedLabel);

    if (!isMatchingLabel) return sum;

    const value = Number(row.value || row.net || row.netValue || row.valueNet || row.costNet || row.priceNet || 0);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
}

export function readSaleDeepSum(sale: FinancialSaleRow, keys: string[]) {
  const directValue = readNumberFromObject(sale, keys);
  if (directValue !== 0) return directValue;

  const sources = [sale.financial_data, sale.offer_snapshot, sale.offer_data, sale.customer_data];

  for (const source of sources) {
    const value = sumNumbersByKeysDeep(source, keys);
    if (value !== 0) return value;
  }

  return 0;
}


export function getSaleEquipmentCostDetailed(sale: FinancialSaleRow) {
  const breakdownValue = sumOfferBreakdownValues(sale, [
    "Panele",
    "Falownik",
    "Magazyn energii",
    "System EMS",
  ]);

  if (breakdownValue !== 0) return breakdownValue;

  return readSaleLineItemSum(
    sale,
    [
      "panele",
      "panelsCostNet",
      "panelCostNet",
      "modulesCostNet",
      "pvModulesCostNet",
      "falownik",
      "inverterCostNet",
      "inverterPurchaseNet",
      "storageCostNet",
      "storagePurchaseNet",
      "batteryCostNet",
      "batteryPurchaseNet",
      "magazynEnergiiCostNet",
      "system EMS",
      "systemEMS",
      "emsCostNet",
      "emsPurchaseNet",
    ],
    [
      "panele",
      "paneli",
      "moduly",
      "moduly pv",
      "moduly fotowoltaiczne",
      "falownik",
      "inwerter",
      "inverter",
      "magazyn energii",
      "magazyn",
      "storage",
      "battery",
      "ems",
      "system ems",
      "systemems",
    ]
  );
}

export function getSaleInstallationCostDetailed(sale: FinancialSaleRow) {
  const breakdownValue = sumOfferBreakdownValues(sale, [
    "Montaż PV",
    "Montaż ME",
    "Konstrukcja / dach / grunt",
    "Zabezpieczenia",
    "Okablowanie",
    "Transport",
  ]);

  if (breakdownValue !== 0) return breakdownValue;

  return readSaleLineItemSum(
    sale,
    [
      "montaż PV",
      "montaz PV",
      "montazPV",
      "pvMounting",
      "montaż ME",
      "montaz ME",
      "storageInstallationNet",
      "batteryInstallationNet",
      "konstrukcja",
      "construction",
      "okablowanie",
      "wiring",
      "zabezpieczenia",
      "protections",
      "transport",
    ],
    [
      "montaz pv",
      "montaz me",
      "montaz magazynu",
      "montaz magazynu energii",
      "montaz",
      "konstrukcja",
      "okablowanie",
      "zabezpieczenia",
      "transport",
    ]
  );
}

export function getSaleOperatorFeeNet(sale: FinancialSaleRow) {
  return readSaleDeepSum(sale, ["operatorFeeNet", "operator_fee_net"]);
}

export function getSaleMarketingValue(sale: FinancialSaleRow) {
  return readSaleDeepSum(sale, ["marketing", "marketingNet", "marketing_net"]);
}

export function getSaleSellerMarkupNet(sale: FinancialSaleRow) {
  return readSaleDeepSum(sale, ["sellerMarkupNet", "seller_markup_net"]);
}