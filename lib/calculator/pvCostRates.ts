export type PvInstallationRates = {
  upTo10: number | null | undefined;
  upTo20: number | null | undefined;
  upTo40: number | null | undefined;
  upTo100: number | null | undefined;
  above100: number | null | undefined;
};

export type PvStructureRates = {
  blacha: number | null | undefined;
  dachowka: number | null | undefined;
  papa: number | null | undefined;
  grunt: number | null | undefined;
};

export const DEFAULT_PV_INSTALLATION_RATES: PvInstallationRates = {
  upTo10: 600,
  upTo20: 570,
  upTo40: 480,
  upTo100: 360,
  above100: 320,
};

function requiredRate(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") {
    throw new Error(`Brak skonfigurowanej stawki ${label}. Administrator musi ją uzupełnić.`);
  }

  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error(`Nieprawidłowa stawka ${label}.`);
  }

  return rate;
}

export function getPvInstallationRate(
  totalPowerKwp: number,
  rates: PvInstallationRates
) {
  if (!Number.isFinite(totalPowerKwp) || totalPowerKwp < 0) {
    throw new Error("Nieprawidłowa całkowita moc instalacji PV.");
  }
  if (totalPowerKwp === 0) return 0;
  if (totalPowerKwp <= 10) return requiredRate(rates.upTo10, "montażu PV 1–10 kWp");
  if (totalPowerKwp <= 20) return requiredRate(rates.upTo20, "montażu PV >10–20 kWp");
  if (totalPowerKwp <= 40) return requiredRate(rates.upTo40, "montażu PV >20–40 kWp");
  if (totalPowerKwp <= 100) return requiredRate(rates.upTo100, "montażu PV >40–100 kWp");
  return requiredRate(rates.above100, "montażu PV >100 kWp");
}

export function calculatePvInstallationCost(
  totalPowerKwp: number,
  rates: PvInstallationRates
) {
  return totalPowerKwp * getPvInstallationRate(totalPowerKwp, rates);
}

export function calculatePvStructureCost(
  totalPowerKwp: number,
  structureType: keyof PvStructureRates,
  rates: PvStructureRates
) {
  if (!Number.isFinite(totalPowerKwp) || totalPowerKwp < 0) {
    throw new Error("Nieprawidłowa całkowita moc instalacji PV.");
  }
  if (totalPowerKwp === 0) return 0;

  const labels: Record<keyof PvStructureRates, string> = {
    blacha: "konstrukcji na blasze (PLN/kWp)",
    dachowka: "konstrukcji na dachówce (PLN/kWp)",
    papa: "konstrukcji na papie (PLN/kWp)",
    grunt: "konstrukcji gruntowej (PLN/kWp)",
  };

  return totalPowerKwp * requiredRate(rates[structureType], labels[structureType]);
}
