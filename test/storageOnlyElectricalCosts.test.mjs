import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});
const { calculateOffer } = await import("../lib/calculator/calculateOffer.ts");
const { resolveElectricalCosts, isValidStorageOnlyElectricalCosts } = await import("../lib/calculator/electricalCosts.ts");
const { resolveIncognitoPricingMode } = await import("../lib/incognitoSales.ts");

const catalog = {
  panels: { panel: { name: "Panel", displayName: "Panel", powerWp: 500, priceNet: 300 } },
  inverters: [{ name: "Hybrid", displayName: "Hybrid", type: "hybrid", batteryVoltageType: "low_voltage", maxPvKw: 50, priceNet: 4000 }],
  storages: {
    none: { name: "Brak", displayName: "Brak", capacityKwh: 0, priceNet: 0, installationNet: 0 },
    battery: { name: "ME", displayName: "ME", voltageType: "low_voltage", capacityKwh: 15, priceNet: 10000, installationNet: 1500 },
  },
};
const baseSettings = {
  protections_cost: 1400, wiring_cost: 800, warranty_percent: 0,
  pv_structure_sheet_rate_per_kwp: 175,
};
const modes = {
  standard: { ...baseSettings, storage_only_protections_cost: 450, storage_only_wiring_cost: 250, owners_count: 3 },
  incognito: { ...baseSettings, protections_cost: 1300, wiring_cost: 700, storage_only_protections_cost: 320, storage_only_wiring_cost: 180, owners_count: 2 },
};
function body(offerType, extra = {}) {
  return { offerType, panelModel: "panel", panelCount: 20, roofType: "blacha", storage: offerType === "pv" ? "none" : "battery", selectedInverterName: "Hybrid", vatRate: 8, sellerMarkup: 3000, includeSubsidy: false, ...extra };
}
function calculate(offerType, settingsRow, extra = {}, pricingMode = "standard") {
  return calculateOffer({ body: body(offerType, extra), settingsRow, catalog, pricingMode });
}
function cost(result, label) { return result.breakdown.find((line) => line.label === label).value; }

for (const [mode, settings] of Object.entries(modes)) {
  for (const type of ["pv", "pv_storage", "storage"]) {
    test(`${mode}: ${type} wybiera właściwe stawki i zachowuje zgodne sumy`, () => {
      const result = calculate(type, settings, {}, mode);
      const legacy = calculate(type, { ...settings, storage_only_protections_cost: null, storage_only_wiring_cost: null }, {}, mode);
      assert.equal(cost(result, "Zabezpieczenia"), type === "storage" ? settings.storage_only_protections_cost : settings.protections_cost);
      assert.equal(cost(result, "Okablowanie"), type === "storage" ? settings.storage_only_wiring_cost : settings.wiring_cost);
      if (type !== "storage") assert.deepEqual(result, legacy);
      else {
        const delta = settings.storage_only_protections_cost + settings.storage_only_wiring_cost - settings.protections_cost - settings.wiring_cost;
        assert.equal(result.finalNet, legacy.finalNet + delta);
        assert.equal(result.basePriceNet, legacy.basePriceNet + delta);
      }
      assert.equal(result.contractBreakdown.total.netAfterDiscount, result.finalNet);
      const sum = Object.entries(result.contractBreakdown).filter(([key]) => key !== "total").reduce((total, [, line]) => total + line.netAfterDiscount, 0);
      assert.ok(Math.abs(sum - result.finalNet) < 0.02);
    });
  }
}

test("opłaty dla samego ME są stałe także przy istniejącym PV i własnym falowniku", () => {
  for (const power of [0, 2, 20]) {
    for (const capacity of [5, 66]) {
      const result = calculateOffer({
        body: body("storage", { isUpsell: true, existingPvPowerKw: power, clientHasOwnHybridInverter: true }),
        settingsRow: modes.standard,
        catalog: { ...catalog, storages: { ...catalog.storages, battery: { ...catalog.storages.battery, capacityKwh: capacity } } },
      });
      assert.equal(cost(result, "Zabezpieczenia"), 450);
      assert.equal(cost(result, "Okablowanie"), 250);
    }
  }
});

test("zmiana jednej stawki ME nie zmienia drugiej ani PV", () => {
  for (const [column, label] of [["storage_only_protections_cost", "Zabezpieczenia"], ["storage_only_wiring_cost", "Okablowanie"]]) {
    const before = calculate("storage", modes.standard);
    const after = calculate("storage", { ...modes.standard, [column]: modes.standard[column] + 100 });
    assert.equal(after.finalNet, before.finalNet + 100);
    assert.equal(cost(after, label), cost(before, label) + 100);
    for (const type of ["pv", "pv_storage"]) assert.deepEqual(calculate(type, modes.standard), calculate(type, { ...modes.standard, [column]: 9999 }));
  }
});

test("zero jest prawidłową stawką, a nie sygnałem powrotu do starej ceny", () => {
  const result = calculate("storage", { ...modes.standard, storage_only_protections_cost: 0, storage_only_wiring_cost: 0 });
  assert.equal(cost(result, "Zabezpieczenia"), 0);
  assert.equal(cost(result, "Okablowanie"), 0);
});

test("stare dane zachowują własne stawki, a brak tylko jednej nowej wartości nie nadpisuje drugiej", () => {
  assert.deepEqual(resolveElectricalCosts({ storageOnly: true, protections: 1234, wiring: 567 }), { protections: 1234, wiring: 567 });
  assert.deepEqual(resolveElectricalCosts({ storageOnly: true, protections: 1234, wiring: 567, storageOnlyProtections: 0 }), { protections: 0, wiring: 567 });
});

test("zapis panelu odrzuca puste i błędne kwoty, ale dopuszcza zero i grosze", () => {
  for (const value of [null, undefined, "", "10", -1, NaN, Infinity]) {
    assert.equal(isValidStorageOnlyElectricalCosts({ storageOnlyProtections: value, storageOnlyWiring: 100 }), false);
    assert.equal(isValidStorageOnlyElectricalCosts({ storageOnlyProtections: 100, storageOnlyWiring: value }), false);
  }
  assert.equal(isValidStorageOnlyElectricalCosts({ storageOnlyProtections: 0, storageOnlyWiring: 123.45 }), true);
  for (const value of [-1, NaN, Infinity]) assert.throws(() => calculate("storage", { ...modes.standard, storage_only_wiring_cost: value }), /Nieprawidłowe stawki/);
});

test("serwerowe stawki ME mają pierwszeństwo przed starymi danymi aplikacji", () => {
  const result = calculate("storage", modes.standard, { pricingOverrides: { placeholders: { protections: 9999, wiring: 9999, storageOnlyProtections: 1, storageOnlyWiring: 1 } } });
  assert.equal(cost(result, "Zabezpieczenia"), 450);
  assert.equal(cost(result, "Okablowanie"), 250);
});

const routeSource = ts.transpileModule(readFileSync(new URL("../app/api/calculate/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function setupApi(canIncognito = true) {
  const selections = [];
  const tables = {
    pricing_settings: modes.standard, incognito_pricing_settings: modes.incognito,
    profiles: { id: "advisor", role: "seller", manager_id: null },
    user_permissions: { ideasol: true, incognito_sales: canIncognito, custom_mode: false },
    panels: [{ code: "panel", name: "Panel", power_wp: 500, price_net: 300 }],
    inverters: [{ name: "Hybrid", type: "hybrid", battery_voltage_type: "low_voltage", max_pv_kw: 50, price_net: 4000 }],
    storages: [{ code: "battery", name: "ME", voltage_type: "low_voltage", capacity_kwh: 15, price_net: 10000, installation_net: 1500 }],
  };
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: "advisor" } }, error: null }) },
    from(table) {
      const query = {
        select(columns) { selections.push({ table, columns }); return query; },
        eq() { return query; }, order() { return query; }, single() { return query; }, maybeSingle() { return query; },
        then(resolve, reject) { return Promise.resolve({ data: tables[table], error: null }).then(resolve, reject); },
      };
      return query;
    },
  };
  const exports = {};
  vm.runInNewContext(routeSource, {
    exports, console, process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://pricing-test.invalid", SUPABASE_SERVICE_ROLE_KEY: "fake", NODE_ENV: "production" } },
    require(name) {
      if (name === "@supabase/supabase-js") return { createClient: () => db };
      if (name === "next/server") return { NextResponse: { json: (body, init) => Response.json(body, init) } };
      if (name === "@/lib/calculator/calculateOffer") return { calculateOffer };
      if (name === "@/lib/incognitoSales") return { resolveIncognitoPricingMode };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return {
    selections,
    async call(incognito, offerType = "storage") {
      return exports.POST(new Request("https://pricing-test.invalid/api/calculate", {
        method: "POST", headers: { Authorization: "Bearer fake" }, body: JSON.stringify(body(offerType, { incognito })),
      }));
    },
  };
}
for (const incognito of [false, true]) {
  test(`API używane przez iOS i Android: ${incognito ? "Incognito" : "standard"} pobiera osobne stawki ME`, async () => {
    const api = setupApi();
    const response = await api.call(incognito);
    assert.equal(response.status, 200);
    const result = await response.json();
    const mode = incognito ? "incognito" : "standard";
    assert.equal(result.pricingMode, mode);
    assert.equal(cost(result, "Zabezpieczenia"), modes[mode].storage_only_protections_cost);
    assert.equal(cost(result, "Okablowanie"), modes[mode].storage_only_wiring_cost);
    const selected = api.selections.find(({ table }) => table === `${incognito ? "incognito_" : ""}pricing_settings`);
    assert.ok(selected.columns.includes("storage_only_protections_cost"));
    assert.ok(selected.columns.includes("storage_only_wiring_cost"));
    assert.equal(api.selections.some(({ table }) => table === `${incognito ? "" : "incognito_"}pricing_settings`), false);
  });
}
test("dodanie stawek nie otwiera kalkulatora Incognito osobom bez uprawnienia", async () => {
  const response = await setupApi(false).call(true);
  assert.equal(response.status, 403);
});
