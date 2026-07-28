export type PmeBillingSystem = "net_billing" | "net_metering";

export type PmeSubsidyInput = {
  enabled: boolean;
  billingSystem: PmeBillingSystem;
  storageCapacityKwh: number;
  availableOfferNet: number;
  vatRate: number;
  qualifyVat: boolean;
  storageIsEu: boolean;
  inverterIsEu: boolean;
};

export type PmeSubsidyResult = {
  storageNet: number;
  qualifyingStorageCost: number;
  qualifyingVat: number;
  storageSubsidy: number;
  euBonus: number;
  total: number;
  programCap: number;
  storageCapByKwh: number;
  maxStorageSubsidy: number;
  euBonusEligible: boolean;
  qualifyVat: boolean;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculatePmeSubsidy(input: PmeSubsidyInput): PmeSubsidyResult {
  const programCap = input.billingSystem === "net_billing" ? 16000 : 8000;
  const storageCapacityKwh = Math.max(0, Number(input.storageCapacityKwh || 0));
  const availableOfferNet = Math.max(0, Number(input.availableOfferNet || 0));
  const vatMultiplier = input.qualifyVat
    ? 1 + Math.max(0, Number(input.vatRate || 0)) / 100
    : 1;
  const storageCapByKwh = input.enabled ? storageCapacityKwh * 800 : 0;
  const maxStorageSubsidy = input.enabled
    ? Math.min(storageCapByKwh, programCap)
    : 0;
  const maxQualifyingCostByCapacity = storageCapacityKwh * 3000;
  const idealQualifyingCost = maxStorageSubsidy / 0.3;
  const availableQualifyingCost = availableOfferNet * vatMultiplier;
  const qualifyingStorageCost = input.enabled
    ? Math.min(
        idealQualifyingCost,
        maxQualifyingCostByCapacity,
        availableQualifyingCost
      )
    : 0;
  const storageNet = qualifyingStorageCost / vatMultiplier;
  const storageSubsidy = input.enabled
    ? Math.min(qualifyingStorageCost * 0.3, storageCapByKwh, programCap)
    : 0;
  const euBonusEligible = Boolean(
    input.enabled &&
    (input.storageIsEu || input.inverterIsEu)
  );
  const euBonus = euBonusEligible
    ? Math.min(qualifyingStorageCost * 0.5, 2000)
    : 0;

  return {
    storageNet: roundMoney(storageNet),
    qualifyingStorageCost: roundMoney(qualifyingStorageCost),
    qualifyingVat: roundMoney(qualifyingStorageCost - storageNet),
    storageSubsidy: roundMoney(storageSubsidy),
    euBonus: roundMoney(euBonus),
    total: roundMoney(storageSubsidy + euBonus),
    programCap,
    storageCapByKwh: roundMoney(storageCapByKwh),
    maxStorageSubsidy: roundMoney(maxStorageSubsidy),
    euBonusEligible,
    qualifyVat: input.qualifyVat,
  };
}
