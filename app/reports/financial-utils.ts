

import type { ClientRow, FinancialDetailRow, FinancialDetailType, FinancialSaleRow, FinancialSummary } from "./types";
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
  return readSaleNumber(sale, [
    "sale_price_gross",
    "salePriceGross",
    "grossPrice",
    "finalGross",
    "totalGross",
    "contract_value_gross",
    "contract_value",
    "total_gross",
    "final_gross",
    "gross_value",
  ]);
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

export function summarizeFinancialSales(
  sales: FinancialSaleRow[],
  currentUserId: string,
  currentUserRole: string,
  ownerIds: Set<string>,
  managerUserIds: Set<string>
) {
  const summary = { ...EMPTY_FINANCIAL_SUMMARY };

  sales.forEach((sale) => {
    const sellerId = getSaleSellerId(sale);
    const status = getSaleStatus(sale);
    const revenueGross = getSaleRevenueGross(sale);
    const isOwnerSeller = ownerIds.has(sellerId);
    const isManagerSeller = managerUserIds.has(sellerId);
    const isLost = isLostContractStatus(status);
    const isCompleted = isCompletedSaleStatus(status);
    const isCostEligible = !isCostExcludedStatus(status);
    const forecast = isForecastCommissionSale(sale);
    const payable = isPayableCommissionSale(sale) || isCompleted;

    const sellerCommission = getSaleSellerCommission(sale);
    const sellerMarkupNet = getSaleSellerMarkupNet(sale) || sellerCommission;
    const managerFee = getSaleManagerFee(sale);
    const ownerMargin = getSaleOwnerMargin(sale);

    summary.salesCount += 1;
    summary.totalRevenueGross += revenueGross;

    if (isLost) {
      summary.lostRevenueGross += revenueGross;
    } else {
      summary.revenueGross += revenueGross;
    }

    if (isCompleted) {
      summary.guaranteeFund += getSaleOperatorFeeNet(sale);
      summary.marketingFund += getSaleMarketingValue(sale);

      if (!isOwnerSeller) {
        summary.sellerCommissions += sellerMarkupNet;
      }
    }

    if (isCostEligible) {
      const equipmentCost = getSaleEquipmentCostDetailed(sale) || getSaleEquipmentCost(sale);
      const installationCost = getSaleInstallationCostDetailed(sale) || getSaleInstallationCost(sale);

      summary.equipmentCost += equipmentCost;
      summary.equipmentCostGross += equipmentCost * 1.23;
      summary.installationCost += installationCost;
      summary.installationCostGross += installationCost * 1.08;
    }

    summary.managerCommissions += isCompleted ? managerFee : 0;

    if ((currentUserRole === "owner" || currentUserRole === "admin") && !isLost) {
      summary.ownerProfit += ownerMargin + (isOwnerSeller ? sellerMarkupNet / 3 : 0);
    }

    if (sellerId === currentUserId && !isOwnerSeller) {
      if (forecast) summary.advisorCommissionForecast += sellerCommission;
      if (payable) summary.advisorCommissionPayable += sellerCommission;
    }

    if (currentUserRole === "manager") {
      if (forecast) summary.managerFeeForecast += managerFee;
      if (payable) summary.managerFeePayable += managerFee;

      if (sellerId === currentUserId && isManagerSeller) {
        if (forecast) summary.managerOwnSalesCommissionForecast += sellerCommission;
        if (payable) summary.managerOwnSalesCommissionPayable += sellerCommission;
      }
    }
  });

  summary.companyProfit =
    netFromGross(summary.revenueGross, 0.08) -
    summary.equipmentCost -
    summary.installationCost -
    summary.sellerCommissions -
    summary.managerCommissions -
    summary.ownerProfit * 3;

  return summary;
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

export function getSaleEquipmentCost(sale: FinancialSaleRow) {
  return readSaleNumber(sale, [
    "equipment_cost_net",
    "equipment_cost",
    "equipmentCostNet",
    "equipmentCost",
    "totalEquipmentCostNet",
  ]);
}

export function getSaleInstallationCost(sale: FinancialSaleRow) {
  return readSaleNumber(sale, [
    "installation_cost_net",
    "installation_cost",
    "installationCostNet",
    "installationCost",
    "mountingCostNet",
  ]);
}


export function getSaleSellerCommission(sale: FinancialSaleRow) {
  return readSaleNumber(sale, [
    "seller_commission_net",
    "seller_commission",
    "seller_margin",
    "seller_markup_net",
    "sellerCommissionNet",
    "sellerMarkupNet",
    "sellerMargin",
  ]);
}

export function getSaleManagerFee(sale: FinancialSaleRow) {
  return readSaleNumber(sale, [
    "manager_fee_net",
    "manager_fee",
    "managerFeeNet",
    "managerFee",
  ]);
}


export function getSaleGuaranteeFund(sale: FinancialSaleRow) {
  return readSaleNumber(sale, [
    "guarantee_fund_net",
    "guarantee_fund",
    "warranty_fund_net",
    "warranty_fund",
    "guaranteeFundNet",
    "guaranteeFund",
    "warrantyFundNet",
    "warrantyFund",
  ]);
}

export function getSaleMarketingFund(sale: FinancialSaleRow) {
  return readSaleNumber(sale, [
    "marketing_fund",
    "marketing_cost_net",
    "marketing_cost",
    "marketingFund",
    "marketingCostNet",
    "marketingCost",
  ]);
}

export function getSaleOwnerMargin(sale: FinancialSaleRow) {
  const managerOverridePerOwnerNet = readSaleDeepSum(sale, [
    "managerOverridePerOwnerNet",
    "manager_override_per_owner_net",
  ]);

  if (managerOverridePerOwnerNet !== 0) return managerOverridePerOwnerNet;

  return readSaleNumber(sale, [
    "owner_margin_net",
    "owner_margin",
    "company_margin_net",
    "company_margin",
    "ownerMarginNet",
    "ownerMargin",
    "companyMarginNet",
    "companyMargin",
  ]);
}

const forecastCommissionStatuses = new Set([
  "umowione do montazu",
  "zamontowany",
  "oczekiwanie na pelna wplate",
]);

const payableCommissionStatuses = new Set([
  "zakonczony",
  "zakonczona",
  "zakończony",
  "zakończona",
]);

export function getSaleSellerId(sale: FinancialSaleRow) {
  return sale.seller_id || sale.created_by || sale.assigned_user_id || sale.user_id || "";
}

export function getSaleStatus(sale: FinancialSaleRow) {
  return normalizeText(sale.status || "");
}

export function isLostContractStatus(status: string) {
  return (
    status === "anulowana" ||
    status === "odstapienie - utrzymanie" ||
    status === "odstapienie - nieuratowana" ||
    status === "utrzymanie - nieuratowana" ||
    status === "utrzmanie - nieuratowana" ||
    status === "utrzmanie - nieuratowana" ||
    status === "utzymanie - nieuratowana"
  );
}

export function isCompletedSaleStatus(status: string) {
  return status.startsWith("zakonczon");
}

export function isCostExcludedStatus(status: string) {
  return (
    isLostContractStatus(status) ||
    status === "oczekuje na sprawdzenie dokumentow" ||
    status === "oczekiwanie na sprawdzenie dokumentow" ||
    status === "oczekuje na umowienie montazu" ||
    status === "oczekiwanie na umowienie montazu" ||
    status === "oczekuje na zaliczke" ||
    status === "oczekiwanie na zaliczke" ||
    status === "oczekiwanie na zaksiegowanie zaliczki"
  );
}

export function isForecastCommissionSale(sale: FinancialSaleRow) {
  return forecastCommissionStatuses.has(getSaleStatus(sale));
}

export function isPayableCommissionSale(sale: FinancialSaleRow) {
  return payableCommissionStatuses.has(getSaleStatus(sale));
}
export function getSaleDisplayId(sale: FinancialSaleRow) {
  return sale.sale_public_id || sale.public_id || sale.id;
}

export function readStringFromObject(source: unknown, keys: string[]) {
  if (!source || typeof source !== "object") return "";
  const objectSource = source as Record<string, unknown>;

  for (const key of keys) {
    const value = objectSource[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

export function getSaleClientName(sale: FinancialSaleRow, clientMap: Map<string, ClientRow>) {
  const client = sale.client_id ? clientMap.get(sale.client_id) : undefined;
  const fromClient = client?.full_name || client?.company_name || client?.contact_person || client?.email || client?.phone;
  if (fromClient) return fromClient;

  return (
    readStringFromObject(sale.customer_data, ["full_name", "fullName", "name", "company_name", "companyName", "contact_person", "contactPerson", "email", "phone"]) ||
    readStringFromObject(sale.offer_snapshot, ["client_name", "clientName", "full_name", "fullName", "company_name", "companyName"]) ||
    "Brak klienta"
  );
}

export function createFinancialDetailRow(
  sale: FinancialSaleRow,
  clientMap: Map<string, ClientRow>,
  net: number,
  gross: number,
  description: string
): FinancialDetailRow | null {
  if (!Number.isFinite(net) || net === 0) return null;

  return {
    saleId: String(getSaleDisplayId(sale)),
    clientName: getSaleClientName(sale, clientMap),
    status: sale.status || "Brak statusu",
    net,
    gross,
    description,
  };
} 

export function getFinancialDetailTitle(type: FinancialDetailType) {
  const titles: Record<FinancialDetailType, string> = {
    allContracts: "Wartość wszystkich umów",
    activeContracts: "Wartość umów aktywnych",
    lostContracts: "Wartość umów straconych",
    equipment: "Wydatki na sprzęt",
    installation: "Wydatki na montaże",
    commissions: "Prowizje handlowców/managerów",
    guarantee: "Wpływy na fundusz gwarancyjny",
    marketing: "Wpływy na marketing",
    companyProfit: "Dochód firmy",
    ownerProfit: "Zysk per wspólnik",
  };

  return titles[type];
}


export function buildFinancialDetailRows(
  sales: FinancialSaleRow[],
  type: FinancialDetailType | null,
  ownerIds: Set<string>,
  clientMap: Map<string, ClientRow>
) {
  if (!type) return [];

  return sales
    .map((sale) => {
      const status = getSaleStatus(sale);
      const revenueGross = getSaleRevenueGross(sale);
      const revenueNet = netFromGross(revenueGross, 0.08);
      const isLost = isLostContractStatus(status);
      const isCompleted = isCompletedSaleStatus(status);
      const isCostEligible = !isCostExcludedStatus(status);
      const sellerId = getSaleSellerId(sale);
      const isOwnerSeller = ownerIds.has(sellerId);
      const sellerCommission = getSaleSellerCommission(sale);
      const sellerMarkupNet = getSaleSellerMarkupNet(sale) || sellerCommission;
      const managerFee = getSaleManagerFee(sale);
      const ownerProfitNet = getSaleOwnerMargin(sale) + (isOwnerSeller ? sellerMarkupNet / 3 : 0);
      const equipmentNet = isCostEligible ? getSaleEquipmentCostDetailed(sale) || getSaleEquipmentCost(sale) : 0;
      const installationNet = isCostEligible ? getSaleInstallationCostDetailed(sale) || getSaleInstallationCost(sale) : 0;
      const sellerCommissionNet = isCompleted && !isOwnerSeller ? sellerMarkupNet : 0;
      const managerFeeNet = isCompleted ? managerFee : 0;

      if (type === "allContracts") {
        return createFinancialDetailRow(sale, clientMap, revenueNet, revenueGross, "Wartość umowy");
      }

      if (type === "activeContracts" && !isLost) {
        return createFinancialDetailRow(sale, clientMap, revenueNet, revenueGross, "Wartość umowy aktywnej");
      }

      if (type === "lostContracts" && isLost) {
        return createFinancialDetailRow(sale, clientMap, revenueNet, revenueGross, "Wartość umowy straconej");
      }

      if (type === "equipment") {
        return createFinancialDetailRow(sale, clientMap, equipmentNet, grossFromNet(equipmentNet, 0.23), "Panele + falownik + magazyn energii + EMS");
      }

      if (type === "installation") {
        return createFinancialDetailRow(sale, clientMap, installationNet, grossFromNet(installationNet, 0.08), "Montaże + konstrukcja + zabezpieczenia + okablowanie + transport");
      }

      if (type === "commissions") {
        const commissionsNet = sellerCommissionNet + managerFeeNet;
        return createFinancialDetailRow(sale, clientMap, commissionsNet, grossFromNet(commissionsNet, 0.23), "Prowizja handlowca + manager fee");
      }

      if (type === "guarantee" && isCompleted) {
        const guaranteeNet = getSaleOperatorFeeNet(sale);
        return createFinancialDetailRow(sale, clientMap, guaranteeNet, grossFromNet(guaranteeNet, 0.08), "operatorFeeNet");
      }

      if (type === "marketing" && isCompleted) {
        const marketingNet = getSaleMarketingValue(sale);
        return createFinancialDetailRow(sale, clientMap, marketingNet, grossFromNet(marketingNet, 0.08), "marketing");
      }

      if (type === "ownerProfit" && !isLost) {
        return createFinancialDetailRow(sale, clientMap, ownerProfitNet, grossFromNet(ownerProfitNet, 0.08), "Zysk na jednego wspólnika");
      }

      if (type === "companyProfit" && !isLost) {
        const companyProfitNet = revenueNet - equipmentNet - installationNet - sellerCommissionNet - managerFeeNet - ownerProfitNet * 3;
        return createFinancialDetailRow(sale, clientMap, companyProfitNet, grossFromNet(companyProfitNet, 0.08), "Dochód firmy z umowy");
      }

      return null;
    })
    .filter((row): row is FinancialDetailRow => Boolean(row));
}

export function isSaleDocumentationComplete(sale: FinancialSaleRow) {
  const source = sale as Record<string, unknown>;
  const booleanKeys = [
    "documents_complete",
    "documentation_complete",
    "docs_complete",
    "documentsApproved",
    "documents_approved",
  ];

  if (booleanKeys.some((key) => source[key] === true)) return true;

  const status = normalizeText(
    readStringFromObject(source, [
      "documents_status",
      "documentation_status",
      "docs_status",
      "document_status",
    ])
  );

  return status.includes("komplet") || status.includes("zatwierdz") || status.includes("approved");
}