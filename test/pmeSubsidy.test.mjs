import assert from "node:assert/strict";
import test from "node:test";

import { calculatePmeSubsidy } from "../lib/calculator/pmeSubsidy.ts";

const baseInput = {
  enabled: true,
  billingSystem: "net_billing",
  storageCapacityKwh: 15,
  availableOfferNet: 42000,
  vatRate: 8,
  qualifyVat: false,
  storageIsEu: true,
  inverterIsEu: false,
};

test("15 kWh za 42 000 zł netto z produktem UE daje 12 000 + 2 000 zł", () => {
  const result = calculatePmeSubsidy(baseInput);

  assert.equal(result.storageSubsidy, 12000);
  assert.equal(result.euBonus, 2000);
  assert.equal(result.total, 14000);
  assert.equal(result.storageNet, 40000);
  assert.equal(baseInput.availableOfferNet - result.storageNet, 2000);
});

test("bez produktu UE nie nalicza bonusu", () => {
  const result = calculatePmeSubsidy({ ...baseInput, storageIsEu: false });

  assert.equal(result.storageSubsidy, 12000);
  assert.equal(result.euBonus, 0);
  assert.equal(result.total, 12000);
});

test("sam falownik UE kwalifikuje konfigurację do jednorazowego bonusu", () => {
  const result = calculatePmeSubsidy({
    ...baseInput,
    storageIsEu: false,
    inverterIsEu: true,
  });

  assert.equal(result.euBonus, 2000);
  assert.equal(result.total, 14000);
});

test("globalny przełącznik może włączyć VAT do kosztu kwalifikowanego", () => {
  const netResult = calculatePmeSubsidy({
    ...baseInput,
    storageCapacityKwh: 10,
    availableOfferNet: 10000,
    storageIsEu: false,
  });
  const grossResult = calculatePmeSubsidy({
    ...baseInput,
    storageCapacityKwh: 10,
    availableOfferNet: 10000,
    storageIsEu: false,
    qualifyVat: true,
  });

  assert.equal(netResult.storageSubsidy, 3000);
  assert.equal(grossResult.storageSubsidy, 3240);
  assert.equal(grossResult.qualifyingVat, 800);
});

test("bonus nie przekracza 50% kosztu kwalifikowanego", () => {
  const result = calculatePmeSubsidy({
    ...baseInput,
    storageCapacityKwh: 10,
    availableOfferNet: 3000,
  });

  assert.equal(result.euBonus, 1500);
});

test("magazyn UE zachowuje bonus, gdy klient ma własny falownik", () => {
  const result = calculatePmeSubsidy({
    ...baseInput,
    storageIsEu: true,
    inverterIsEu: false,
  });

  assert.equal(result.euBonusEligible, true);
  assert.equal(result.euBonus, 2000);
  assert.equal(result.total, 14000);
});

test("własny falownik i magazyn spoza UE nie dają bonusu", () => {
  const result = calculatePmeSubsidy({
    ...baseInput,
    storageIsEu: false,
    inverterIsEu: false,
  });

  assert.equal(result.euBonusEligible, false);
  assert.equal(result.euBonus, 0);
  assert.equal(result.total, 12000);
});
