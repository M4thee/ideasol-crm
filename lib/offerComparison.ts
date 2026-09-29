export const OFFER_COMPARISON_LIMIT = 5;

export type OfferComparisonCatalogCard = {
  deviceType: "panel" | "inverter" | "storage";
  title: string;
  fileName: string;
  url: string;
};

export type OfferComparisonVariant = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  createdAt: string;
  offerType: string;
  pvPowerKw: number;
  panelDescription: string;
  energyStorage: string;
  storageCapacityKwh?: number;
  inverter: string;
  finalNet: number;
  finalGross: number;
  vatRate: number;
  subsidyTotal: number;
  finalAfterSubsidy: number;
  catalogCards: OfferComparisonCatalogCard[];
};

function normalizeCatalogCardDeviceType(
  value: unknown
): OfferComparisonCatalogCard["deviceType"] | null {
  return value === "panel" || value === "inverter" || value === "storage"
    ? value
    : null;
}

function normalizeComparisonCatalogCards(
  value: unknown
): OfferComparisonCatalogCard[] {
  if (!Array.isArray(value)) return [];

  const seenUrls = new Set<string>();
  const seenDevices = new Set<string>();
  const result: OfferComparisonCatalogCard[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;

    const item = entry as Record<string, unknown>;
    const deviceType = normalizeCatalogCardDeviceType(item.deviceType);
    const title = String(item.title || "").trim().slice(0, 200);
    const fileName = String(item.fileName || "").trim().slice(0, 240);
    const url = String(item.url || item.catalogCardUrl || "").trim();

    if (!deviceType || !title || !url) continue;

    const normalizedUrl = url.toLocaleLowerCase("pl-PL");
    const deviceKey = `${deviceType}:${title.toLocaleLowerCase("pl-PL").replace(/\s+/g, " ")}`;

    if (seenUrls.has(normalizedUrl) || seenDevices.has(deviceKey)) continue;

    seenUrls.add(normalizedUrl);
    seenDevices.add(deviceKey);
    result.push({
      deviceType,
      title,
      fileName: fileName || `${deviceType}-${result.length + 1}.pdf`,
      url,
    });
  }

  return result;
}

export function normalizeOfferComparisonVariants(
  value: unknown
): OfferComparisonVariant[] {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, OFFER_COMPARISON_LIMIT)
    .map((entry, index) => {
      const item = entry && typeof entry === "object"
        ? entry as Record<string, unknown>
        : {};
      const finalGross = Number(item.finalGross || 0);
      const subsidyTotal = Math.max(0, Number(item.subsidyTotal || 0));
      const clientId = String(item.clientId || "").trim();

      return {
        id: String(item.id || `variant-${index + 1}`),
        name: String(item.name || `Wariant ${index + 1}`).trim().slice(0, 80) || `Wariant ${index + 1}`,
        clientId,
        clientName: String(item.clientName || "Klient").trim().slice(0, 160) || "Klient",
        createdAt: String(item.createdAt || new Date().toISOString()),
        offerType: String(item.offerType || "pv_storage"),
        pvPowerKw: Math.max(0, Number(item.pvPowerKw || 0)),
        panelDescription: String(item.panelDescription || "Brak").trim().slice(0, 300) || "Brak",
        energyStorage: String(item.energyStorage || "Brak").trim().slice(0, 300) || "Brak",
        storageCapacityKwh: Number(item.storageCapacityKwh || 0) || undefined,
        inverter: String(item.inverter || "Brak").trim().slice(0, 300) || "Brak",
        finalNet: Math.max(0, Number(item.finalNet || 0)),
        finalGross,
        vatRate: Math.max(0, Number(item.vatRate || 0)),
        subsidyTotal,
        finalAfterSubsidy: Math.max(0, finalGross - subsidyTotal),
        catalogCards: normalizeComparisonCatalogCards(item.catalogCards),
      };
    })
    .filter((variant) => variant.clientId && variant.finalGross > 0);
}

export function collectUniqueComparisonCatalogCards(
  variants: OfferComparisonVariant[]
): OfferComparisonCatalogCard[] {
  return normalizeComparisonCatalogCards(
    variants.flatMap((variant) => variant.catalogCards || [])
  );
}

export function formatComparisonMoney(value: number) {
  return Number(value || 0).toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
