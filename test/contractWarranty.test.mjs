import assert from "node:assert/strict";
import test from "node:test";

import {
  findWarrantyCatalogItem,
  makeContractWarrantyRow,
} from "../lib/contractWarranty.ts";

const catalog = [
  {
    code: "AIKO_460",
    manufacturer: "AIKO",
    model: "A-MAH54Db 460 W",
    display_name: "AIKO A-MAH54Db 460 FB",
    warranty_guarantor: "AIKO Energy",
    warranty_period: "25 lat",
  },
  {
    manufacturer: "EcoBSS",
    model: "Flex 3L 8K",
    display_name: "EcoBSS Flex 3L 8K hybrydowy",
    warranty_guarantor: "EcoBSS Polska",
    warranty_period: "12 lat",
  },
];

test("odnajduje urządzenie po kodzie lub nazwie zapisanej w ofercie", () => {
  assert.equal(findWarrantyCatalogItem(catalog, "AIKO_460"), catalog[0]);
  assert.equal(
    findWarrantyCatalogItem(catalog, "Falownik ECOBSS FLEX 3L 8K HYBRYDOWY"),
    catalog[1]
  );
});

test("buduje kompletny wiersz gwarancji do umowy", () => {
  assert.deepEqual(makeContractWarrantyRow(catalog, "AIKO_460"), {
    producerAndModel: "AIKO A-MAH54Db 460 W",
    guarantor: "AIKO Energy",
    period: "25 lat",
  });
});

test("dla starszej pozycji spoza katalogu pozostawia opis bez zmyślania gwarancji", () => {
  assert.deepEqual(makeContractWarrantyRow(catalog, "Stary model", "Stary model"), {
    producerAndModel: "Stary model",
    guarantor: "",
    period: "",
  });
});
