import assert from "node:assert/strict";
import test from "node:test";

import {
  getCalculatorProgram,
  summarizeArimr2026Program,
} from "../lib/calculator/arimr2026Sales.ts";

const settings = {
  planKw: 40,
  pvPlanKwPerKwp: 1,
  storagePlanKwPerUnit: 5,
  pvCompensationNetPerKwp: 200,
  storageCompensationNetPerKwh: 150,
  maxMultiplierPercent: 150,
};

test("rozpoznaje sprzedaż ARiMR po znaczniku zapisanym w snapshotcie oferty", () => {
  assert.equal(
    getCalculatorProgram({
      offer_snapshot: {
        offer_data: { result: { calculatorProgram: "arimr2026" } },
      },
    }),
    "arimr2026"
  );
  assert.equal(getCalculatorProgram({ customer_data: { calculator_program: "standard" } }), "standard");
});

test("sumuje program dla doradcy i skaluje prowizję poziomem realizacji", () => {
  const report = summarizeArimr2026Program(
    [
      {
        id: "sale-1",
        seller_id: "seller-1",
        status: "Oczekuje na sprawdzenie dokumentów",
        offer_snapshot: {
          pv_power_kw: 20,
          installation_count: 1,
          offer_data: {
            result: {
              calculatorProgram: "arimr2026",
              storageCapacityKwh: 30,
            },
          },
        },
      },
    ],
    [{ id: "seller-1", name: "Anna" }],
    settings
  );

  assert.equal(report.salesCount, 1);
  assert.equal(report.pvPowerKwp, 20);
  assert.equal(report.storageCapacityKwh, 30);
  assert.equal(report.advisors[0].planContributionKw, 25);
  assert.equal(report.advisors[0].planCompletionPercent, 62.5);
  assert.equal(report.advisors[0].pvCompensationNet, 2500);
  assert.equal(report.advisors[0].storageCompensationNet, 2812.5);
  assert.equal(report.advisors[0].compensationNet, 5312.5);
});

test("liczy plan łącznie z wielu sprzedaży i ogranicza wypłatę do 150 procent", () => {
  const report = summarizeArimr2026Program(
    [
      {
        seller_id: "seller-1",
        status: "Zakończony",
        pv_power_kw: 40,
        customer_data: {
          calculator_program: "arimr2026",
          storage_capacity_kwh: 30,
          installation_count: 1,
        },
      },
      {
        seller_id: "seller-1",
        status: "Zakończony",
        pv_power_kw: 30,
        customer_data: {
          calculator_program: "arimr2026",
          storage_capacity_kwh: 20,
          installation_count: 1,
        },
      },
      {
        seller_id: "seller-1",
        status: "Anulowana",
        pv_power_kw: 100,
        customer_data: { calculator_program: "arimr2026" },
      },
    ],
    [{ id: "seller-1", name: "Anna" }],
    settings
  );

  const advisor = report.advisors[0];
  assert.equal(advisor.salesCount, 2);
  assert.equal(advisor.planContributionKw, 80);
  assert.equal(advisor.planCompletionPercent, 200);
  assert.equal(advisor.payoutMultiplierPercent, 150);
  assert.equal(advisor.compensationNet, 32250);
});
