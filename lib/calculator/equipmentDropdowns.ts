export type ManufacturerGroup<T> = {
  manufacturer: string;
  items: T[];
};

type EquipmentWithManufacturer = {
  manufacturer?: string | null;
};

const UNKNOWN_MANUFACTURER = "Pozostali producenci";

const MANUFACTURER_LABELS = new Map([
  ["deye", "Deye"],
  ["dyness", "Dyness"],
  ["ecobss", "EcoBSS"],
  ["foxess", "FoxESS"],
  ["fronius", "Fronius"],
  ["goodwe", "GoodWe"],
  ["growatt", "Growatt"],
  ["huawei", "Huawei"],
  ["sigenergy", "Sigenergy"],
  ["sofar", "Sofar"],
  ["solaredge", "SolarEdge"],
  ["sungrow", "Sungrow"],
  ["victron", "Victron"],
]);

function getKnownManufacturer(value: string | null | undefined) {
  const normalizedValue = String(value || "").trim().toLocaleLowerCase("pl");

  if (!normalizedValue) return null;

  for (const [key, label] of MANUFACTURER_LABELS) {
    if (normalizedValue === key || normalizedValue.includes(key)) {
      return label;
    }
  }

  return null;
}

function normalizeManufacturer(
  value: string | null | undefined,
  equipmentName: string
) {
  const explicitManufacturer = String(value || "").trim();

  if (explicitManufacturer) {
    return getKnownManufacturer(explicitManufacturer) || explicitManufacturer;
  }

  return getKnownManufacturer(equipmentName) || UNKNOWN_MANUFACTURER;
}

export function groupEquipmentByManufacturer<T extends EquipmentWithManufacturer>(
  items: T[],
  getOrderValue: (item: T) => number,
  getDisplayName: (item: T) => string
): ManufacturerGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const manufacturer = normalizeManufacturer(
      item.manufacturer,
      getDisplayName(item)
    );
    const group = groups.get(manufacturer) || [];
    group.push(item);
    groups.set(manufacturer, group);
  }

  return [...groups.entries()]
    .sort(([firstManufacturer], [secondManufacturer]) => {
      if (firstManufacturer === UNKNOWN_MANUFACTURER) return 1;
      if (secondManufacturer === UNKNOWN_MANUFACTURER) return -1;
      return firstManufacturer.localeCompare(secondManufacturer, "pl", {
        sensitivity: "base",
      });
    })
    .map(([manufacturer, groupItems]) => ({
      manufacturer,
      items: [...groupItems].sort((firstItem, secondItem) => {
        const orderDifference = getOrderValue(firstItem) - getOrderValue(secondItem);

        if (orderDifference !== 0) return orderDifference;

        return getDisplayName(firstItem).localeCompare(
          getDisplayName(secondItem),
          "pl",
          { sensitivity: "base", numeric: true }
        );
      }),
    }));
}
