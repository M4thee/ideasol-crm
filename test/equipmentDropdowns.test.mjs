import assert from "node:assert/strict";
import test from "node:test";

import { groupEquipmentByManufacturer } from "../lib/calculator/equipmentDropdowns.ts";

test("grupuje sprzęt według producenta i sortuje grupy alfabetycznie", () => {
  const groups = groupEquipmentByManufacturer(
    [
      { manufacturer: "Sigenergy", name: "SigenStor 12", capacity: 12 },
      { manufacturer: "Deye", name: "RW-M6.1", capacity: 6.1 },
      { manufacturer: "Sigenergy", name: "SigenStor 9", capacity: 9 },
    ],
    (item) => item.capacity,
    (item) => item.name
  );

  assert.deepEqual(
    groups.map((group) => group.manufacturer),
    ["Deye", "Sigenergy"]
  );
  assert.deepEqual(
    groups[1].items.map((item) => item.capacity),
    [9, 12]
  );
});

test("sprzęt bez producenta umieszcza na końcu", () => {
  const groups = groupEquipmentByManufacturer(
    [
      { manufacturer: null, name: "Inny", power: 5 },
      { manufacturer: "Huawei", name: "SUN2000", power: 10 },
    ],
    (item) => item.power,
    (item) => item.name
  );

  assert.deepEqual(
    groups.map((group) => group.manufacturer),
    ["Huawei", "Pozostali producenci"]
  );
});

test("odtwarza producenta ze starszego cache na podstawie nazwy sprzętu", () => {
  const groups = groupEquipmentByManufacturer(
    [
      { name: "DEYE GB-L (8,18 kWh)", capacity: 8.18 },
      { name: "Sigenergy SigenStor 9 kWh", capacity: 9 },
      { name: "2x EcoBSS STORE L15 - 30 kWh", capacity: 30 },
    ],
    (item) => item.capacity,
    (item) => item.name
  );

  assert.deepEqual(
    groups.map((group) => group.manufacturer),
    ["Deye", "EcoBSS", "Sigenergy"]
  );
});

test("łączy różne warianty zapisu nazwy producenta w jedną grupę", () => {
  const groups = groupEquipmentByManufacturer(
    [
      { manufacturer: "DEYE", name: "GB-L 8", capacity: 8 },
      { manufacturer: "Deye", name: "GB-L 16", capacity: 16 },
    ],
    (item) => item.capacity,
    (item) => item.name
  );

  assert.equal(groups.length, 1);
  assert.equal(groups[0].manufacturer, "Deye");
  assert.deepEqual(
    groups[0].items.map((item) => item.capacity),
    [8, 16]
  );
});
