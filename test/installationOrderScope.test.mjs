import assert from "node:assert/strict";
import test from "node:test";

import { getInstallationOrderScope } from "../lib/installationOrderScope.ts";

test("oferta samego magazynu ignoruje domyślne dane paneli w snapshotcie", () => {
  assert.deepEqual(
    getInstallationOrderScope({
      sold_items: "Magazyn energii * Deye SE-G5.1 Pro-B - 5.12 kWh",
      offer_snapshot: {
        offer_type: "storage",
        panel_model: "LONGI_SOLAR_470_FB",
        panel_count: 16,
        panel_power_wp: 470,
        pv_power_kw: 0,
      },
    }),
    { hasPv: false, hasStorage: true }
  );
});

test("oferta PV z magazynem obejmuje oba zakresy", () => {
  assert.deepEqual(
    getInstallationOrderScope({ offer_snapshot: { offer_type: "pv_storage" } }),
    { hasPv: true, hasStorage: true }
  );
});

test("dla starszej sprzedaży zakres jest odczytywany z listy sprzedanych pozycji", () => {
  assert.deepEqual(
    getInstallationOrderScope({
      sold_items: "Instalacja fotowoltaiczna 8 kWp",
      offer_snapshot: { panel_count: 18 },
    }),
    { hasPv: true, hasStorage: false }
  );
});
