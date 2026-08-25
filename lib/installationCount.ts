type JsonRecord = Record<string, unknown>;

const MAX_INSTALLATION_COUNT = 100;

const RESULT_TOTAL_FIELDS = [
  "pvPowerKw",
  "storageCapacityKwh",
  "basePriceNet",
  "sellerMarkupNet",
  "finalNet",
  "finalGross",
  "companyMargin",
  "operatorFeeNet",
  "operatorFeePerOwnerNet",
  "sellerWarrantyFeeNet",
  "sellerCommissionNet",
  "managerFeeNet",
  "managerWarrantyFeeNet",
  "marketingNet",
  "additionalServicesNet",
  "managerOverrideNet",
  "managerOverridePerOwnerNet",
  "managerOverrideGrossNet",
  "managerOverrideGrossPerOwnerNet",
] as const;

const SUBSIDY_TOTAL_FIELDS = [
  "pvNet",
  "storageNet",
  "emsNet",
  "storageSubsidy",
  "euBonus",
  "emsBonus",
  "total",
  "programCap",
  "storageCapByKwh",
  "maxStorageSubsidy",
  "qualifyingStorageCost",
  "qualifyingVat",
  "newPvPowerKw",
  "totalPvPowerForSubsidyKw",
  "requiredStorageCapacityKwh",
  "storageCapacityKwh",
] as const;

function multiplyNumber(value: unknown, count: number) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return value;
  }

  return Math.round(parsedValue * count * 100) / 100;
}

function multiplyNumericFields<T extends JsonRecord>(
  source: T | null | undefined,
  fields: readonly string[],
  count: number
) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return source;
  }

  const result = { ...source } as JsonRecord;

  fields.forEach((field) => {
    if (result[field] !== null && result[field] !== undefined && result[field] !== "") {
      result[field] = multiplyNumber(result[field], count);
    }
  });

  return result as T;
}

function multiplyContractBreakdown(value: unknown, count: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as JsonRecord).map(([lineKey, lineValue]) => {
      if (!lineValue || typeof lineValue !== "object" || Array.isArray(lineValue)) {
        return [lineKey, lineValue];
      }

      return [
        lineKey,
        Object.fromEntries(
          Object.entries(lineValue as JsonRecord).map(([valueKey, numericValue]) => [
            valueKey,
            typeof numericValue === "number"
              ? multiplyNumber(numericValue, count)
              : numericValue,
          ])
        ),
      ];
    })
  );
}

function multiplyAdditionalServices(value: unknown, count: number) {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return item;
    }

    const service = item as JsonRecord;
    const quantity = Math.max(1, Number(service.quantity || 1));
    const unitNet = Number(service.priceNet ?? service.price_net ?? 0);
    const currentTotalNet = Number(
      service.totalNet ?? service.total_net ?? (Number.isFinite(unitNet) ? unitNet * quantity : 0)
    );
    const currentTotalGross = Number(service.totalGross ?? service.total_gross ?? 0);

    return {
      ...service,
      quantity: multiplyNumber(quantity, count),
      ...(Number.isFinite(currentTotalNet) && currentTotalNet > 0
        ? { totalNet: multiplyNumber(currentTotalNet, count) }
        : {}),
      ...(Number.isFinite(currentTotalGross) && currentTotalGross > 0
        ? { totalGross: multiplyNumber(currentTotalGross, count) }
        : {}),
    };
  });
}

function multiplyCalculatorResult(value: unknown, count: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const source = value as JsonRecord;
  const result = multiplyNumericFields(source, RESULT_TOTAL_FIELDS, count) as JsonRecord;
  const subsidyAllocation = multiplyNumericFields(
    source.subsidyAllocation as JsonRecord | null | undefined,
    SUBSIDY_TOTAL_FIELDS,
    count
  );
  const contractBreakdown = multiplyContractBreakdown(source.contractBreakdown, count);
  const additionalServices = multiplyAdditionalServices(source.additionalServices, count);

  return {
    ...result,
    installationCount: count,
    identicalSetCount: count,
    subsidyAllocation,
    contractBreakdown,
    additionalServices,
    breakdown: Array.isArray(source.breakdown)
      ? source.breakdown.map((item: unknown) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return item;
          const breakdownItem = item as JsonRecord;
          const label = String(breakdownItem.label || "");
          return {
            ...breakdownItem,
            label: label.replace(
              /\bx\s+(\d+(?:[.,]\d+)?)\s*(szt\.?|mb|m2|m²|kpl\.?)\b/i,
              (_match, quantity: string, unit: string) => {
                const multipliedQuantity = multiplyNumber(
                  Number(quantity.replace(",", ".")),
                  count
                );
                return `x ${multipliedQuantity} ${unit}`;
              }
            ),
            value: multiplyNumber(breakdownItem.value, count),
          };
        })
      : source.breakdown,
  };
}

export function normalizeInstallationCount(value: unknown) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return 1;
  }

  return Math.min(Math.max(Math.floor(parsedValue), 1), MAX_INSTALLATION_COUNT);
}

export function getOfferInstallationCount(offer: unknown) {
  const offerRecord = (offer && typeof offer === "object" ? offer : {}) as JsonRecord;
  const offerData = (offerRecord.offer_data || {}) as JsonRecord;
  const formData = (offerData.form || {}) as JsonRecord;
  const resultData = (offerData.result || {}) as JsonRecord;

  const candidates = [
    offerData.installationCount,
    offerData.identicalSetCount,
    offerData.pdfQuantity,
    formData.installationCount,
    formData.identicalSetCount,
    formData.pdfQuantity,
    resultData.installationCount,
    resultData.identicalSetCount,
    offerRecord.installationCount,
    offerRecord.installation_count,
  ];

  const savedValue = candidates.find(
    (candidate) => candidate !== null && candidate !== undefined && candidate !== ""
  );

  return normalizeInstallationCount(savedValue);
}

export function getSaleInstallationCount(sale: unknown) {
  const saleRecord = (sale && typeof sale === "object" ? sale : {}) as JsonRecord;
  const customerData = (saleRecord.customer_data || {}) as JsonRecord;

  return normalizeInstallationCount(
    customerData.installation_count ??
      customerData.installationCount ??
      getOfferInstallationCount((saleRecord.offer_snapshot || saleRecord.offer_data || {}) as JsonRecord)
  );
}

export function multiplyFinancialRecord<T extends JsonRecord>(value: T, count: number) {
  const normalizedCount = normalizeInstallationCount(count);

  return Object.fromEntries(
    Object.entries(value).map(([key, fieldValue]) => [
      key,
      typeof fieldValue === "number"
        ? multiplyNumber(fieldValue, normalizedCount)
        : fieldValue,
    ])
  ) as T;
}

export function createSaleOfferSnapshot<T extends object>(offer: T, count: number) {
  const normalizedCount = normalizeInstallationCount(count);
  const offerRecord = offer as JsonRecord;
  const offerData = (offerRecord.offer_data || {}) as JsonRecord;
  const formData = (offerData.form || {}) as JsonRecord;
  const resultData = (offerData.result || {}) as JsonRecord;
  const multipliedResult = multiplyCalculatorResult(resultData, normalizedCount) as JsonRecord;
  const additionalServices = multiplyAdditionalServices(
    offerData.additionalServices || offerData.additional_services || resultData.additionalServices,
    normalizedCount
  );
  const multipliedContractBreakdown = multiplyContractBreakdown(
    offerData.contractBreakdown || offerData.contract_breakdown || resultData.contractBreakdown,
    normalizedCount
  );

  return {
    ...offerRecord,
    installationCount: normalizedCount,
    installation_count: normalizedCount,
    sale_price_net: multiplyNumber(offerRecord.sale_price_net, normalizedCount),
    sale_price_gross: multiplyNumber(offerRecord.sale_price_gross, normalizedCount),
    seller_margin: multiplyNumber(offerRecord.seller_margin, normalizedCount),
    company_margin: multiplyNumber(offerRecord.company_margin, normalizedCount),
    pv_power_kw: multiplyNumber(offerRecord.pv_power_kw, normalizedCount),
    panel_count: multiplyNumber(offerRecord.panel_count, normalizedCount),
    offer_data: {
      ...offerData,
      installationCount: normalizedCount,
      identicalSetCount: normalizedCount,
      pdfQuantity: normalizedCount,
      result: multipliedResult,
      contractBreakdown: multipliedContractBreakdown,
      contract_breakdown: multipliedContractBreakdown,
      additionalServices,
      additional_services: additionalServices,
      form: {
        ...formData,
        installationCount: normalizedCount,
        identicalSetCount: normalizedCount,
        panelCount: multiplyNumber(formData.panelCount, normalizedCount),
        contractBreakdown: multipliedContractBreakdown,
        additionalServices,
        additional_services: additionalServices,
      },
      perInstallation: {
        salePriceNet: offerRecord.sale_price_net,
        salePriceGross: offerRecord.sale_price_gross,
        sellerMargin: offerRecord.seller_margin,
        companyMargin: offerRecord.company_margin,
        pvPowerKw: offerRecord.pv_power_kw,
        panelCount: offerRecord.panel_count,
        storageCapacityKwh: resultData.storageCapacityKwh ?? null,
      },
    },
  } as unknown as T & JsonRecord;
}

export function formatInstallationItemQuantity(
  label: unknown,
  count: number,
  unit = "szt."
) {
  const normalizedLabel = String(label || "").trim();
  const normalizedCount = normalizeInstallationCount(count);

  if (!normalizedLabel || normalizedCount <= 1) {
    return normalizedLabel;
  }

  return `${normalizedCount} ${unit} · ${normalizedLabel}`;
}
