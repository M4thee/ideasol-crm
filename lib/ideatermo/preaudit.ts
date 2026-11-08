export type PreauditInsulationLayer = {
  material: string;
  thicknessCm: number | null;
};

export type PreauditDimension = {
  widthCm: number | null;
  heightCm: number | null;
};

export type PreauditWindowGroup = {
  kind: string;
  dimensions: PreauditDimension[];
};

export type PreauditDoor = PreauditDimension & {
  type: string;
};

export type PreauditWallSurface = {
  areaM2: number | null;
};

export type AdvancedSurveyInput = {
  enabled: boolean;
  totalBuildingAreaM2: number | null;
  footprintShape: "compact" | "elongated" | "irregular" | "unknown" | "";
  storeyHeightsM: Partial<Record<string, number | null>>;
  allWindowsReplaced: "yes" | "no" | "unknown" | "";
  remainingWindowAreaM2: number | null;
  allDoorsReplaced: "yes" | "no" | "unknown" | "";
  remainingDoorAreaM2: number | null;
  basementCoverage: "full" | "partial" | "unknown" | "";
  partialBasementAreaM2: number | null;
  airtightness: "leaky" | "average" | "tight" | "unknown" | "";
  usualIndoorTemperatureC: number | null;
  householdType: "single" | "multi" | "";
  incomeBand: "highest" | "elevated" | "basic" | "ineligible" | "";
};

export type PreauditCalculationInput = {
  buildingType: string;
  heatedAreaM2: number | null;
  buildingStoreys: string;
  roofType: string;
  hasBasement: boolean;
  hasIntegratedGarage: boolean;
  heatedLevels: string[];
  buildingLengthM: number | null;
  buildingWidthM: number | null;
  averageStoreyHeightM: number | null;
  climateZone: string;
  ventilationType: string;
  airChangeRatePerHour: number | null;
  wallMaterial: string;
  wallThicknessCm: number | null;
  wallInsulationLayers: PreauditInsulationLayer[];
  roofInsulationLayers: PreauditInsulationLayer[];
  floorInsulationLayers: PreauditInsulationLayer[];
  windowType: string;
  windows: PreauditWindowGroup[];
  externalDoors: PreauditDoor[];
  plannedScope: string[];
  wallInsulationSurfaces: PreauditWallSurface[];
  plannedWallInsulationMaterial: string;
  plannedWallInsulationCm: number | null;
  plannedRoofInsulationMaterial: string;
  plannedRoofInsulationCm: number | null;
  plannedRoofAreaM2: number | null;
  plannedFloorInsulationMaterial: string;
  plannedFloorInsulationCm: number | null;
  plannedFloorAreaM2: number | null;
  plannedWindowUValue: number | null;
  plannedDoorUValue: number | null;
  currentHeatSource: string;
  currentSourcePowerKw: number | null;
  currentFuelType: string;
  annualFuelQuantity: number | null;
  woodType: string;
  woodSeasoning: string;
  fuelConsumptionBasis: string;
  currentHeatingPerformance: string;
  supplementalHeatingUsed: boolean | null;
  currentSourceHeatsDhw: boolean | null;
  householdMembers: number | null;
  plannedHeatSource: string;
  plannedSourceHeatsDhw: boolean | null;
  heatingDistributionType: string;
  heatingSupplyTemperatureC: number | null;
  desiredIndoorTemperatureC: number | null;
  advancedSurvey?: AdvancedSurveyInput;
};

export type EnvelopeUValues = {
  wall: number;
  roof: number;
  floor: number;
  window: number;
  door: number;
};

export type PowerEstimateStatus =
  | "within_15_percent"
  | "insufficient_data";

export type AdvancedEnergyResult = {
  enabled: boolean;
  status: "disabled" | "insufficient_data" | "calculated";
  currentUsefulEnergyKwhM2Year: number | null;
  postUsefulEnergyKwhM2Year: number | null;
  currentRange: { min: number; max: number } | null;
  postRange: { min: number; max: number } | null;
  reductionPercent: number | null;
  reductionRange: { min: number; max: number } | null;
  programmeAssessment:
    | "not_assessed"
    | "below_80"
    | "likely_meets"
    | "borderline"
    | "unlikely_meets";
  programmeAssessmentLabel: string;
  incomeAssessmentLabel: string;
  combinedAssessmentLabel: string;
  confidence: "wysoka" | "średnia" | "niska" | "niewystarczająca";
  uncertaintyPercent: number | null;
  missingInputs: string[];
  assumptions: string[];
  disclaimer: string;
};

export type PreauditCalculation = {
  currentDesignHeatLoadKw: number | null;
  postModernizationDesignHeatLoadKw: number | null;
  indicativeRequiredPowerKw: number | null;
  indicativePowerMinKw: number | null;
  indicativePowerMaxKw: number | null;
  powerEstimateStatus: PowerEstimateStatus;
  powerEstimateMarginPercent: number | null;
  powerEstimateMissingInputs: string[];
  confidence: "wystarczająca" | "niewystarczająca";
  currentUValues: EnvelopeUValues | null;
  postModernizationUValues: EnvelopeUValues | null;
  geometry: {
    footprintM2: number;
    heatedVolumeM3: number;
    netWallAreaM2: number;
    roofAreaM2: number;
    floorAreaM2: number;
    windowAreaM2: number;
    doorAreaM2: number;
  } | null;
  heatLoss: {
    currentTransmissionWPerK: number;
    postTransmissionWPerK: number;
    ventilationWPerK: number;
  } | null;
  workScope: {
    wallAreaM2: number | null;
    roofAreaM2: number | null;
    floorAreaM2: number | null;
    windowCount: number;
    windowAreaM2: number | null;
    doorCount: number;
    doorAreaM2: number | null;
  };
  advancedEnergy: AdvancedEnergyResult;
  calculationAssumptions: string[];
  disclaimer: string;
  calculationMethod: string;
};

const THERMAL_BRIDGE_FACTOR = 1.1;
const POWER_MARGIN_PERCENT = 15;

const SCOPE = {
  walls: "Docieplenie ścian",
  roof: "Docieplenie dachu / stropu",
  floor: "Docieplenie podłogi",
  windows: "Wymiana okien",
  doors: "Wymiana drzwi",
  heatSource: "Modernizacja źródła ciepła",
} as const;

const CLIMATE: Record<string, { designOutdoorC: number; degreeDays: number }> = {
  I: { designOutdoorC: -16, degreeDays: 3200 },
  II: { designOutdoorC: -18, degreeDays: 3400 },
  III: { designOutdoorC: -20, degreeDays: 3600 },
  IV: { designOutdoorC: -22, degreeDays: 3900 },
  V: { designOutdoorC: -24, degreeDays: 4200 },
};

export type PolishClimateZone = "I" | "II" | "III" | "IV" | "V";

/**
 * Postal districts are only an approximation of PN-EN 12831 climate-zone
 * borders. The professional audit and installation design remain decisive.
 */
export function estimateClimateZoneFromPostalCode(
  postalCode: string | null | undefined
): PolishClimateZone {
  const digits = String(postalCode ?? "").replace(/\D/g, "").slice(0, 5);
  if (digits.length !== 5) return "III";

  const district = Number(digits.slice(0, 2));
  const fullCode = Number(digits);

  if (district === 16 || (fullCode >= 34_500 && fullCode <= 34_599)) return "V";
  if (
    (district >= 10 && district <= 19) ||
    district === 33 ||
    district === 34 ||
    district === 38 ||
    district === 43
  ) {
    return "IV";
  }
  if (district >= 70 && district <= 84) return "I";
  if ((district >= 45 && district <= 69) || (district >= 85 && district <= 89)) {
    return "II";
  }
  return "III";
}

const WALL_LAMBDA: Record<string, number> = {
  aerated_concrete: 0.18,
  ceramic_hollow_block: 0.25,
  solid_brick: 0.77,
  perforated_or_lattice_brick: 0.4,
  silicate: 0.8,
  concrete_or_reinforced_concrete: 1.7,
  expanded_clay_concrete: 0.3,
  slag_concrete: 0.7,
  timber_logs: 0.18,
  timber_frame: 0.25,
  natural_stone: 2,
  clay: 0.7,
  unknown: 0.7,
};

const INSULATION_LAMBDA: Record<string, number> = {
  mineral_wool: 0.039,
  cellulose_or_granulate: 0.04,
  white_eps: 0.04,
  graphite_eps: 0.032,
  xps: 0.035,
  pur_foam: 0.026,
  pir_pur_phenolic_board: 0.023,
  expanded_clay: 0.1,
  wood_fiber: 0.045,
  wood_sawdust: 0.08,
  slag: 0.35,
  unknown: 0.045,
};

const WINDOW_U_VALUE: Record<string, number> = {
  "2021_plus_triple": 0.8,
  "2021_plus_double": 1.1,
  "2011_2020_triple": 1,
  "2011_2020_double": 1.4,
  older_insulated_glass: 2.6,
  older_two_plain_panes: 3,
  older_single_plain_pane: 5,
};

const DOOR_U_VALUE: Record<string, number> = {
  old_wooden: 3,
  old_metal: 4,
  new_wooden: 1.3,
  new_metal: 1.5,
  new_plastic: 1.2,
};

const VENTILATION_RATE: Record<string, number> = {
  natural: 0.7,
  mechanical_exhaust: 0.6,
  balanced_without_heat_recovery: 0.5,
  balanced_with_heat_recovery: 0.25,
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, precision = 0) {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}

function positive(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function layerResistance(layers: PreauditInsulationLayer[]) {
  return layers.reduce((resistance, layer) => {
    if (layer.material === "air_gap") return resistance + 0.18;
    const thicknessCm = positive(layer.thicknessCm);
    if (!thicknessCm) return resistance;
    const lambda = INSULATION_LAMBDA[layer.material] || INSULATION_LAMBDA.unknown;
    return resistance + thicknessCm / 100 / lambda;
  }, 0);
}

function plannedLayerResistance(material: string, thicknessCm: number | null) {
  const thickness = positive(thicknessCm);
  if (!material || !thickness) return 0;
  const lambda = INSULATION_LAMBDA[material] || INSULATION_LAMBDA.unknown;
  return thickness / 100 / lambda;
}

function wallUValue(input: PreauditCalculationInput) {
  const thickness = positive(input.wallThicknessCm) || 38;
  const lambda = WALL_LAMBDA[input.wallMaterial] || WALL_LAMBDA.unknown;
  return 1 / (0.17 + thickness / 100 / lambda + layerResistance(input.wallInsulationLayers));
}

function roofUValue(input: PreauditCalculationInput) {
  return 1 / (0.14 + 0.12 + layerResistance(input.roofInsulationLayers));
}

function floorUValue(input: PreauditCalculationInput) {
  return 1 / (0.17 + 0.15 + layerResistance(input.floorInsulationLayers));
}

function getArea(dimensions: PreauditDimension[]) {
  return dimensions.reduce((sum, dimension) => {
    const width = positive(dimension.widthCm);
    const height = positive(dimension.heightCm);
    return sum + (width && height ? (width * height) / 10_000 : 0);
  }, 0);
}

function getWindowArea(input: PreauditCalculationInput) {
  return input.windows.reduce(
    (sum, group) => sum + getArea(group.dimensions),
    0
  );
}

function getDoorArea(input: PreauditCalculationInput) {
  return getArea(input.externalDoors);
}

function weightedDoorUValue(input: PreauditCalculationInput) {
  let weighted = 0;
  let area = 0;
  for (const door of input.externalDoors) {
    const doorArea = getArea([door]);
    if (!doorArea) continue;
    weighted += doorArea * (DOOR_U_VALUE[door.type] || 3);
    area += doorArea;
  }
  return area ? weighted / area : 3;
}

function getHeatedLevelEquivalent(input: PreauditCalculationInput) {
  const fullLevels = input.heatedLevels.filter(
    (level) => level !== "garage" && level !== "attic"
  ).length;
  const partialLevels = input.heatedLevels.filter(
    (level) => level === "garage" || level === "attic"
  ).length;
  return Math.max(1, fullLevels + partialLevels * 0.5);
}

function getHeatedAboveGroundStoreys(input: PreauditCalculationInput) {
  const levels = input.heatedLevels.filter(
    (level) => level === "ground_floor" || level.startsWith("floor_")
  ).length;
  return Math.max(1, levels);
}

function getPhysicalLevelKeys(input: PreauditCalculationInput) {
  const levels: string[] = [];
  if (input.hasBasement) levels.push("basement");
  levels.push("ground_floor");
  const floorCount = input.buildingStoreys === "ground_plus_3"
    ? 3
    : input.buildingStoreys === "ground_plus_2"
      ? 2
      : input.buildingStoreys === "ground_plus_1"
        ? 1
        : 0;
  for (let floor = 1; floor <= floorCount; floor += 1) {
    levels.push(`floor_${floor}`);
  }
  if (input.roofType === "pitched_with_attic") levels.push("attic");
  return levels;
}

function getAdvancedAverageHeight(input: PreauditCalculationInput) {
  const advanced = input.advancedSurvey;
  if (!advanced?.enabled) return positive(input.averageStoreyHeightM) || 2.7;
  const heatedLevelHeights = input.heatedLevels
    .filter((level) => level !== "garage")
    .map((level) => positive(advanced.storeyHeightsM[level]))
    .filter((height): height is number => height !== null);
  if (!heatedLevelHeights.length) return positive(input.averageStoreyHeightM) || 2.7;
  return heatedLevelHeights.reduce((sum, height) => sum + height, 0) /
    heatedLevelHeights.length;
}

function getGeometry(input: PreauditCalculationInput, assumptions: string[]) {
  const heatedArea = positive(input.heatedAreaM2);
  if (!heatedArea) return null;

  const advanced = input.advancedSurvey?.enabled ? input.advancedSurvey : null;
  const storeyHeight = getAdvancedAverageHeight(input);
  const measuredLength = positive(input.buildingLengthM);
  const measuredWidth = positive(input.buildingWidthM);
  const hasMeasuredFootprint = Boolean(measuredLength && measuredWidth);
  const totalBuildingArea = positive(advanced?.totalBuildingAreaM2);
  const physicalLevelCount = getPhysicalLevelKeys(input).length;
  const footprint = hasMeasuredFootprint
    ? measuredLength! * measuredWidth!
    : totalBuildingArea
      ? Math.max(heatedArea / getHeatedLevelEquivalent(input), totalBuildingArea / physicalLevelCount)
      : heatedArea / getHeatedLevelEquivalent(input);
  const shapeRatio = advanced?.footprintShape === "elongated"
    ? 2.4
    : advanced?.footprintShape === "irregular"
      ? 1.7
      : 1;
  const aspectRatio = hasMeasuredFootprint
    ? measuredLength! / measuredWidth!
    : shapeRatio;
  const width = Math.sqrt(footprint / aspectRatio);
  const length = footprint / width;
  const irregularityFactor = advanced?.footprintShape === "irregular" ? 1.18 : 1;
  const perimeter = 2 * (width + length) * irregularityFactor;
  const heatedStoreys = getHeatedAboveGroundStoreys(input);
  const isApartment = input.buildingType === "lokal_mieszkalny_w_budynku_wielorodzinnym";
  const grossWallArea = perimeter * storeyHeight * heatedStoreys * (isApartment ? 0.5 : 1);
  const measuredWindowArea = getWindowArea(input);
  const windowsPlanned = input.plannedScope.includes(SCOPE.windows);
  const declaredOtherWindowArea = positive(advanced?.remainingWindowAreaM2) || 0;
  const declaredWindowArea = advanced
    ? windowsPlanned
      ? advanced.allWindowsReplaced === "yes"
        ? measuredWindowArea
        : measuredWindowArea + declaredOtherWindowArea
      : declaredOtherWindowArea
    : measuredWindowArea;
  const windowArea = declaredWindowArea || Math.max(measuredWindowArea, grossWallArea * 0.15);
  const measuredDoorArea = getDoorArea(input);
  const doorsPlanned = input.plannedScope.includes(SCOPE.doors);
  const declaredOtherDoorArea = positive(advanced?.remainingDoorAreaM2) || 0;
  const declaredDoorArea = advanced
    ? doorsPlanned
      ? advanced.allDoorsReplaced === "yes"
        ? measuredDoorArea
        : measuredDoorArea + declaredOtherDoorArea
      : declaredOtherDoorArea
    : measuredDoorArea;
  const doorArea = declaredDoorArea || Math.max(measuredDoorArea, isApartment ? 1.8 : 2);
  const netWallArea = Math.max(grossWallArea * 0.45, grossWallArea - windowArea - doorArea);
  const roofArea = footprint * (input.roofType === "pitched_with_attic" ? 1.15 : 1);

  if (!hasMeasuredFootprint) {
    assumptions.push(
      `Geometrię oszacowano z powierzchni ${totalBuildingArea ? "całkowitej i liczby poziomów" : "ogrzewanej i liczby ogrzewanych kondygnacji"}; przyjęty rzut ma ${round(footprint, 1)} m².`
    );
  }
  if (!declaredWindowArea) {
    assumptions.push(
      `Całkowitą powierzchnię okien do modelu mocy oszacowano jako 15% powierzchni elewacji (${round(windowArea, 1)} m²).`
    );
  }
  if (!declaredDoorArea) {
    assumptions.push(
      `Do modelu mocy przyjęto ${round(doorArea, 1)} m² drzwi zewnętrznych.`
    );
  }

  return {
    footprintM2: footprint,
    heatedVolumeM3: heatedArea * storeyHeight,
    netWallAreaM2: netWallArea,
    roofAreaM2: roofArea,
    floorAreaM2: footprint,
    windowAreaM2: windowArea,
    doorAreaM2: doorArea,
    measuredWindowAreaM2: measuredWindowArea,
    measuredDoorAreaM2: measuredDoorArea,
  };
}

function powerEstimateMissingInputs(
  input: PreauditCalculationInput,
  quantities: {
    wallAreaM2: number | null;
    roofAreaM2: number | null;
    floorAreaM2: number | null;
    windowAreaM2: number | null;
    doorAreaM2: number | null;
  }
) {
  const missing: string[] = [];
  if (!positive(input.heatedAreaM2)) missing.push("powierzchnia ogrzewana");
  if (!input.heatedLevels.length) missing.push("ogrzewane kondygnacje");
  if (!input.wallMaterial || input.wallMaterial === "unknown") {
    missing.push("znany materiał ścian");
  }
  if (!positive(input.wallThicknessCm)) missing.push("grubość ścian");
  if (!input.windowType) missing.push("rodzaj obecnych okien");
  if (!input.plannedHeatSource) missing.push("planowane nowe źródło ciepła");
  if (input.buildingType === "lokal_mieszkalny_w_budynku_wielorodzinnym") {
    missing.push("profesjonalne określenie przegród zewnętrznych lokalu");
  }
  if (input.plannedScope.includes(SCOPE.walls) && !quantities.wallAreaM2) {
    missing.push("łączna powierzchnia ścian do docieplenia");
  }
  if (input.plannedScope.includes(SCOPE.roof) && !quantities.roofAreaM2) {
    missing.push("powierzchnia dachu lub stropu do docieplenia");
  }
  if (input.plannedScope.includes(SCOPE.floor) && !quantities.floorAreaM2) {
    missing.push("powierzchnia podłogi lub stropu nad piwnicą");
  }
  if (input.plannedScope.includes(SCOPE.windows) && !quantities.windowAreaM2) {
    missing.push("wymiary wymienianych okien");
  }
  if (input.plannedScope.includes(SCOPE.doors) && !quantities.doorAreaM2) {
    missing.push("wymiary wymienianych drzwi");
  }
  if (input.plannedScope.includes(SCOPE.windows) && !positive(input.plannedWindowUValue)) {
    missing.push("docelowy współczynnik Uw okien");
  }
  if (input.plannedScope.includes(SCOPE.doors) && !positive(input.plannedDoorUValue)) {
    missing.push("docelowy współczynnik Ud drzwi");
  }
  return [...new Set(missing)];
}

function disabledAdvancedEnergy(): AdvancedEnergyResult {
  return {
    enabled: false,
    status: "disabled",
    currentUsefulEnergyKwhM2Year: null,
    postUsefulEnergyKwhM2Year: null,
    currentRange: null,
    postRange: null,
    reductionPercent: null,
    reductionRange: null,
    programmeAssessment: "not_assessed",
    programmeAssessmentLabel: "Tryb zaawansowany jest wyłączony.",
    incomeAssessmentLabel: "Nie oceniano progu dochodowego.",
    combinedAssessmentLabel: "Brak wstępnej oceny programu.",
    confidence: "niewystarczająca",
    uncertaintyPercent: null,
    missingInputs: [],
    assumptions: [],
    disclaimer:
      "Wynik trybu zaawansowanego jest wyłącznie wstępnym szacunkiem. Nie zastępuje audytu energetycznego ani DPAE.",
  };
}

function calculateAdvancedEnergy(
  input: PreauditCalculationInput,
  geometry: ReturnType<typeof getGeometry>,
  currentTransmissionWPerK: number,
  postTransmissionWPerK: number,
  ventilationWPerK: number
): AdvancedEnergyResult {
  const advanced = input.advancedSurvey;
  if (!advanced?.enabled) return disabledAdvancedEnergy();
  const heatedArea = positive(input.heatedAreaM2);
  if (!geometry || !heatedArea) {
    return {
      ...disabledAdvancedEnergy(),
      enabled: true,
      status: "insufficient_data",
      programmeAssessmentLabel: "Brak danych do obliczenia zapotrzebowania.",
      combinedAssessmentLabel: "Uzupełnij co najmniej powierzchnię ogrzewaną.",
      missingInputs: ["powierzchnia ogrzewana"],
    };
  }

  const missingInputs: string[] = [];
  let uncertaintyPercent = 15;
  if (!positive(advanced.totalBuildingAreaM2)) {
    missingInputs.push("powierzchnia całkowita budynku");
    uncertaintyPercent += 5;
  }
  if (!advanced.footprintShape || advanced.footprintShape === "unknown") {
    missingInputs.push("uproszczony kształt rzutu budynku");
    uncertaintyPercent += 3;
  }
  const physicalLevels = getPhysicalLevelKeys(input);
  const missingHeight = physicalLevels.some(
    (level) => !positive(advanced.storeyHeightsM[level])
  );
  if (missingHeight) {
    missingInputs.push("wysokość każdej kondygnacji");
    uncertaintyPercent += 3;
  }
  const windowsPlanned = input.plannedScope.includes(SCOPE.windows);
  if (
    (windowsPlanned && advanced.allWindowsReplaced !== "yes" &&
      !positive(advanced.remainingWindowAreaM2)) ||
    (!windowsPlanned && !positive(advanced.remainingWindowAreaM2))
  ) {
    missingInputs.push(
      windowsPlanned
        ? "powierzchnia okien pozostających bez wymiany"
        : "łączna powierzchnia istniejących okien"
    );
    uncertaintyPercent += 4;
  }
  const doorsPlanned = input.plannedScope.includes(SCOPE.doors);
  if (
    (doorsPlanned && advanced.allDoorsReplaced !== "yes" &&
      !positive(advanced.remainingDoorAreaM2)) ||
    (!doorsPlanned && !positive(advanced.remainingDoorAreaM2))
  ) {
    missingInputs.push(
      doorsPlanned
        ? "powierzchnia drzwi pozostających bez wymiany"
        : "łączna powierzchnia istniejących drzwi"
    );
    uncertaintyPercent += 2;
  }
  if (!advanced.airtightness || advanced.airtightness === "unknown") {
    missingInputs.push("uproszczona ocena szczelności");
    uncertaintyPercent += 4;
  }
  if (!positive(advanced.usualIndoorTemperatureC)) {
    missingInputs.push("zwyczajowa temperatura w domu");
    uncertaintyPercent += 2;
  }
  if (!input.wallMaterial || input.wallMaterial === "unknown") {
    missingInputs.push("znany materiał ścian");
    uncertaintyPercent += 4;
  }
  if (!input.windowType) {
    missingInputs.push("rodzaj obecnych okien");
    uncertaintyPercent += 3;
  }
  uncertaintyPercent = clamp(uncertaintyPercent, 15, 35);

  const climate = CLIMATE[input.climateZone] || CLIMATE.III;
  const usualTemperature = positive(advanced.usualIndoorTemperatureC) ||
    positive(input.desiredIndoorTemperatureC) || 21;
  const indoorAdjustment = clamp((usualTemperature - 20) * 0.055 + 1, 0.85, 1.2);
  const usefulGainsKwhYear = heatedArea * 15;
  const currentAnnualKwh = Math.max(
    0,
    (currentTransmissionWPerK + ventilationWPerK) * climate.degreeDays * 24 /
      1000 * indoorAdjustment - usefulGainsKwhYear
  );
  const postAnnualKwh = Math.max(
    0,
    (postTransmissionWPerK + ventilationWPerK) * climate.degreeDays * 24 /
      1000 * indoorAdjustment - usefulGainsKwhYear
  );
  const currentIndex = currentAnnualKwh / heatedArea;
  const postIndex = postAnnualKwh / heatedArea;
  const uncertainty = uncertaintyPercent / 100;
  const currentRange = {
    min: round(Math.max(0, currentIndex * (1 - uncertainty)), 0),
    max: round(currentIndex * (1 + uncertainty), 0),
  };
  const postRange = {
    min: round(Math.max(0, postIndex * (1 - uncertainty)), 0),
    max: round(postIndex * (1 + uncertainty), 0),
  };
  const reductionPercent = currentIndex > 0
    ? clamp((1 - postIndex / currentIndex) * 100, 0, 100)
    : 0;
  const reductionRange = {
    min: currentRange.min > 0
      ? round(clamp((1 - postRange.max / currentRange.min) * 100, 0, 100), 0)
      : 0,
    max: currentRange.max > 0
      ? round(clamp((1 - postRange.min / currentRange.max) * 100, 0, 100), 0)
      : 0,
  };

  let programmeAssessment: AdvancedEnergyResult["programmeAssessment"];
  let programmeAssessmentLabel: string;
  if (currentRange.max < 80) {
    programmeAssessment = "below_80";
    programmeAssessmentLabel =
      "Szacunek przed modernizacją jest poniżej 80 kWh/(m²·rok). W programie jest to ścieżka bez obowiązkowej termomodernizacji, np. dla samej wymiany nieefektywnego źródła ciepła.";
  } else {
    const targetAfter = currentIndex > 140 ? 140 : 80;
    const thermalScopePlanned = [
      SCOPE.walls,
      SCOPE.roof,
      SCOPE.floor,
      SCOPE.windows,
      SCOPE.doors,
    ].some((scope) => input.plannedScope.includes(scope));
    const conservativelyMeets =
      postRange.max <= targetAfter && reductionRange.min >= 40;
    const cannotMeetEvenOptimistically =
      !thermalScopePlanned || reductionPercent < 1 ||
      postRange.min > targetAfter || reductionRange.max < 40;
    if (conservativelyMeets) {
      programmeAssessment = "likely_meets";
      programmeAssessmentLabel =
        `Wybrany zakres wstępnie spełnia warunek: wynik po modernizacji nie wyższy niż ${targetAfter} kWh/(m²·rok) oraz redukcja co najmniej 40%.`;
    } else if (cannotMeetEvenOptimistically) {
      programmeAssessment = "unlikely_meets";
      programmeAssessmentLabel =
        `Wybrany zakres prawdopodobnie nie osiąga jednocześnie limitu ${targetAfter} kWh/(m²·rok) i redukcji 40%.`;
    } else {
      programmeAssessment = "borderline";
      programmeAssessmentLabel =
        `Wynik jest na granicy warunków: limit ${targetAfter} kWh/(m²·rok) i redukcja 40% wymagają potwierdzenia w audycie oraz DPAE.`;
    }
  }

  const incomeAssessmentLabel = advanced.incomeBand === "highest"
    ? "Deklarowany przedział dochodu odpowiada progowi najwyższemu."
    : advanced.incomeBand === "elevated"
      ? "Deklarowany przedział dochodu odpowiada progowi podwyższonemu."
      : advanced.incomeBand === "basic"
        ? "Deklarowany przedział dochodu odpowiada progowi podstawowemu."
        : advanced.incomeBand === "ineligible"
          ? "Deklarowany dochód przekracza limit poziomu podstawowego."
          : "Nie wskazano przewidywanego progu dochodowego.";
  const combinedAssessmentLabel = advanced.incomeBand === "highest" &&
    currentRange.min <= 140
    ? "Dochód wskazuje próg najwyższy, lecz poziom najwyższy wymaga także EU przed modernizacją powyżej 140 kWh/(m²·rok). Wstępnie oceniaj poziom podwyższony do czasu audytu."
    : advanced.incomeBand === "ineligible"
      ? "Na podstawie wybranego przedziału dochodu brak wstępnej kwalifikacji dochodowej."
      : `${incomeAssessmentLabel} ${programmeAssessmentLabel}`;

  const assumptions = [
    `Strefa klimatyczna ${input.climateZone || "III"}: ${climate.degreeDays} stopniodni ogrzewania.`,
    "Obliczenie EU jest uproszczonym bilansem strat przez przegrody i wentylację z odjęciem standardowych zysków wewnętrznych i słonecznych.",
    "Zużycie paliwa służy wyłącznie jako punkt kontrolny i nie zmienia normowego wyniku modelu.",
  ];

  return {
    enabled: true,
    status: "calculated",
    currentUsefulEnergyKwhM2Year: round(currentIndex, 0),
    postUsefulEnergyKwhM2Year: round(postIndex, 0),
    currentRange,
    postRange,
    reductionPercent: round(reductionPercent, 0),
    reductionRange,
    programmeAssessment,
    programmeAssessmentLabel,
    incomeAssessmentLabel,
    combinedAssessmentLabel,
    confidence: uncertaintyPercent <= 18
      ? "wysoka"
      : uncertaintyPercent <= 25
        ? "średnia"
        : "niska",
    uncertaintyPercent,
    missingInputs: [...new Set(missingInputs)],
    assumptions,
    disclaimer:
      "To orientacyjna kalkulacja ankietowa, a nie audyt energetyczny, DPAE ani decyzja o przyznaniu dotacji. Warunki programu i dochód potwierdza operator na podstawie wymaganych dokumentów.",
  };
}

export function calculateIdeaTermoPreaudit(
  input: PreauditCalculationInput
): PreauditCalculation {
  const calculationAssumptions: string[] = [];
  const geometry = getGeometry(input, calculationAssumptions);
  const quoteWallArea = input.wallInsulationSurfaces.reduce(
    (sum, surface) => sum + (positive(surface.areaM2) || 0),
    0
  );
  const quoteRoofArea = positive(input.plannedRoofAreaM2);
  const quoteFloorArea = positive(input.plannedFloorAreaM2);
  const measuredWindowArea = getWindowArea(input);
  const measuredDoorArea = getDoorArea(input);
  const windowCount = input.windows.reduce(
    (sum, group) => sum + group.dimensions.length,
    0
  );
  const doorCount = input.externalDoors.length;
  const workScope = {
    wallAreaM2: quoteWallArea || null,
    roofAreaM2: quoteRoofArea,
    floorAreaM2: quoteFloorArea,
    windowCount,
    windowAreaM2: measuredWindowArea || null,
    doorCount,
    doorAreaM2: measuredDoorArea || null,
  };
  const emptyMissingInputs = powerEstimateMissingInputs(input, {
    wallAreaM2: workScope.wallAreaM2,
    roofAreaM2: workScope.roofAreaM2,
    floorAreaM2: workScope.floorAreaM2,
    windowAreaM2: workScope.windowAreaM2,
    doorAreaM2: workScope.doorAreaM2,
  });
  const emptyResult: PreauditCalculation = {
    currentDesignHeatLoadKw: null,
    postModernizationDesignHeatLoadKw: null,
    indicativeRequiredPowerKw: null,
    indicativePowerMinKw: null,
    indicativePowerMaxKw: null,
    powerEstimateStatus: "insufficient_data",
    powerEstimateMarginPercent: null,
    powerEstimateMissingInputs: emptyMissingInputs,
    confidence: "niewystarczająca",
    currentUValues: null,
    postModernizationUValues: null,
    geometry: null,
    heatLoss: null,
    workScope,
    advancedEnergy: input.advancedSurvey?.enabled
      ? calculateAdvancedEnergy(input, geometry, 0, 0, 0)
      : disabledAdvancedEnergy(),
    calculationAssumptions,
    disclaimer:
      "Dobór mocy jest wyłącznie szacunkiem do przygotowania wyceny. Nie zastępuje audytu energetycznego, DPAE, obliczeń PN-EN 12831 ani projektu instalacji.",
    calculationMethod:
      "Uproszczone projektowe obciążenie cieplne H = Σ(U·A·b) + 0,34·n·V. Wskaźnik EU jest obliczany wyłącznie po dobrowolnym włączeniu trybu zaawansowanego.",
  };
  if (!geometry || !positive(input.heatedAreaM2)) return emptyResult;

  const currentWallU = wallUValue(input);
  const currentRoofU = roofUValue(input);
  const currentFloorU = floorUValue(input);
  const currentWindowU = WINDOW_U_VALUE[input.windowType] || 2.6;
  const currentDoorU = weightedDoorUValue(input);
  const currentUValues: EnvelopeUValues = {
    wall: round(currentWallU, 2),
    roof: round(currentRoofU, 2),
    floor: round(currentFloorU, 2),
    window: round(currentWindowU, 2),
    door: round(currentDoorU, 2),
  };

  const wallsPlanned = input.plannedScope.includes(SCOPE.walls);
  const roofPlanned = input.plannedScope.includes(SCOPE.roof);
  const floorPlanned = input.plannedScope.includes(SCOPE.floor);
  const windowsPlanned = input.plannedScope.includes(SCOPE.windows);
  const doorsPlanned = input.plannedScope.includes(SCOPE.doors);
  const plannedWallR = wallsPlanned
    ? plannedLayerResistance(input.plannedWallInsulationMaterial, input.plannedWallInsulationCm)
    : 0;
  const plannedRoofR = roofPlanned
    ? plannedLayerResistance(input.plannedRoofInsulationMaterial, input.plannedRoofInsulationCm)
    : 0;
  const plannedFloorR = floorPlanned
    ? plannedLayerResistance(input.plannedFloorInsulationMaterial, input.plannedFloorInsulationCm)
    : 0;
  const postWallU = plannedWallR ? 1 / (1 / currentWallU + plannedWallR) : currentWallU;
  const postRoofU = plannedRoofR ? 1 / (1 / currentRoofU + plannedRoofR) : currentRoofU;
  const postFloorU = plannedFloorR ? 1 / (1 / currentFloorU + plannedFloorR) : currentFloorU;
  const postWindowU = windowsPlanned && positive(input.plannedWindowUValue)
    ? input.plannedWindowUValue!
    : currentWindowU;
  const postDoorU = doorsPlanned && positive(input.plannedDoorUValue)
    ? input.plannedDoorUValue!
    : currentDoorU;

  const plannedWallArea = wallsPlanned
    ? clamp(quoteWallArea || geometry.netWallAreaM2, 0, geometry.netWallAreaM2)
    : 0;
  const plannedRoofArea = roofPlanned
    ? clamp(quoteRoofArea || geometry.roofAreaM2, 0, geometry.roofAreaM2)
    : 0;
  const plannedFloorArea = floorPlanned
    ? clamp(quoteFloorArea || geometry.floorAreaM2, 0, geometry.floorAreaM2)
    : 0;
  const replacementWindowArea = windowsPlanned
    ? clamp(measuredWindowArea || geometry.windowAreaM2, 0, geometry.windowAreaM2)
    : 0;
  const replacementDoorArea = doorsPlanned
    ? clamp(measuredDoorArea || geometry.doorAreaM2, 0, geometry.doorAreaM2)
    : 0;

  const unheatedBasement = input.hasBasement && !input.heatedLevels.includes("basement");
  const partialBasementArea = positive(
    input.advancedSurvey?.partialBasementAreaM2
  );
  const partialBasementShare = partialBasementArea
    ? clamp(partialBasementArea / geometry.floorAreaM2, 0, 1)
    : null;
  const floorBoundaryFactor = unheatedBasement
    ? input.advancedSurvey?.enabled && input.advancedSurvey.basementCoverage === "partial"
      ? partialBasementShare === null
        ? 0.6
        : 0.5 + 0.2 * partialBasementShare
      : 0.7
    : 0.5;
  if (
    unheatedBasement &&
    input.advancedSurvey?.enabled &&
    input.advancedSurvey.basementCoverage === "partial" &&
    partialBasementShare !== null
  ) {
    calculationAssumptions.push(
      `Piwnica zajmuje około ${round(partialBasementShare * 100, 0)}% rzutu budynku; pozostałą część podłogi potraktowano jako przegrodę na gruncie.`
    );
  }
  const isApartment = input.buildingType.includes("lokal_");
  const roofBoundaryFactor = isApartment ? 0.25 : 1;
  const adjustedFloorBoundaryFactor = isApartment ? 0.25 : floorBoundaryFactor;
  const currentTransmission = THERMAL_BRIDGE_FACTOR * (
    currentWallU * geometry.netWallAreaM2 +
    currentRoofU * geometry.roofAreaM2 * roofBoundaryFactor +
    currentFloorU * geometry.floorAreaM2 * adjustedFloorBoundaryFactor +
    currentWindowU * geometry.windowAreaM2 +
    currentDoorU * geometry.doorAreaM2
  );
  const postTransmission = THERMAL_BRIDGE_FACTOR * (
    currentWallU * (geometry.netWallAreaM2 - plannedWallArea) +
    postWallU * plannedWallArea +
    (currentRoofU * (geometry.roofAreaM2 - plannedRoofArea) + postRoofU * plannedRoofArea) * roofBoundaryFactor +
    (currentFloorU * (geometry.floorAreaM2 - plannedFloorArea) + postFloorU * plannedFloorArea) * adjustedFloorBoundaryFactor +
    currentWindowU * (geometry.windowAreaM2 - replacementWindowArea) +
    postWindowU * replacementWindowArea +
    currentDoorU * (geometry.doorAreaM2 - replacementDoorArea) +
    postDoorU * replacementDoorArea
  );
  const advancedAirtightnessRate = input.advancedSurvey?.enabled &&
    input.ventilationType !== "balanced_with_heat_recovery"
    ? input.advancedSurvey.airtightness === "leaky"
      ? 0.9
      : input.advancedSurvey.airtightness === "tight"
        ? 0.5
        : input.advancedSurvey.airtightness === "average"
          ? 0.7
          : null
    : null;
  const airChangeRate = positive(input.airChangeRatePerHour) ||
    advancedAirtightnessRate ||
    VENTILATION_RATE[input.ventilationType] || VENTILATION_RATE.natural;
  const ventilationLoss = 0.34 * airChangeRate * geometry.heatedVolumeM3;
  const advancedEnergy = calculateAdvancedEnergy(
    input,
    geometry,
    currentTransmission,
    postTransmission,
    ventilationLoss
  );
  const climate = CLIMATE[input.climateZone] || CLIMATE.III;
  const desiredTemperature = positive(input.desiredIndoorTemperatureC) || 21;
  const designDeltaT = desiredTemperature - climate.designOutdoorC;
  const currentDesignHeatLoadKw = round(
    (currentTransmission + ventilationLoss) * designDeltaT / 1000,
    1
  );
  const postDesignHeatLoadKw = round(
    (postTransmission + ventilationLoss) * designDeltaT / 1000,
    1
  );
  const missingInputs = powerEstimateMissingInputs(input, {
    wallAreaM2: workScope.wallAreaM2,
    roofAreaM2: workScope.roofAreaM2,
    floorAreaM2: workScope.floorAreaM2,
    windowAreaM2: workScope.windowAreaM2,
    doorAreaM2: workScope.doorAreaM2,
  });
  const hasQualifiedEstimate =
    input.plannedScope.includes(SCOPE.heatSource) && missingInputs.length === 0;
  const sizingFactor = input.plannedHeatSource === "pellet_boiler" ||
    input.plannedHeatSource === "wood_gasification_boiler" ? 1.1 : 1;
  const requiredPower = postDesignHeatLoadKw * sizingFactor;
  const indicativeRequiredPowerKw = hasQualifiedEstimate ? round(requiredPower, 1) : null;
  const indicativePowerMinKw = hasQualifiedEstimate
    ? round(requiredPower * (1 - POWER_MARGIN_PERCENT / 100), 1)
    : null;
  const indicativePowerMaxKw = hasQualifiedEstimate
    ? round(requiredPower * (1 + POWER_MARGIN_PERCENT / 100), 1)
    : null;

  calculationAssumptions.push(
    `Strefa klimatyczna ${input.climateZone || "III"}; do obciążenia przyjęto temperaturę zewnętrzną ${climate.designOutdoorC}°C i wewnętrzną ${desiredTemperature}°C.`
  );
  calculationAssumptions.push(
    `Wentylacja: ${round(airChangeRate, 2)} wymiany powietrza/h; uproszczony dodatek na mostki cieplne: ${Math.round((THERMAL_BRIDGE_FACTOR - 1) * 100)}%.`
  );
  if (sizingFactor > 1) {
    calculationAssumptions.push(
      "Dla kotła na biomasę dodano 10% rezerwy regulacyjnej do obciążenia projektowego."
    );
  }

  return {
    currentDesignHeatLoadKw,
    postModernizationDesignHeatLoadKw: postDesignHeatLoadKw,
    indicativeRequiredPowerKw,
    indicativePowerMinKw,
    indicativePowerMaxKw,
    powerEstimateStatus: hasQualifiedEstimate
      ? "within_15_percent"
      : "insufficient_data",
    powerEstimateMarginPercent: hasQualifiedEstimate
      ? POWER_MARGIN_PERCENT
      : null,
    powerEstimateMissingInputs: missingInputs,
    confidence: hasQualifiedEstimate ? "wystarczająca" : "niewystarczająca",
    currentUValues,
    postModernizationUValues: {
      wall: round(postWallU, 2),
      roof: round(postRoofU, 2),
      floor: round(postFloorU, 2),
      window: round(postWindowU, 2),
      door: round(postDoorU, 2),
    },
    geometry: {
      footprintM2: round(geometry.footprintM2, 1),
      heatedVolumeM3: round(geometry.heatedVolumeM3, 1),
      netWallAreaM2: round(geometry.netWallAreaM2, 1),
      roofAreaM2: round(geometry.roofAreaM2, 1),
      floorAreaM2: round(geometry.floorAreaM2, 1),
      windowAreaM2: round(geometry.windowAreaM2, 1),
      doorAreaM2: round(geometry.doorAreaM2, 1),
    },
    heatLoss: {
      currentTransmissionWPerK: round(currentTransmission, 1),
      postTransmissionWPerK: round(postTransmission, 1),
      ventilationWPerK: round(ventilationLoss, 1),
    },
    workScope,
    advancedEnergy,
    calculationAssumptions,
    disclaimer:
      "Przedział mocy ma margines ±15% i jest prezentowany wyłącznie przy kompletnych danych ankiety. Ostateczną moc musi potwierdzić audytor lub projektant po audycie, DPAE i obliczeniach PN-EN 12831.",
    calculationMethod:
      "Uproszczone projektowe obciążenie cieplne H = Σ(U·A·b) + 0,34·n·V. Po włączeniu trybu zaawansowanego roczne EU jest szacowane ze stopniodni ogrzewania, strat przegród i wentylacji oraz standardowych zysków ciepła.",
  };
}
