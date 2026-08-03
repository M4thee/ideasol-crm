type JsonRecord = Record<string, unknown>;

type InstallationOrderSale = {
  id?: unknown;
  sold_items?: unknown;
  offer_snapshot?: unknown;
};

export type InstallationOrderScope = {
  hasPv: boolean;
  hasStorage: boolean;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function normalize(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");
}

function firstText(...values: unknown[]) {
  return values.find((value) => String(value || "").trim()) || "";
}

function positiveNumber(value: unknown) {
  const parsed = Number(String(value || "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0;
}

export function getInstallationOrderScope(
  sale: InstallationOrderSale
): InstallationOrderScope {
  const snapshot = asRecord(sale.offer_snapshot);
  const offerData = asRecord(snapshot.offer_data);
  const form = asRecord(offerData.form);
  const result = asRecord(offerData.result);
  const offerType = normalize(
    firstText(
      snapshot.offer_type,
      snapshot.offerType,
      offerData.offer_type,
      offerData.offerType,
      form.offer_type,
      form.offerType,
      result.offer_type,
      result.offerType
    )
  );

  if (offerType === "storage") return { hasPv: false, hasStorage: true };
  if (offerType === "pv") return { hasPv: true, hasStorage: false };
  if (
    offerType === "pv_storage" ||
    offerType === "storage_pv" ||
    (offerType.includes("pv") && offerType.includes("storage"))
  ) {
    return { hasPv: true, hasStorage: true };
  }

  const soldItems = normalize(sale.sold_items);
  const hasPvInSoldItems =
    soldItems.includes("fotowolta") ||
    soldItems.includes("panel") ||
    /(^|_)pv(_|$)/.test(soldItems);
  const hasStorageInSoldItems =
    soldItems.includes("magazyn_energii") || soldItems.includes("energy_storage");

  if (hasPvInSoldItems || hasStorageInSoldItems) {
    return {
      hasPv: hasPvInSoldItems,
      hasStorage: hasStorageInSoldItems,
    };
  }

  return {
    hasPv:
      positiveNumber(snapshot.pv_power_kw) ||
      positiveNumber(snapshot.pvPowerKw) ||
      positiveNumber(result.pvPowerKw),
    hasStorage: Boolean(
      firstText(
        snapshot.storage_name,
        snapshot.energy_storage,
        result.energyStorage,
        result.storage
      )
    ),
  };
}
