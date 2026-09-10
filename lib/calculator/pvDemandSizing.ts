import {
  ARIMR_2026_MOUNTING_LOCATIONS,
  type Arimr2026MountingLocation,
} from "./arimr2026";

export const ARIMR_PV_DIRECTIONS = [
  { value: "south", label: "Południe", shortLabel: "S", yieldFactor: 1 },
  { value: "south_east", label: "Południowy wschód", shortLabel: "SE", yieldFactor: 0.95 },
  { value: "south_west", label: "Południowy zachód", shortLabel: "SW", yieldFactor: 0.95 },
  { value: "east", label: "Wschód", shortLabel: "E", yieldFactor: 0.85 },
  { value: "west", label: "Zachód", shortLabel: "W", yieldFactor: 0.85 },
  { value: "north_east", label: "Północny wschód", shortLabel: "NE", yieldFactor: 0.7 },
  { value: "north_west", label: "Północny zachód", shortLabel: "NW", yieldFactor: 0.7 },
  { value: "north", label: "Północ", shortLabel: "N", yieldFactor: 0.6 },
] as const;

export type ArimrPvDirection = (typeof ARIMR_PV_DIRECTIONS)[number]["value"];

const ARIMR_PV_MOUNTING_PARAMETERS: Record<
  Arimr2026MountingLocation,
  { shortLabel: string; roofType: "blacha" | "dachowka" | "papa" | "grunt"; yieldFactor: number }
> = {
  pitched_sheet: {
    shortLabel: "Dach skośny · blacha",
    roofType: "blacha",
    yieldFactor: 0.98,
  },
  pitched_tile: {
    shortLabel: "Dach skośny · dachówka",
    roofType: "dachowka",
    yieldFactor: 0.98,
  },
  flat_roof: {
    shortLabel: "Dach płaski",
    roofType: "papa",
    yieldFactor: 1,
  },
  ground: {
    shortLabel: "Grunt",
    roofType: "grunt",
    yieldFactor: 1.02,
  },
};

export const ARIMR_PV_MOUNTINGS = ARIMR_2026_MOUNTING_LOCATIONS.map(
  (mounting) => ({
    ...mounting,
    ...ARIMR_PV_MOUNTING_PARAMETERS[mounting.value],
  })
);

export type ArimrPvMounting = (typeof ARIMR_PV_MOUNTINGS)[number]["value"];
export type CalculatorRoofType = (typeof ARIMR_PV_MOUNTINGS)[number]["roofType"];

export type ArimrPvSizingFormState = {
  annualConsumptionKwh: string;
  directions: ArimrPvDirection[];
  mountings: ArimrPvMounting[];
};

export function createEmptyArimrPvSizingFormState(): ArimrPvSizingFormState {
  return {
    annualConsumptionKwh: "",
    directions: [],
    mountings: [],
  };
}

export const ARIMR_PV_SIZING_ASSUMPTIONS = {
  baseAnnualYieldKwhPerKwp: 1_000,
  maxTotalPvPowerPerPpeKwp: 50,
  maxResidentialPvPowerKwp: 10,
  maxResidentialSharePercent: 20,
} as const;

export type ArimrPvDemandSizingInput = {
  annualConsumptionKwh: number;
  directions: ArimrPvDirection[];
  mountings: ArimrPvMounting[];
  panelPowerWp: number;
  existingPvPowerKwp?: number;
};

export type ArimrPvDemandSizingResult = {
  selectedDirection: (typeof ARIMR_PV_DIRECTIONS)[number];
  selectedMounting: (typeof ARIMR_PV_MOUNTINGS)[number];
  annualYieldKwhPerKwp: number;
  fullCoveragePanelCount: number;
  fullCoveragePowerKwp: number;
  recommendedPanelCount: number;
  recommendedPowerKwp: number;
  availableNewPvLimitKwp: number;
  estimatedAnnualProductionKwh: number;
  coveragePercent: number;
  totalPvPowerAfterInvestmentKwp: number;
  residentialPanelCount: number;
  residentialPowerLimitKwp: number;
  isProgramLimitBinding: boolean;
};

function finiteNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function round(value: number, precision = 2) {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}

export function calculateArimrPvDemandSizing(
  input: ArimrPvDemandSizingInput
): ArimrPvDemandSizingResult | null {
  const annualConsumptionKwh = finiteNonNegative(input.annualConsumptionKwh);
  const panelPowerWp = finiteNonNegative(input.panelPowerWp);

  if (
    annualConsumptionKwh <= 0 ||
    panelPowerWp <= 0 ||
    input.directions.length === 0 ||
    input.mountings.length === 0
  ) {
    return null;
  }

  const selectedDirections = ARIMR_PV_DIRECTIONS.filter((direction) =>
    input.directions.includes(direction.value)
  );
  const selectedMountings = ARIMR_PV_MOUNTINGS.filter((mounting) =>
    input.mountings.includes(mounting.value)
  );
  const selectedDirection = selectedDirections.reduce((best, direction) =>
    direction.yieldFactor > best.yieldFactor ? direction : best
  );
  const selectedMounting = selectedMountings.reduce((best, mounting) =>
    mounting.yieldFactor > best.yieldFactor ? mounting : best
  );
  const annualYieldKwhPerKwp =
    ARIMR_PV_SIZING_ASSUMPTIONS.baseAnnualYieldKwhPerKwp *
    selectedDirection.yieldFactor *
    selectedMounting.yieldFactor;
  const rawPowerForFullCoverageKwp = annualConsumptionKwh / annualYieldKwhPerKwp;
  const fullCoveragePanelCount = Math.max(
    1,
    Math.ceil((rawPowerForFullCoverageKwp * 1_000) / panelPowerWp)
  );
  const fullCoveragePowerKwp = (fullCoveragePanelCount * panelPowerWp) / 1_000;
  const existingPvPowerKwp = finiteNonNegative(input.existingPvPowerKwp ?? 0);
  const availableNewPvLimitKwp = Math.max(
    0,
    ARIMR_PV_SIZING_ASSUMPTIONS.maxTotalPvPowerPerPpeKwp - existingPvPowerKwp
  );
  const maxPanelCountWithinProgram = Math.max(
    0,
    Math.floor((availableNewPvLimitKwp * 1_000) / panelPowerWp)
  );
  const recommendedPanelCount = Math.min(
    fullCoveragePanelCount,
    maxPanelCountWithinProgram
  );
  const recommendedPowerKwp = (recommendedPanelCount * panelPowerWp) / 1_000;
  const estimatedAnnualProductionKwh =
    recommendedPowerKwp * annualYieldKwhPerKwp;
  const totalPvPowerAfterInvestmentKwp =
    existingPvPowerKwp + recommendedPowerKwp;
  const residentialRawLimitKwp = Math.min(
    ARIMR_PV_SIZING_ASSUMPTIONS.maxResidentialPvPowerKwp,
    totalPvPowerAfterInvestmentKwp *
      (ARIMR_PV_SIZING_ASSUMPTIONS.maxResidentialSharePercent / 100)
  );
  const residentialPanelCount = Math.max(
    0,
    Math.floor((residentialRawLimitKwp * 1_000) / panelPowerWp)
  );

  return {
    selectedDirection,
    selectedMounting,
    annualYieldKwhPerKwp: round(annualYieldKwhPerKwp, 0),
    fullCoveragePanelCount,
    fullCoveragePowerKwp: round(fullCoveragePowerKwp),
    recommendedPanelCount,
    recommendedPowerKwp: round(recommendedPowerKwp),
    availableNewPvLimitKwp: round(availableNewPvLimitKwp),
    estimatedAnnualProductionKwh: round(estimatedAnnualProductionKwh, 0),
    coveragePercent: annualConsumptionKwh > 0
      ? round(Math.min(100, (estimatedAnnualProductionKwh / annualConsumptionKwh) * 100), 1)
      : 0,
    totalPvPowerAfterInvestmentKwp: round(totalPvPowerAfterInvestmentKwp),
    residentialPanelCount,
    residentialPowerLimitKwp: round((residentialPanelCount * panelPowerWp) / 1_000),
    isProgramLimitBinding: fullCoveragePanelCount > maxPanelCountWithinProgram,
  };
}
