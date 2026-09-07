export const ARIMR_2026_MOUNTING_LOCATIONS = [
  { value: "flat_roof", label: "Dach płaski" },
  { value: "pitched_sheet", label: "Dach skośny — blacha" },
  { value: "pitched_tile", label: "Dach skośny — dachówka" },
  { value: "ground", label: "Grunt" },
] as const;

export type Arimr2026MountingLocation =
  (typeof ARIMR_2026_MOUNTING_LOCATIONS)[number]["value"];

export type Arimr2026Settings = {
  pvReferenceRateNetPerKwp: number;
  storageReferenceRateNetPerKwh: number;
  supportPercent: number;
  areaBGrantLimit: number;
  minimumStorageKwhPerPvKwp: number;
  defaultVatRate: number;
  pvSaleRateNetPerKwp: number;
  storageSaleRateNetPerKwh: number;
  sellerMonthlyPlanKw: number;
  sellerPvPlanKwPerKwp: number;
  sellerStoragePlanKwPerUnit: number;
  sellerPvCompensationNetPerKwp: number;
  sellerStorageCompensationNetPerKwh: number;
  sellerMaxMultiplierPercent: number;
  pvInstallationCostNetPerKwp: number;
  storageInstallationCostNet: number;
  flatRoofCostNetPerKwp: number;
  pitchedSheetCostNetPerKwp: number;
  pitchedTileCostNetPerKwp: number;
  groundCostNetPerKwp: number;
  protectionsCostNet: number;
  wiringCostNet: number;
  transportElectronicsCostNet: number;
  transportPanelsCostNet: number;
  documentationCostNet: number;
  marketingCostNet: number;
  warrantyFundPercent: number;
};

export const DEFAULT_ARIMR_2026_SETTINGS: Arimr2026Settings = {
  pvReferenceRateNetPerKwp: 3_940,
  storageReferenceRateNetPerKwh: 2_250,
  supportPercent: 65,
  areaBGrantLimit: 200_000,
  minimumStorageKwhPerPvKwp: 0.5,
  defaultVatRate: 23,
  pvSaleRateNetPerKwp: 2_500,
  storageSaleRateNetPerKwh: 2_250,
  sellerMonthlyPlanKw: 40,
  sellerPvPlanKwPerKwp: 1,
  sellerStoragePlanKwPerUnit: 5,
  sellerPvCompensationNetPerKwp: 200,
  sellerStorageCompensationNetPerKwh: 150,
  sellerMaxMultiplierPercent: 150,
  pvInstallationCostNetPerKwp: 500,
  storageInstallationCostNet: 1_500,
  flatRoofCostNetPerKwp: 2_200,
  pitchedSheetCostNetPerKwp: 330,
  pitchedTileCostNetPerKwp: 2_000,
  groundCostNetPerKwp: 4_500,
  protectionsCostNet: 1_500,
  wiringCostNet: 800,
  transportElectronicsCostNet: 250,
  transportPanelsCostNet: 350,
  documentationCostNet: 700,
  marketingCostNet: 500,
  warrantyFundPercent: 15,
};

export type Arimr2026CalculationInput = {
  pvPowerKwp: number;
  storageCapacityKwh: number;
  mountingLocation: Arimr2026MountingLocation;
  additionalServicesNet?: number;
  vatRate?: number;
};

export type Arimr2026CalculationResult = {
  mountingLocation: Arimr2026MountingLocation;
  pvSaleRateNetPerKwp: number;
  storageSaleRateNetPerKwh: number;
  pvSalePriceNet: number;
  storageSalePriceNet: number;
  additionalServicesSalePriceNet: number;
  salePriceNet: number;
  salePriceGross: number;
  vatRate: number;
  pvReferenceBaseNet: number;
  storageReferenceBaseNet: number;
  pvGrant: number;
  storageGrant: number;
  grantBeforeLimit: number;
  grantAfterLimit: number;
  grantLimitReduction: number;
  customerPaymentNet: number;
  customerPaymentGross: number;
  effectiveCoveragePercent: number;
  requiredStorageCapacityKwh: number;
  meetsStorageRequirement: boolean;
  grantExceedsNetSalePrice: boolean;
  sellerPvPlanContributionKw: number;
  sellerStoragePlanContributionKw: number;
  sellerPlanContributionKw: number;
  sellerProgramPlanKw: number;
  sellerPlanSharePercent: number;
  sellerMonthlyPlanKw?: number;
  sellerPlanCompletionPercent?: number;
  sellerPayoutMultiplierPercent?: number;
  sellerBaseCompensationNet: number;
  sellerCompensationNet: number;
};

function finiteNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function calculateArimr2026(
  input: Arimr2026CalculationInput,
  settings: Arimr2026Settings = DEFAULT_ARIMR_2026_SETTINGS
): Arimr2026CalculationResult {
  const pvPowerKwp = finiteNonNegative(input.pvPowerKwp);
  const storageCapacityKwh = finiteNonNegative(input.storageCapacityKwh);
  const pvSaleRateNetPerKwp = finiteNonNegative(
    settings.pvSaleRateNetPerKwp
  );
  const storageSaleRateNetPerKwh = finiteNonNegative(
    settings.storageSaleRateNetPerKwh
  );
  const pvSalePriceNet = pvPowerKwp * pvSaleRateNetPerKwp;
  const storageSalePriceNet = storageCapacityKwh * storageSaleRateNetPerKwh;
  const additionalServicesSalePriceNet = finiteNonNegative(
    input.additionalServicesNet ?? 0
  );
  const salePriceNet =
    pvSalePriceNet + storageSalePriceNet + additionalServicesSalePriceNet;
  const vatRate = finiteNonNegative(input.vatRate ?? settings.defaultVatRate);

  const pvReferenceBaseNet =
    pvPowerKwp * finiteNonNegative(settings.pvReferenceRateNetPerKwp);
  const storageReferenceBaseNet =
    storageCapacityKwh *
    finiteNonNegative(settings.storageReferenceRateNetPerKwh);
  const supportRate = finiteNonNegative(settings.supportPercent) / 100;
  const pvGrant = pvReferenceBaseNet * supportRate;
  const storageGrant = storageReferenceBaseNet * supportRate;
  const grantBeforeLimit = pvGrant + storageGrant;
  const grantAfterLimit = Math.min(
    grantBeforeLimit,
    finiteNonNegative(settings.areaBGrantLimit)
  );
  const salePriceGross = salePriceNet * (1 + vatRate / 100);
  const requiredStorageCapacityKwh =
    pvPowerKwp * finiteNonNegative(settings.minimumStorageKwhPerPvKwp);

  const sellerPvPlanContributionKw =
    pvPowerKwp * finiteNonNegative(settings.sellerPvPlanKwPerKwp);
  const sellerStoragePlanContributionKw =
    storageCapacityKwh > 0
      ? finiteNonNegative(settings.sellerStoragePlanKwPerUnit)
      : 0;
  const sellerPlanContributionKw =
    sellerPvPlanContributionKw + sellerStoragePlanContributionKw;
  const monthlyPlanKw = finiteNonNegative(settings.sellerMonthlyPlanKw);
  const sellerPlanSharePercent =
    monthlyPlanKw > 0 ? (sellerPlanContributionKw / monthlyPlanKw) * 100 : 0;
  const sellerBaseCompensationNet =
    pvPowerKwp *
      finiteNonNegative(settings.sellerPvCompensationNetPerKwp) +
    storageCapacityKwh *
      finiteNonNegative(settings.sellerStorageCompensationNetPerKwh);
  const sellerCompensationNet = sellerBaseCompensationNet;

  return {
    mountingLocation: input.mountingLocation,
    pvSaleRateNetPerKwp,
    storageSaleRateNetPerKwh,
    pvSalePriceNet,
    storageSalePriceNet,
    additionalServicesSalePriceNet,
    salePriceNet,
    salePriceGross,
    vatRate,
    pvReferenceBaseNet,
    storageReferenceBaseNet,
    pvGrant,
    storageGrant,
    grantBeforeLimit,
    grantAfterLimit,
    grantLimitReduction: grantBeforeLimit - grantAfterLimit,
    customerPaymentNet: salePriceNet - grantAfterLimit,
    customerPaymentGross: salePriceGross - grantAfterLimit,
    effectiveCoveragePercent:
      salePriceNet > 0 ? (grantAfterLimit / salePriceNet) * 100 : 0,
    requiredStorageCapacityKwh,
    meetsStorageRequirement: storageCapacityKwh >= requiredStorageCapacityKwh,
    grantExceedsNetSalePrice: grantAfterLimit > salePriceNet,
    sellerPvPlanContributionKw,
    sellerStoragePlanContributionKw,
    sellerPlanContributionKw,
    sellerProgramPlanKw: monthlyPlanKw,
    sellerPlanSharePercent,
    sellerBaseCompensationNet,
    sellerCompensationNet,
  };
}
