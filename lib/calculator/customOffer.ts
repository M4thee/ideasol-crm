export type CustomOfferItem = {
  id: string;
  name: string;
  quantity: number | null;
  unitNet: number;
};

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

