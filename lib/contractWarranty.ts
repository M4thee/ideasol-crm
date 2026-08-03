export type WarrantyCatalogItem = {
  code?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  display_name?: string | null;
  name?: string | null;
  warranty_guarantor?: string | null;
  warranty_period?: string | null;
};

export type ContractWarrantyRow = {
  producerAndModel: string;
  guarantor: string;
  period: string;
};

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeWarrantyEquipmentName(value: unknown) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function searchableNames(item: WarrantyCatalogItem) {
  return [item.code, item.model, item.display_name, item.name]
    .map(normalizeWarrantyEquipmentName)
    .filter((value) => value.length >= 3);
}

export function findWarrantyCatalogItem(
  items: WarrantyCatalogItem[],
  selectedEquipmentName: unknown
) {
  const selected = normalizeWarrantyEquipmentName(selectedEquipmentName);

  if (!selected) return null;

  const exactMatch = items.find((item) =>
    searchableNames(item).some((candidate) => candidate === selected)
  );

  if (exactMatch) return exactMatch;

  return (
    items
      .flatMap((item) =>
        searchableNames(item).map((candidate) => ({ item, candidate }))
      )
      .filter(
        ({ candidate }) =>
          selected.includes(candidate) || candidate.includes(selected)
      )
      .sort((left, right) => right.candidate.length - left.candidate.length)[0]
      ?.item ?? null
  );
}

export function formatProducerAndModel(item: WarrantyCatalogItem | null) {
  if (!item) return "";

  const manufacturer = clean(item.manufacturer);
  const model = clean(item.model);

  if (!manufacturer) return model || clean(item.display_name) || clean(item.name);
  if (!model) return manufacturer;

  const normalizedManufacturer = normalizeWarrantyEquipmentName(manufacturer);
  const normalizedModel = normalizeWarrantyEquipmentName(model);

  return normalizedModel.startsWith(normalizedManufacturer)
    ? model
    : `${manufacturer} ${model}`;
}

export function makeContractWarrantyRow(
  items: WarrantyCatalogItem[],
  selectedEquipmentName: unknown,
  fallbackProducerAndModel = ""
): ContractWarrantyRow {
  const item = findWarrantyCatalogItem(items, selectedEquipmentName);

  return {
    producerAndModel: formatProducerAndModel(item) || clean(fallbackProducerAndModel),
    guarantor: clean(item?.warranty_guarantor),
    period: clean(item?.warranty_period),
  };
}
