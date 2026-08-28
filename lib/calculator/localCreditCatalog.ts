import type { CreditBank, CreditOffer } from "@/lib/calculator/creditCalculator";

export type LocalCreditCatalog = {
  banks: CreditBank[];
  offers: CreditOffer[];
};

export const LOCAL_CREDIT_CATALOG_EVENT = "ideasol-local-credit-catalog-updated";

const STORAGE_KEY = "ideasol:local-credit-catalog:v1";

export function canUseLocalCreditCatalog() {
  return process.env.NODE_ENV === "development" && typeof window !== "undefined";
}

export function readLocalCreditCatalog(): LocalCreditCatalog {
  if (!canUseLocalCreditCatalog()) return { banks: [], offers: [] };

  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEY);
    if (!storedValue) return { banks: [], offers: [] };

    const parsed = JSON.parse(storedValue) as Partial<LocalCreditCatalog>;
    return {
      banks: Array.isArray(parsed.banks) ? parsed.banks : [],
      offers: Array.isArray(parsed.offers) ? parsed.offers : [],
    };
  } catch (error) {
    console.error("Nie udało się odczytać lokalnego katalogu finansowania", error);
    return { banks: [], offers: [] };
  }
}

export function writeLocalCreditCatalog(catalog: LocalCreditCatalog) {
  if (!canUseLocalCreditCatalog()) return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
  window.dispatchEvent(new Event(LOCAL_CREDIT_CATALOG_EVENT));
}

export function getNextLocalId(items: Array<{ id: number }>) {
  return Math.max(0, ...items.map((item) => item.id)) + 1;
}
