export type ManufacturerGroup<T> = {
  manufacturer: string;
  items: T[];
};

type EquipmentWithManufacturer = {
  manufacturer?: string | null;
};

const UNKNOWN_MANUFACTURER = "Pozostali producenci";

function normalizeManufacturer(value: string | null | undefined) {
  const manufacturer = String(value || "").trim();
  return manufacturer || UNKNOWN_MANUFACTURER;
}

export function groupEquipmentByManufacturer<T extends EquipmentWithManufacturer>(
  items: T[],
  getOrderValue: (item: T) => number,
  getDisplayName: (item: T) => string
): ManufacturerGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const manufacturer = normalizeManufacturer(item.manufacturer);
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
