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
