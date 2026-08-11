export const CUSTOM_PANEL_CODE = "__CUSTOM_PANEL__";
export const CUSTOM_STORAGE_CODE = "__CUSTOM_STORAGE__";
export const CUSTOM_INVERTER_CODE = "__CUSTOM_INVERTER__";

export type CustomWarrantyDetails = {
  catalogCardUrl: string;
  warrantyGuarantor: string;
  warrantyPeriod: string;
};

export type CustomPanelEquipment = CustomWarrantyDetails & {
  displayName: string;
  powerWp: number;
  priceNet: number;
};

export type CustomInverterEquipment = CustomWarrantyDetails & {
  displayName: string;
  maxPvKw: number;
  priceNet: number;
  type: "ongrid" | "hybrid";
  batteryVoltageType: "low_voltage" | "high_voltage";
  isEu: boolean;
  hasEms: boolean;
};

export type CustomStorageEquipment = CustomWarrantyDetails & {
  displayName: string;
  capacityKwh: number;
  priceNet: number;
  voltageType: "low_voltage" | "high_voltage";
  isEu: boolean;
};

export type CustomEquipment = {
  panel: CustomPanelEquipment;
  inverter: CustomInverterEquipment;
  storage: CustomStorageEquipment;
};

const EMPTY_WARRANTY_DETAILS: CustomWarrantyDetails = {
  catalogCardUrl: "",
  warrantyGuarantor: "",
  warrantyPeriod: "",
};

export function createDefaultCustomEquipment(): CustomEquipment {
  return {
    panel: {
      ...EMPTY_WARRANTY_DETAILS,
      displayName: "",
      powerWp: 450,
      priceNet: 0,
    },
    inverter: {
      ...EMPTY_WARRANTY_DETAILS,
      displayName: "",
      maxPvKw: 10,
      priceNet: 0,
      type: "hybrid",
      batteryVoltageType: "low_voltage",
      isEu: false,
      hasEms: false,
    },
    storage: {
      ...EMPTY_WARRANTY_DETAILS,
      displayName: "",
      capacityKwh: 10,
      priceNet: 0,
      voltageType: "low_voltage",
      isEu: false,
    },
  };
}

function cleanText(value: unknown, maxLength = 240) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function nonNegativeNumber(value: unknown, label: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} musi być liczbą równą lub większą od 0.`);
  }

  return parsed;
}

function positiveNumber(value: unknown, label: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} musi być liczbą większą od 0.`);
  }

  return parsed;
}

function requiredName(value: unknown, label: string) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    throw new Error(`Uzupełnij pole „${label}”.`);
  }

  return cleaned;
}

function optionalHttpsUrl(value: unknown) {
  const cleaned = cleanText(value, 1000);

  if (!cleaned) return "";

  let parsed: URL;

  try {
    parsed = new URL(cleaned);
  } catch {
    throw new Error("Link do karty katalogowej musi być poprawnym adresem HTTPS.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Link do karty katalogowej musi zaczynać się od https://.");
  }

  return parsed.toString();
}

function normalizeWarrantyDetails(value: Partial<CustomWarrantyDetails> | undefined) {
  return {
    catalogCardUrl: optionalHttpsUrl(value?.catalogCardUrl),
    warrantyGuarantor: cleanText(value?.warrantyGuarantor),
    warrantyPeriod: cleanText(value?.warrantyPeriod),
  };
}

export function normalizeCustomEquipment(
  value: Partial<CustomEquipment> | null | undefined,
  options: {
    hasPv: boolean;
    hasStorage: boolean;
    clientHasOwnHybridInverter: boolean;
  }
): CustomEquipment {
  const source = value || {};
  const panelSource = source.panel || ({} as CustomPanelEquipment);
  const inverterSource = source.inverter || ({} as CustomInverterEquipment);
  const storageSource = source.storage || ({} as CustomStorageEquipment);

  const panel: CustomPanelEquipment = {
    ...normalizeWarrantyDetails(panelSource),
    displayName: options.hasPv
      ? requiredName(panelSource.displayName, "Nazwa wyświetlana panelu")
      : cleanText(panelSource.displayName),
    powerWp: options.hasPv
      ? positiveNumber(panelSource.powerWp, "Moc panelu")
      : nonNegativeNumber(panelSource.powerWp || 0, "Moc panelu"),
    priceNet: options.hasPv
      ? nonNegativeNumber(panelSource.priceNet, "Cena netto panelu")
      : nonNegativeNumber(panelSource.priceNet || 0, "Cena netto panelu"),
  };

  const storageVoltageType =
    storageSource.voltageType === "high_voltage" ? "high_voltage" : "low_voltage";

  const storage: CustomStorageEquipment = {
    ...normalizeWarrantyDetails(storageSource),
    displayName: options.hasStorage
      ? requiredName(storageSource.displayName, "Nazwa wyświetlana magazynu energii")
      : cleanText(storageSource.displayName),
    capacityKwh: options.hasStorage
      ? positiveNumber(storageSource.capacityKwh, "Pojemność magazynu energii")
      : nonNegativeNumber(storageSource.capacityKwh || 0, "Pojemność magazynu energii"),
    priceNet: options.hasStorage
      ? nonNegativeNumber(storageSource.priceNet, "Cena netto magazynu energii")
      : nonNegativeNumber(storageSource.priceNet || 0, "Cena netto magazynu energii"),
    voltageType: storageVoltageType,
    isEu: Boolean(storageSource.isEu),
  };

  const inverterType = inverterSource.type === "ongrid" ? "ongrid" : "hybrid";
  const inverterVoltageType =
    inverterSource.batteryVoltageType === "high_voltage" ? "high_voltage" : "low_voltage";
  const needsInverter = (options.hasPv || options.hasStorage) && !options.clientHasOwnHybridInverter;

  const inverter: CustomInverterEquipment = {
    ...normalizeWarrantyDetails(inverterSource),
    displayName: needsInverter
      ? requiredName(inverterSource.displayName, "Nazwa wyświetlana falownika")
      : cleanText(inverterSource.displayName),
    maxPvKw: needsInverter
      ? positiveNumber(inverterSource.maxPvKw, "Moc falownika")
      : nonNegativeNumber(inverterSource.maxPvKw || 0, "Moc falownika"),
    priceNet: needsInverter
      ? nonNegativeNumber(inverterSource.priceNet, "Cena netto falownika")
      : nonNegativeNumber(inverterSource.priceNet || 0, "Cena netto falownika"),
    type: inverterType,
    batteryVoltageType: inverterVoltageType,
    isEu: Boolean(inverterSource.isEu),
    hasEms: Boolean(inverterSource.hasEms),
  };

  if (options.hasStorage && needsInverter && inverter.type !== "hybrid") {
    throw new Error("Przy magazynie energii falownik niestandardowy musi być hybrydowy.");
  }

  if (
    options.hasStorage &&
    needsInverter &&
    inverter.batteryVoltageType !== storage.voltageType
  ) {
    throw new Error("Napięcie falownika i magazynu energii musi być zgodne (LV albo HV). ");
  }

  return { panel, inverter, storage };
}
