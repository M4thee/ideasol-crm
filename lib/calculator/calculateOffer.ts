export type CalculatorCatalog = {
  panels: Record<string, PanelItem>;
  inverters: InverterItem[];
  storages: Record<string, StorageItem>;
};

export type CalculatorCurrentUser = {
  id?: string | null;
  role?: string | null;
  manager_id?: string | null;
  display_name?: string | null;
  email?: string | null;
} | null;

export type CalculatorSettingsRow = {
  installation_pv_per_kw?: number | null;
  protections_cost?: number | null;
  wiring_cost?: number | null;
  transport_cost?: number | null;
  documentation_cost?: number | null;
  ems_cost?: number | null;
  warranty_percent?: number | null;
  marketing_cost?: number | null;
  owners_count?: number | null;
  pv_small_per_kw?: number | null;
  pv_small_fixed?: number | null;
  pv_large_per_kw?: number | null;
  pv_large_fixed?: number | null;
  storage_per_owner?: number | null;
  manager_fee_percent?: number | null;
} | null;

export type CalculateOfferInput = {
  body: any;
  catalog: CalculatorCatalog;
  currentUser?: CalculatorCurrentUser;
  settingsRow?: CalculatorSettingsRow;
  nodeEnv?: string;
};
export type PanelItem = {
  name: string;
  displayName: string;
  powerWp: number;
  priceNet: number;
  catalogCardUrl?: string | null;
};

export type InverterItem = {
  name: string;
  displayName: string;
  type: string;
  batteryVoltageType?: "low_voltage" | "high_voltage" | null;
  maxPvKw: number;
  priceNet: number;
  catalogCardUrl?: string | null;
};

export type StorageItem = {
  name: string;
  displayName: string;
  capacityKwh: number;
  voltageType?: "low_voltage" | "high_voltage";
  priceNet: number;
  installationNet: number;
  catalogCardUrl?: string | null;
};

type AdditionalServiceInput = {
  id?: number;
  name?: string;
  price_net?: number;
  priceNet?: number;
  allows_quantity?: boolean;
  allowsQuantity?: boolean;
  quantity?: number;
};

const FALLBACK_PANELS: Record<string, PanelItem> = {
  AMERISOLAR_450_FB: {
    name: "AMERISOLAR 450 FB",
    displayName: "AMERISOLAR 450 FB",
    powerWp: 450,
    priceNet: 230,
  },
  HORAY_435_BIFACIAL: {
    name: "HORAY 435 BIFACIAL",
    displayName: "HORAY 435 BIFACIAL",
    powerWp: 435,
    priceNet: 240,
  },
};

const FALLBACK_INVERTERS: InverterItem[] = [
  { maxPvKw: 5.5, name: "Deye SUN-5K-SG04LP3-EU", displayName: "Deye SUN-5K-SG04LP3-EU", type: "hybrid", priceNet: 5223.25 },
  { maxPvKw: 6.8, name: "Deye SUN-6K-SG04LP3-EU", displayName: "Deye SUN-6K-SG04LP3-EU", type: "hybrid", priceNet: 5359.25 },
  { maxPvKw: 8.8, name: "Deye SUN-8K-SG04LP3-EU", displayName: "Deye SUN-8K-SG04LP3-EU", type: "hybrid", priceNet: 5478.25 },
  { maxPvKw: 10.8, name: "Deye SUN-10K-SG05LP3-EU", displayName: "Deye SUN-10K-SG05LP3-EU", type: "hybrid", priceNet: 5631.25 },
  { maxPvKw: 12.8, name: "Deye SUN-12K-SG05LP3-EU", displayName: "Deye SUN-12K-SG05LP3-EU", type: "hybrid", priceNet: 5780 },
  { maxPvKw: 14.8, name: "Deye SUN-14K-SG05LP3-EU-SM2", displayName: "Deye SUN-14K-SG05LP3-EU-SM2", type: "hybrid", priceNet: 7089 },
  { maxPvKw: 15.8, name: "Deye SUN-15K-SG05LP3-EU-SM2", displayName: "Deye SUN-15K-SG05LP3-EU-SM2", type: "hybrid", priceNet: 6630 },
  { maxPvKw: 18, name: "Deye SUN-16K-SG05LP3-EU-SM2", displayName: "Deye SUN-16K-SG05LP3-EU-SM2", type: "hybrid", priceNet: 7650 },
  { maxPvKw: 999, name: "Deye SUN-20K-SG05LP3-EU-SM2", displayName: "Deye SUN-20K-SG05LP3-EU-SM2", type: "hybrid", priceNet: 8946.25 },
  { maxPvKw: 5.5, name: "Falownik Sieciowy 5K", displayName: "Falownik Sieciowy 5K", type: "ongrid", priceNet: 1000 },
  { maxPvKw: 6.8, name: "Falownik Sieciowy 6K", displayName: "Falownik Sieciowy 6K", type: "ongrid", priceNet: 1000 },
  { maxPvKw: 8.8, name: "Falownik Sieciowy 8K", displayName: "Falownik Sieciowy 8K", type: "ongrid", priceNet: 1000 },
  { maxPvKw: 10.8, name: "Falownik Sieciowy 10K", displayName: "Falownik Sieciowy 10K", type: "ongrid", priceNet: 1000 },
  { maxPvKw: 12.8, name: "Falownik Sieciowy 12K", displayName: "Falownik Sieciowy 12K", type: "ongrid", priceNet: 1000 },
  { maxPvKw: 14.8, name: "Falownik Sieciowy 14K", displayName: "Falownik Sieciowy 14K", type: "ongrid", priceNet: 1000 },
  { maxPvKw: 15.8, name: "Falownik Sieciowy 15K", displayName: "Falownik Sieciowy 15K", type: "ongrid", priceNet: 1000 },
  { maxPvKw: 18, name: "Falownik Sieciowy 16K", displayName: "Falownik Sieciowy 16K", type: "ongrid", priceNet: 1000 },
  { maxPvKw: 999, name: "Falownik Sieciowy 20K", displayName: "Falownik Sieciowy 20K", type: "ongrid", priceNet: 1000 },
];

const FALLBACK_STORAGES: Record<string, StorageItem> = {
  none: {
    name: "Brak",
    displayName: "Brak",
    capacityKwh: 0,
    voltageType: "low_voltage",
    priceNet: 0,
    installationNet: 0,
  },
  ZBPOWER_10: {
    name: "ZBPOWER ZB-G512200 10 kWh",
    displayName: "ZBPOWER ZB-G512200 10 kWh",
    capacityKwh: 10,
    voltageType: "low_voltage",
    priceNet: 4394.5,
    installationNet: 1500,
  },
  ZBPOWER_16: {
    name: "ZBPOWER ZB-G512314 16 kWh",
    displayName: "ZBPOWER ZB-G512314 16 kWh",
    capacityKwh: 16,
    voltageType: "low_voltage",
    priceNet: 5372,
    installationNet: 1500,
  },
};

const ROOF_PLACEHOLDERS = {
  blacha: 1500,
  dachowka: 2000,
  papa: 2200,
  grunt: 4500,
};

const PLACEHOLDERS_NET = {
  protections: 1500,
  wiring: 800,
  transport: 500,
  documentation: 700,
  ems: 1200,
};

function getNumberOverride(value: unknown, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function clampPercent(value: number) {
  return Math.min(Math.max(value, 0), 90);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function grossFromNet(netValue: number, vatRate: number) {
  return roundMoney(netValue * (1 + vatRate / 100));
}


function beforeDiscountFromAfterDiscountGross(grossAfterDiscount: number) {
  return roundMoney(grossAfterDiscount * 1.1111);
}

function getStorageVoltageDescription(storage: StorageItem) {
  return storage.voltageType === "high_voltage"
    ? "wysokonapięciowy"
    : "niskonapięciowy";
}

function getStorageDisplayName(storage: StorageItem) {
  const baseName = storage.displayName || storage.name;

  if (!storage.capacityKwh || storage.capacityKwh <= 0 || baseName === "Brak") {
    return baseName;
  }

  return `${baseName} (${getStorageVoltageDescription(storage)})`;
}

function getInverterBatteryVoltageType(inverter: InverterItem) {
  if (inverter.type !== "hybrid") {
    return null;
  }
  return inverter.batteryVoltageType || "low_voltage";
}

function getBatteryVoltageDescription(voltageType: "low_voltage" | "high_voltage" | null) {
  if (voltageType === "high_voltage") {
    return "wysokonapięciowy";
  }
  if (voltageType === "low_voltage") {
    return "niskonapięciowy";
  }
  return "nie dotyczy";
}

function isInverterCompatibleWithStorage(
  inverter: InverterItem,
  storageVoltageType: "low_voltage" | "high_voltage" | null
) {
  if (!storageVoltageType) {
    return true;
  }
  if (inverter.type !== "hybrid") {
    return false;
  }
  return getInverterBatteryVoltageType(inverter) === storageVoltageType;
}

function buildContractBreakdown(params: {
  includeSubsidy: boolean;
  hasPv: boolean;
  hasStorageSelected: boolean;
  shouldAddEms: boolean;
  vatRate: number;
  finalNet: number;
  additionalServicesNet: number;
  panelsCostNet: number;
  inverterCostNet: number;
  pvInstallationNet: number;
  roofExtraNet: number;
  storageCostNet: number;
  storageInstallationNet: number;
  protectionsNet: number;
  transportNet: number;
  documentationNet: number;
  marketingNet: number;
  managerFeeNet: number;
  managerMarginsNet: number;
  sellerCommissionNet: number;
  subsidyAllocation: {
    enabled: boolean;
    pvNet: number;
    storageNet: number;
    emsNet: number;
  };
}) {
  const backupAfterDiscountGross = 1;
  const backupBeforeDiscountGross = 3000;
  const backupAfterDiscountNet = roundMoney(backupAfterDiscountGross / (1 + params.vatRate / 100));

  const emsContractNet = params.shouldAddEms ? 4000 : 0;

  let pvAfterDiscountNet = 0;
  let storageAfterDiscountNet = 0;
  let emsAfterDiscountNet = emsContractNet;
  let additionalServicesAfterDiscountNet = params.additionalServicesNet;

  if (params.includeSubsidy && params.subsidyAllocation.enabled) {
    pvAfterDiscountNet = params.hasPv ? Math.max(1 / (1 + params.vatRate / 100), params.subsidyAllocation.pvNet) : 0;
    storageAfterDiscountNet = params.hasStorageSelected ? params.subsidyAllocation.storageNet : 0;
    emsAfterDiscountNet = params.shouldAddEms ? Math.max(emsContractNet, params.subsidyAllocation.emsNet) : 0;
  } else {
    const sharedCostsNet =
      params.protectionsNet +
      params.transportNet +
      params.documentationNet +
      params.marketingNet +
      params.managerFeeNet +
      params.managerMarginsNet +
      params.sellerCommissionNet;

    const sharedPvPartNet = params.hasPv && params.hasStorageSelected ? sharedCostsNet / 2 : params.hasPv ? sharedCostsNet : 0;
    const sharedStoragePartNet = params.hasPv && params.hasStorageSelected ? sharedCostsNet / 2 : params.hasStorageSelected ? sharedCostsNet : 0;

    pvAfterDiscountNet = params.hasPv
      ? params.panelsCostNet + params.inverterCostNet + params.pvInstallationNet + params.roofExtraNet + sharedPvPartNet
      : 0;

    storageAfterDiscountNet = params.hasStorageSelected
      ? params.storageCostNet + params.storageInstallationNet + sharedStoragePartNet
      : 0;

    if (params.shouldAddEms) {
      const emsDeltaNet = Math.max(emsContractNet - 1200, 0);
      const correctionBaseNet = pvAfterDiscountNet + storageAfterDiscountNet;

      if (correctionBaseNet > 0) {
        const pvShare = pvAfterDiscountNet / correctionBaseNet;
        const pvCorrection = roundMoney(emsDeltaNet * pvShare);
        const storageCorrection = roundMoney(emsDeltaNet - pvCorrection);

        pvAfterDiscountNet = Math.max(0, pvAfterDiscountNet - pvCorrection);
        storageAfterDiscountNet = Math.max(0, storageAfterDiscountNet - storageCorrection);
      }
    }
  }

  const knownNet = pvAfterDiscountNet + storageAfterDiscountNet + emsAfterDiscountNet + backupAfterDiscountNet + additionalServicesAfterDiscountNet;
  const netDifference = roundMoney(params.finalNet - knownNet);

  if (params.hasPv) {
    pvAfterDiscountNet = roundMoney(pvAfterDiscountNet + netDifference);
  } else if (params.hasStorageSelected) {
    storageAfterDiscountNet = roundMoney(storageAfterDiscountNet + netDifference);
  } else {
    additionalServicesAfterDiscountNet = roundMoney(additionalServicesAfterDiscountNet + netDifference);
  }

  const makeLine = (netAfterDiscount: number, fixedBeforeDiscountGross?: number) => {
    const afterDiscountGross = grossFromNet(Math.max(0, netAfterDiscount), params.vatRate);
    const beforeDiscountGross = fixedBeforeDiscountGross ?? beforeDiscountFromAfterDiscountGross(afterDiscountGross);

    return {
      netAfterDiscount: roundMoney(Math.max(0, netAfterDiscount)),
      grossAfterDiscount: afterDiscountGross,
      grossBeforeDiscount: beforeDiscountGross,
    };
  };

  return {
    pv: makeLine(pvAfterDiscountNet),
    storage: makeLine(storageAfterDiscountNet),
    ems: makeLine(emsAfterDiscountNet),
    backup: makeLine(backupAfterDiscountNet, backupBeforeDiscountGross),
    additionalServices: makeLine(additionalServicesAfterDiscountNet),
    total: {
      netAfterDiscount: roundMoney(params.finalNet),
      grossAfterDiscount: grossFromNet(params.finalNet, params.vatRate),
      grossBeforeDiscount: beforeDiscountFromAfterDiscountGross(grossFromNet(params.finalNet, params.vatRate)),
    },
  };
}

function buildPricing(
  body: any,
  catalog: {
    panels: Record<string, PanelItem>;
    inverters: InverterItem[];
    storages: Record<string, StorageItem>;
  }
) {
  const overrides = body.pricingOverrides || {};

  const effectivePanels =
    catalog?.panels && Object.keys(catalog.panels).length > 0
      ? catalog.panels
      : FALLBACK_PANELS;

  const effectiveInverters =
    Array.isArray(catalog?.inverters) && catalog.inverters.length > 0
      ? catalog.inverters
      : FALLBACK_INVERTERS;

  const effectiveStorages =
    catalog?.storages && Object.keys(catalog.storages).length > 0
      ? catalog.storages
      : FALLBACK_STORAGES;

  const panels = Object.fromEntries(
    Object.entries(effectivePanels).map(([code, panel]) => [
      code,
      {
        ...panel,
        priceNet: getNumberOverride(
          overrides?.panels?.[code]?.priceNet,
          panel.priceNet
        ),
      },
    ])
  ) as Record<string, PanelItem>;

  const inverters = effectiveInverters.map((inverter) => ({
    ...inverter,
    priceNet: getNumberOverride(
      overrides?.inverters?.[inverter.name]?.priceNet,
      inverter.priceNet
    ),
  }));

  const storages = Object.fromEntries(
    Object.entries(effectiveStorages).map(([code, storage]) => [
      code,
      {
        ...storage,
        priceNet: getNumberOverride(
          overrides?.storages?.[code]?.priceNet,
          storage.priceNet
        ),
        installationNet: getNumberOverride(
          overrides?.storages?.[code]?.installationNet,
          storage.installationNet
        ),
      },
    ])
  ) as Record<string, StorageItem>;

  const roofPlaceholders = {
    blacha: getNumberOverride(overrides?.roof?.blacha, ROOF_PLACEHOLDERS.blacha),
    dachowka: getNumberOverride(overrides?.roof?.dachowka, ROOF_PLACEHOLDERS.dachowka),
    papa: getNumberOverride(overrides?.roof?.papa, ROOF_PLACEHOLDERS.papa),
    grunt: getNumberOverride(overrides?.roof?.grunt, ROOF_PLACEHOLDERS.grunt),
  };

  const placeholders = {
    protections: getNumberOverride(
      overrides?.placeholders?.protections,
      PLACEHOLDERS_NET.protections
    ),
    wiring: getNumberOverride(overrides?.placeholders?.wiring, PLACEHOLDERS_NET.wiring),
    transport: getNumberOverride(
      overrides?.placeholders?.transport,
      PLACEHOLDERS_NET.transport
    ),
    documentation: getNumberOverride(
      overrides?.placeholders?.documentation,
      PLACEHOLDERS_NET.documentation
    ),
    ems: getNumberOverride(overrides?.placeholders?.ems, PLACEHOLDERS_NET.ems),
  };

  const operatorPercent = clampPercent(
    getNumberOverride(overrides?.operator?.percent, 15)
  );

  const marketingNet = getNumberOverride(overrides?.margins?.marketing, 500);
  const margins = {
    marketingNet,

    ownersCount: getNumberOverride(
      overrides?.margins?.ownersCount,
      3
    ),

    pvSmallPerKw: getNumberOverride(
      overrides?.margins?.pvSmallPerKw,
      250
    ),

    pvSmallFixed: getNumberOverride(
      overrides?.margins?.pvSmallFixed,
      500
    ),

    pvLargePerKw: getNumberOverride(
      overrides?.margins?.pvLargePerKw,
      150
    ),

    pvLargeFixed: getNumberOverride(
      overrides?.margins?.pvLargeFixed,
      700
    ),

    storagePerOwner: getNumberOverride(
      overrides?.margins?.storagePerOwner,
      500
    ),

    managerFeeNet: getNumberOverride(
      overrides?.margins?.managerFeeNet,
      500
    ),
  };

  return {
    panels,
    inverters,
    storages,
    roofPlaceholders,
    placeholders,
    operatorPercent,
    margins,
    pvInstallationPerKwNet: getNumberOverride(
      overrides?.installation?.pvPerKwNet,
      500
    ),
  };
}

function calculateManagerOverrideNet(params: {
  pvPowerKw: number;
  hasPv: boolean;
  hasStorage: boolean;
  isStorageOnly: boolean;
  pricing: ReturnType<typeof buildPricing>;
}) {
  const { pvPowerKw, hasPv, hasStorage, isStorageOnly, pricing } = params;
  const config = pricing.margins;
  const ownersCount = Math.max(0, config.ownersCount);

  let pvOverridePerOwnerNet = 0;

  if (hasPv) {
    const isSmallPv = pvPowerKw <= 5;

    pvOverridePerOwnerNet = isSmallPv
      ? pvPowerKw * config.pvSmallPerKw + config.pvSmallFixed
      : pvPowerKw * config.pvLargePerKw + config.pvLargeFixed;
  }

  let storageOverridePerOwnerNet = 0;

  if (hasStorage) {
    storageOverridePerOwnerNet = config.storagePerOwner;
  }

  const perOwnerGrossBeforeOperatorNet =
    pvOverridePerOwnerNet + storageOverridePerOwnerNet;

  const totalGrossBeforeOperatorNet =
    perOwnerGrossBeforeOperatorNet * ownersCount;

  return {
    ownersCount,
    perOwnerGrossBeforeOperatorNet,
    totalGrossBeforeOperatorNet,
    pvOverridePerOwnerNet,
    storageOverridePerOwnerNet,
  };
}

export function calculateOffer(input: CalculateOfferInput) {
  let body = { ...input.body };
  const catalog = input.catalog;
  const currentUser = input.currentUser || null;
  const settingsRow = input.settingsRow || null;
  const nodeEnv = input.nodeEnv || "production";

  const currentOverrides = body.pricingOverrides || {};
  body = {
    ...body,
    pricingOverrides: {
      ...currentOverrides,
      installation: {
        ...(currentOverrides.installation || {}),
        pvPerKwNet: Number(
          settingsRow?.installation_pv_per_kw ??
          currentOverrides?.installation?.pvPerKwNet ??
          500
        ),
      },
      placeholders: {
        ...(currentOverrides.placeholders || {}),
        protections: Number(
          settingsRow?.protections_cost ??
          currentOverrides?.placeholders?.protections ??
          1500
        ),
        wiring: Number(
          settingsRow?.wiring_cost ?? currentOverrides?.placeholders?.wiring ?? 800
        ),
        transport: Number(
          settingsRow?.transport_cost ??
          currentOverrides?.placeholders?.transport ??
          500
        ),
        documentation: Number(
          settingsRow?.documentation_cost ??
          currentOverrides?.placeholders?.documentation ??
          700
        ),
        ems: Number(
          settingsRow?.ems_cost ?? currentOverrides?.placeholders?.ems ?? 1200
        ),
      },
      operator: {
        ...(currentOverrides.operator || {}),
        percent: Number(
          settingsRow?.warranty_percent ?? currentOverrides?.operator?.percent ?? 15
        ),
      },
      margins: {
        ...(currentOverrides.margins || {}),
        marketing: Number(
          settingsRow?.marketing_cost ?? currentOverrides?.margins?.marketing ?? 500
        ),

        ownersCount: Number(
          settingsRow?.owners_count ??
          currentOverrides?.margins?.ownersCount ??
          3
        ),

        pvSmallPerKw: Number(
          settingsRow?.pv_small_per_kw ??
          currentOverrides?.margins?.pvSmallPerKw ??
          250
        ),

        pvSmallFixed: Number(
          settingsRow?.pv_small_fixed ??
          currentOverrides?.margins?.pvSmallFixed ??
          500
        ),

        pvLargePerKw: Number(
          settingsRow?.pv_large_per_kw ??
          currentOverrides?.margins?.pvLargePerKw ??
          150
        ),

        pvLargeFixed: Number(
          settingsRow?.pv_large_fixed ??
          currentOverrides?.margins?.pvLargeFixed ??
          700
        ),

        storagePerOwner: Number(
          settingsRow?.storage_per_owner ??
          currentOverrides?.margins?.storagePerOwner ??
          500
        ),

        // Historyczna nazwa kolumny w bazie to manager_fee_percent,
        // ale w kalkulatorze używamy tej wartości jako stałej kwoty netto manager fee.
        managerFeeNet: Number(
          settingsRow?.manager_fee_percent ??
          currentOverrides?.margins?.managerFeeNet ??
          500
        ),
      },
    },
  };

  const pricing = buildPricing(body, catalog);

  const offerType = String(body.offerType || "pv_storage");
  const isStorageOnly = offerType === "storage";
  const isPvOnly = offerType === "pv";
  const hasPv = !isStorageOnly;

  const billingSystem =
    body.billingSystem === "net_metering"
      ? "net_metering"
      : "net_billing";

  const shouldAddEms = Boolean(body.withEms);
  const includeSubsidy = body.includeSubsidy === false ? false : true;
  const existingPvPowerKw = Math.max(0, Number(body.existingPvPowerKw || 0));

  const additionalServicesSource = Array.isArray(body.additionalServices)
    ? body.additionalServices
    : Array.isArray(body.additional_services)
      ? body.additional_services
      : [];

  const additionalServices = (additionalServicesSource as AdditionalServiceInput[])
    .map((service) => {
      const priceNetValue = Number(service.price_net ?? service.priceNet ?? 0);
      const priceNet = Number.isFinite(priceNetValue) ? priceNetValue : 0;
      const quantity = service.allows_quantity || service.allowsQuantity
        ? Math.max(1, Math.round(Number(service.quantity || 1)))
        : 1;

      return {
        id: service.id ?? null,
        name: String(service.name || "Usługa dodatkowa"),
        priceNet,
        quantity,
        totalNet: roundMoney(priceNet * quantity),
      };
    })
    .filter((service) => service.totalNet > 0);

  const additionalServicesNet = roundMoney(
    additionalServices.reduce((sum, service) => sum + service.totalNet, 0)
  );

  let panel = pricing.panels[body.panelModel as keyof typeof pricing.panels];
  const requestedStorageKey = isPvOnly ? "none" : body.storage;
  let storage = pricing.storages[requestedStorageKey as keyof typeof pricing.storages];

  if (!panel && !isStorageOnly) {
    panel = Object.values(pricing.panels)[0];
  }

  if (!storage) {
    const availableStorages = Object.values(pricing.storages);

    storage = isPvOnly
      ? pricing.storages.none || availableStorages[0]
      : availableStorages.find(
        (catalogStorage) =>
          catalogStorage.displayName !== "Brak" && catalogStorage.capacityKwh > 0
      ) || pricing.storages.none || availableStorages[0];
  }

  if ((!panel && !isStorageOnly) || !storage) {
    throw new Error(
      `Nieprawidłowe dane formularza: panelModel=${String(body.panelModel)}, storage=${String(requestedStorageKey)}, offerType=${String(offerType)}, panelKeys=${Object.keys(pricing.panels).slice(0, 8).join(",")}, storageKeys=${Object.keys(pricing.storages).slice(0, 8).join(",")}`
    );
  }

  const panelCount = Number(body.panelCount || 0);
  const sellerMarkupNet = Number(body.sellerMarkup || 0);
  const vatRate = Number(body.vatRate || 8);
  const roofType = body.roofType as keyof typeof pricing.roofPlaceholders;

  const pvPowerKw = isStorageOnly
    ? 0
    : Number(((panelCount * panel.powerWp) / 1000).toFixed(2));

  // Do kosztów PV i marż używamy tylko nowej mocy PV.
  // Do automatycznego doboru falownika przy rozbudowie używamy łącznej mocy:
  // istniejąca instalacja PV + nowa rozbudowa.
  const inverterSizingPvPowerKw = Number((existingPvPowerKw + pvPowerKw).toFixed(2));

  const hasStorageSelected = storage.displayName !== "Brak";
  const selectedStorageVoltageType = hasStorageSelected
    ? storage.voltageType || "low_voltage"
    : null;
  const selectedInverterName = String(body.selectedInverterName || "auto");

  const manuallySelectedInverter =
    selectedInverterName !== "auto" && selectedInverterName !== "none"
      ? pricing.inverters.find((item) => item.name === selectedInverterName)
      : null;

  const compatibleManuallySelectedInverter =
    manuallySelectedInverter &&
    isInverterCompatibleWithStorage(manuallySelectedInverter, selectedStorageVoltageType)
      ? manuallySelectedInverter
      : null;

  const autoInverterType = isStorageOnly || hasStorageSelected ? "hybrid" : "ongrid";

  const compatibleAutomaticInverters = pricing.inverters.filter(
    (item) =>
      item.type === autoInverterType &&
      isInverterCompatibleWithStorage(item, selectedStorageVoltageType)
  );

  const automaticallySelectedInverter = compatibleAutomaticInverters.find(
    (item) => inverterSizingPvPowerKw <= item.maxPvKw
  );

  const inverter =
    selectedInverterName === "none"
      ? { name: "Brak", priceNet: 0 }
      : compatibleManuallySelectedInverter ||
        automaticallySelectedInverter ||
        { name: "Brak", priceNet: 0 };

  const panelsCostNet = isStorageOnly ? 0 : panelCount * panel.priceNet;
  const inverterCostNet = inverter.priceNet;
  const pvInstallationNet = isStorageOnly
    ? 0
    : pvPowerKw * pricing.pvInstallationPerKwNet;

  const roofExtraNet = isStorageOnly
    ? 0
    : pricing.roofPlaceholders[roofType] ?? 2000;

  const emsNet = shouldAddEms ? pricing.placeholders.ems : 0;

  const placeholdersTotalNet =
    pricing.placeholders.protections +
    pricing.placeholders.wiring +
    pricing.placeholders.transport +
    pricing.placeholders.documentation +
    emsNet;

  const purchaseCostNet =
    panelsCostNet +
    inverterCostNet +
    pvInstallationNet +
    roofExtraNet +
    storage.priceNet +
    storage.installationNet +
    placeholdersTotalNet +
    additionalServicesNet;

  const managerOverride = calculateManagerOverrideNet({
    pvPowerKw,
    hasPv,
    hasStorage: hasStorageSelected,
    isStorageOnly,
    pricing,
  });

  const operatorPercent = pricing.operatorPercent;

  const grossManagerMarginsBeforeOperatorNet =
    managerOverride.totalGrossBeforeOperatorNet;

  const marketingNet = pricing.margins.marketingNet;

  const shouldApplyManagerFee = Boolean(
    currentUser?.role === "seller" && currentUser?.manager_id
  );

  let managerFeeMultiplier = 0;

  if (shouldApplyManagerFee) {
    if (hasPv) {
      managerFeeMultiplier += 1;
    }

    if (hasStorageSelected) {
      managerFeeMultiplier += 1;
    }
  }

  const managerFeeNet = Math.round(
    pricing.margins.managerFeeNet * managerFeeMultiplier
  );

  const sellerCommissionNet = Math.max(
    0,
    sellerMarkupNet
  );

  const operatorMultiplier = 1 - operatorPercent / 100;

  const finalNet = Math.round(
    operatorMultiplier > 0
      ? (
        purchaseCostNet +
        grossManagerMarginsBeforeOperatorNet +
        sellerCommissionNet +
        marketingNet +
        managerFeeNet
      ) / operatorMultiplier
      : purchaseCostNet +
        grossManagerMarginsBeforeOperatorNet +
        sellerCommissionNet +
        marketingNet +
        managerFeeNet
  );

  const operatorFeeNet = Math.round(finalNet * (operatorPercent / 100));
  const sellerWarrantyFeeNet = Math.round(
    sellerCommissionNet * (operatorPercent / 100)
  );

  const companyMargin = Math.max(
    0,
    Math.round(
      finalNet -
      purchaseCostNet -
      sellerCommissionNet -
      marketingNet -
      managerFeeNet -
      operatorFeeNet
    )
  );

  const managerWarrantyFeeNet = operatorFeeNet;

  const operatorFeePerOwnerNet =
    managerOverride.ownersCount > 0
      ? Math.round(managerWarrantyFeeNet / managerOverride.ownersCount)
      : 0;

  const managerMarginAfterOperatorTotalNet = companyMargin;

  const managerMarginAfterOperatorPerOwnerNet =
    managerOverride.ownersCount > 0
      ? Math.round(managerMarginAfterOperatorTotalNet / managerOverride.ownersCount)
      : 0;

  const finalGross = Math.round(finalNet * (1 + vatRate / 100));


  const subsidyProgramCap = billingSystem === "net_billing" ? 16000 : 8000;
  const totalPvPowerForSubsidyKw = Number((existingPvPowerKw + pvPowerKw).toFixed(2));
  const requiredStorageCapacityKwh = Number((totalPvPowerForSubsidyKw * 2).toFixed(2));
  const hasStorageMinimumCapacity = hasStorageSelected && storage.capacityKwh >= 10;
  const hasRequiredStorageToPvRatio =
    hasStorageSelected &&
    totalPvPowerForSubsidyKw > 0 &&
    storage.capacityKwh >= requiredStorageCapacityKwh;
  const hasStorageForSubsidy =
    includeSubsidy && hasStorageMinimumCapacity && hasRequiredStorageToPvRatio;
  const storageCapByKwh = hasStorageForSubsidy ? storage.capacityKwh * 800 : 0;
  const maxStorageSubsidy = hasStorageForSubsidy
    ? Math.min(storageCapByKwh, subsidyProgramCap)
    : 0;

  const optimizedEmsNet = hasStorageForSubsidy && shouldAddEms
    ? Math.min(4000, finalNet)
    : 0;

  const availableForStorageAfterEmsNet = Math.max(finalNet - optimizedEmsNet, 0);
  const idealStorageNetForMaxSubsidy = maxStorageSubsidy / 0.3;

  const optimizedStorageNet = hasStorageForSubsidy
    ? Math.min(idealStorageNetForMaxSubsidy, availableForStorageAfterEmsNet)
    : 0;

  const storageSubsidy = hasStorageForSubsidy
    ? Math.min(
      optimizedStorageNet * 0.3,
      storageCapByKwh,
      subsidyProgramCap
    )
    : 0;

  const emsBonus = hasStorageForSubsidy && shouldAddEms
    ? Math.min(optimizedEmsNet * 0.5, 2000)
    : 0;

  const optimizedPvNet = hasStorageForSubsidy
    ? Math.max(finalNet - optimizedStorageNet - optimizedEmsNet, hasPv ? 1 / (1 + vatRate / 100) : 0)
    : 0;

  const subsidyTotal = Math.round(storageSubsidy + emsBonus);

  const subsidyAllocation = {
    enabled: hasStorageForSubsidy,
    requested: includeSubsidy,
    billingSystem,
    pvNet: Math.round(optimizedPvNet),
    storageNet: Math.round(optimizedStorageNet),
    emsNet: Math.round(optimizedEmsNet),
    storageSubsidy: Math.round(storageSubsidy),
    emsBonus: Math.round(emsBonus),
    total: subsidyTotal,
    programCap: subsidyProgramCap,
    storageCapByKwh: Math.round(storageCapByKwh),
    maxStorageSubsidy: Math.round(maxStorageSubsidy),
    existingPvPowerKw,
    newPvPowerKw: pvPowerKw,
    totalPvPowerForSubsidyKw,
    requiredStorageCapacityKwh,
    storageCapacityKwh: storage.capacityKwh,
    hasStorageMinimumCapacity,
    hasRequiredStorageToPvRatio,
  };

  const contractBreakdown = buildContractBreakdown({
    includeSubsidy,
    hasPv,
    hasStorageSelected,
    shouldAddEms,
    vatRate,
    finalNet,
    additionalServicesNet,
    panelsCostNet,
    inverterCostNet,
    pvInstallationNet,
    roofExtraNet,
    storageCostNet: storage.priceNet,
    storageInstallationNet: storage.installationNet,
    protectionsNet: pricing.placeholders.protections,
    transportNet: pricing.placeholders.transport,
    documentationNet: pricing.placeholders.documentation,
    marketingNet,
    managerFeeNet,
    managerMarginsNet: managerMarginAfterOperatorTotalNet,
    sellerCommissionNet,
    subsidyAllocation,
  });

  const storageDisplayName = getStorageDisplayName(storage);

  return {
    pvPowerKw,
    inverterSizingPvPowerKw,
    inverter: "displayName" in inverter ? inverter.displayName : inverter.name,
    inverterBatteryVoltageType:
      "type" in inverter && inverter.type === "hybrid"
        ? getInverterBatteryVoltageType(inverter as InverterItem)
        : null,
    inverterBatteryVoltageLabel:
      "type" in inverter && inverter.type === "hybrid"
        ? getBatteryVoltageDescription(getInverterBatteryVoltageType(inverter as InverterItem))
        : "nie dotyczy",
    energyStorage: storageDisplayName,
    storage: storageDisplayName,
    storageVoltageType: storage.voltageType || "low_voltage",
    storageVoltageLabel: getStorageVoltageDescription(storage),
    storageCapacityKwh: storage.capacityKwh,
    offerType,
    billingSystem,
    withEms: shouldAddEms,
    includeSubsidy,
    existingPvPowerKw,
    basePriceNet: Math.round(
      purchaseCostNet +
      grossManagerMarginsBeforeOperatorNet +
      marketingNet +
      managerFeeNet
    ),
    sellerMarkupNet,
    finalNet,
    finalGross,
    vatRate,
    companyMargin,
    operatorPercent,
    operatorFeeNet,
    operatorFeePerOwnerNet,
    sellerWarrantyFeeNet,
    sellerCommissionNet,
    managerFeeNet,
    managerWarrantyFeeNet,
    managerOwnersCount: managerOverride.ownersCount,
    marketingNet,
    subsidyProgramCap,
    subsidyAllocation,
    contractBreakdown,
    additionalServices,
    additionalServicesNet,
    managerOverrideNet: Math.round(managerMarginAfterOperatorTotalNet),
    managerOverridePerOwnerNet: Math.round(managerMarginAfterOperatorPerOwnerNet),
    managerOverrideGrossNet: Math.round(grossManagerMarginsBeforeOperatorNet),
    managerOverrideGrossPerOwnerNet: Math.round(
      managerOverride.perOwnerGrossBeforeOperatorNet
    ),
    adminPricingEnabled:
      nodeEnv === "development"
        ? true
        : currentUser?.role === "admin" ||
        currentUser?.role === "owner",
    breakdown: [
      ...(isStorageOnly
        ? [{ label: "Falownik", value: Math.round(inverterCostNet) }]
        : [
          { label: "Panele", value: Math.round(panelsCostNet) },
          { label: "Falownik", value: Math.round(inverterCostNet) },
          { label: "Montaż PV", value: Math.round(pvInstallationNet) },
          {
            label: "Konstrukcja / dach / grunt",
            value: Math.round(roofExtraNet),
          },
        ]),
      { label: "Magazyn energii", value: Math.round(storage.priceNet) },
      { label: "Montaż ME", value: Math.round(storage.installationNet) },
      {
        label: "Zabezpieczenia",
        value: Math.round(pricing.placeholders.protections),
      },
      {
        label: "Okablowanie",
        value: Math.round(pricing.placeholders.wiring),
      },
      {
        label: "Transport",
        value: Math.round(pricing.placeholders.transport),
      },
      {
        label: "Dokumentacja",
        value: Math.round(pricing.placeholders.documentation),
      },
      ...(shouldAddEms
        ? [
          {
            label: "System EMS",
            value: Math.round(emsNet),
          },
        ]
        : []),
      ...additionalServices.map((service) => ({
        label: service.quantity > 1 ? `${service.name} x ${service.quantity}` : service.name,
        value: Math.round(service.totalNet),
      })),
      {
        label: "Marketing",
        value: Math.round(marketingNet),
      },
      {
        label: "Manager Fee",
        value: Math.round(managerFeeNet),
      },
      {
        label: `Fundusz gwarancyjny ${operatorPercent}% od kwoty netto`,
        value: operatorFeeNet,
      },
      {
        label: "Marża wspólników sumarycznie",
        value: Math.round(managerMarginAfterOperatorTotalNet),
      },
      {
        label: `Marża wspólnik / osoba (${managerOverride.ownersCount} osoby)`,
        value: Math.round(managerMarginAfterOperatorPerOwnerNet),
      },
      {
        label: "Prowizja handlowca",
        value: Math.round(sellerCommissionNet),
      },
    ],
  };
}