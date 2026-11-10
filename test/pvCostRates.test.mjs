import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  calculatePvInstallationCost,
  calculatePvStructureCost,
  DEFAULT_PV_INSTALLATION_RATES,
  getPvInstallationRate,
} from "../lib/calculator/pvCostRates.ts";

test("progi montażu PV obejmują całą moc i mają poprawne granice", () => {
  const cases = [
    [1, 600],
    [10, 600],
    [10.01, 570],
    [20, 570],
    [20.01, 480],
    [40, 480],
    [40.01, 360],
    [100, 360],
    [100.01, 320],
  ];

  for (const [power, expectedRate] of cases) {
    assert.equal(getPvInstallationRate(power, DEFAULT_PV_INSTALLATION_RATES), expectedRate);
    assert.equal(
      calculatePvInstallationCost(power, DEFAULT_PV_INSTALLATION_RATES),
      power * expectedRate
    );
  }
});

test("koszt konstrukcji to całkowita moc razy osobna stawka rodzaju", () => {
  const rates = { blacha: 111, dachowka: 222, papa: 333, grunt: 444 };

  assert.equal(calculatePvStructureCost(12.5, "blacha", rates), 1387.5);
  assert.equal(calculatePvStructureCost(12.5, "dachowka", rates), 2775);
  assert.equal(calculatePvStructureCost(12.5, "papa", rates), 4162.5);
  assert.equal(calculatePvStructureCost(12.5, "grunt", rates), 5550);
});

test("brak stawki konstrukcji nie jest zastępowany zgadywaną ceną", () => {
  assert.throws(
    () => calculatePvStructureCost(8, "grunt", { blacha: 100, dachowka: 100, papa: 100, grunt: null }),
    /Brak skonfigurowanej stawki/
  );
});

test("kalkulator Incognito zachowuje odrębną historyczną ścieżkę kosztów", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib/calculator/calculateOffer.ts"),
    "utf8"
  );

  assert.match(source, /const LEGACY_INCOGNITO_ROOF_COSTS = \{[\s\S]*?grunt: 4500/);
  assert.match(
    source,
    /pricingMode === "incognito"[\s\S]*?pvPowerKw \* pricing\.pvInstallationPerKwNet/
  );
  assert.match(
    source,
    /pricingMode === "incognito"[\s\S]*?pricing\.roofRates\[roofType\][\s\S]*?: calculatePvStructureCost/
  );
});

test("migracja zapisuje uzgodnione stawki konstrukcji tylko w cenniku standardowym", () => {
  const migration = fs.readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20261110093201_external_lead_dedup_and_standard_pv_rates.sql"
    ),
    "utf8"
  );

  assert.match(migration, /pv_structure_sheet_rate_per_kwp[^\n]*default 175/);
  assert.match(migration, /pv_structure_tile_rate_per_kwp[^\n]*default 260/);
  assert.match(migration, /pv_structure_felt_rate_per_kwp[^\n]*default 325/);
  assert.match(migration, /pv_structure_ground_rate_per_kwp[^\n]*default 325/);
  assert.doesNotMatch(migration, /alter table public\.incognito_pricing_settings/);
});

test("panel administratora ładuje i zapisuje nowy format cennika standardowego", () => {
  const adminPage = fs.readFileSync(
    path.join(process.cwd(), "app/admin/users/page.tsx"),
    "utf8"
  );

  assert.match(adminPage, /pvRates:\s*\{[\s\S]*?upTo10:\s*600[\s\S]*?above100:\s*320/);
  assert.match(adminPage, /roof:\s*\{[\s\S]*?blacha:\s*175[\s\S]*?grunt:\s*325/);
  assert.match(adminPage, /pv_installation_rate_1_10:\s*pricing\.installation\.pvRates\.upTo10/);
  assert.match(adminPage, /pv_structure_ground_rate_per_kwp:\s*pricing\.roof\.grunt/);
});

test("panel Incognito zachowuje historyczne pojedyncze pole montażu PV", () => {
  const adminPage = fs.readFileSync(
    path.join(process.cwd(), "app/admin/users/page.tsx"),
    "utf8"
  );
  const adminPanel = fs.readFileSync(
    path.join(process.cwd(), "components/calculator/AdminPanel.tsx"),
    "utf8"
  );

  assert.match(adminPage, /pricingMode="incognito"/);
  assert.match(adminPanel, /pricingMode === "standard"/);
  assert.match(
    adminPanel,
    /Montaż PV netto \/ kWp[\s\S]*?\["installation", "pvPerKwNet"\]/
  );
});
