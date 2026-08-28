export type CustomOfferItem = {
  id: string;
  name: string;
  quantity: number | null;
  unitNet: number;
};

export const DEFAULT_CUSTOM_OFFER_TITLE = "Oferta niestandardowa";

export function normalizeCustomOfferTitle(value: unknown) {
  const title = String(value || "").replace(/\s+/g, " ").trim().slice(0, 120);
  return title || DEFAULT_CUSTOM_OFFER_TITLE;
}

export function createCustomOfferItem(): CustomOfferItem {
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    quantity: null,
    unitNet: 0,
  };
}

export function getCustomOfferItemQuantity(item: CustomOfferItem) {
  const quantity = Number(item.quantity);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

export function getValidCustomOfferItems(items: CustomOfferItem[]) {
  return items.filter(
    (item) => item.name.trim() && Number.isFinite(item.unitNet) && item.unitNet > 0
  );
}

export function getCustomOfferNetTotal(items: CustomOfferItem[]) {
  return getValidCustomOfferItems(items).reduce(
    (total, item) => total + item.unitNet * getCustomOfferItemQuantity(item),
    0
  );
}
