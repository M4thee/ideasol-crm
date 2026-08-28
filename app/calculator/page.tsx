"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useRef, useState } from "react";
import OfferResult, { type OfferEmailOptions } from "@/components/calculator/OfferResult";
import OfferForm from "@/components/calculator/OfferForm";
import CreditCalculator from "@/components/calculator/CreditCalculator";
import ResultOverviewBar from "@/components/calculator/ResultOverviewBar";
import ResultPanelFocusToggle from "@/components/calculator/ResultPanelFocusToggle";
import SubsidyOptimizer from "@/components/SubsidyOptimizer";
import { generateOfferPdfBase64 } from "@/lib/generateOfferPdfAttachment";
import { recordCrmAuditEvent } from "@/lib/crmAudit";
import { normalizeInstallationCount } from "@/lib/installationCount";
import {
  CUSTOM_PANEL_CODE,
  CUSTOM_STORAGE_CODE,
  createDefaultCustomEquipment,
  type CustomEquipment,
} from "@/lib/calculator/customEquipment";
import {
  createEmptyCustomPaymentSchedule,
  normalizeCustomPaymentSchedule,
  validateCustomPaymentSchedule,
} from "@/lib/customPaymentSchedule";
import {
  createCustomOfferItem,
  getCustomOfferItemQuantity,
  getCustomOfferNetTotal,
  getValidCustomOfferItems,
  type CustomOfferItem,
} from "@/lib/calculator/customOffer";

import AdminPanel from "@/components/calculator/AdminPanel";
import {
  calculateOffer,
  type CalculatorCatalog,
} from "@/lib/calculator/calculateOffer";
import {
  getExplicitStorageVoltageType,
  rankInvertersForStorage,
} from "@/lib/calculator/equipmentCompatibility";


type Result = {
  pvPowerKw: number;
  inverter: string;
  inverterSizingPvPowerKw?: number;
  inverterBatteryVoltageType?: "low_voltage" | "high_voltage" | null;
  inverterBatteryVoltageLabel?: string;
  energyStorage: string;
  storage?: string;
  storageCapacityKwh?: number;
  storageVoltageType?: "low_voltage" | "high_voltage";
  storageVoltageLabel?: string;
  offerType: string;
  customPaymentTerms?: string;

  billingSystem?: "net_billing" | "net_metering";
  withEms?: boolean;
  withBackup?: boolean;
  clientHasOwnHybridInverter?: boolean;
  includeSubsidy?: boolean;
  existingPvPowerKw?: number;
  subsidyProgramCap?: number;
  subsidyAllocation?: {
    enabled: boolean;
    billingSystem: "net_billing" | "net_metering";
    pvNet: number;
    storageNet: number;
    emsNet: number;
    storageSubsidy: number;
    euBonus?: number;
    emsBonus: number;
    total: number;
    programCap: number;
    storageCapByKwh: number;
    maxStorageSubsidy: number;
    requested?: boolean;
    existingPvPowerKw?: number;
    newPvPowerKw?: number;
    totalPvPowerForSubsidyKw?: number;
    requiredStorageCapacityKwh?: number;
    storageCapacityKwh?: number;
    hasStorageMinimumCapacity?: boolean;
    hasRequiredStorageToPvRatio?: boolean;
    qualifyingStorageCost?: number;
    qualifyingVat?: number;
    qualifyVat?: boolean;
    euBonusEligible?: boolean;
    storageIsEu?: boolean;
    inverterIsEu?: boolean;
  };

  contractBreakdown?: {
    pv: {
      netAfterDiscount: number;
      grossAfterDiscount: number;
      grossBeforeDiscount: number;
    };
    storage: {
      netAfterDiscount: number;
      grossAfterDiscount: number;
      grossBeforeDiscount: number;
    };
    inverter: {
      netAfterDiscount: number;
      grossAfterDiscount: number;
      grossBeforeDiscount: number;
    };
    ems: {
      netAfterDiscount: number;
      grossAfterDiscount: number;
      grossBeforeDiscount: number;
    };
    backup: {
      netAfterDiscount: number;
      grossAfterDiscount: number;
      grossBeforeDiscount: number;
    };
    additionalServices: {
      netAfterDiscount: number;
      grossAfterDiscount: number;
      grossBeforeDiscount: number;
    };
    total: {
      netAfterDiscount: number;
      grossAfterDiscount: number;
      grossBeforeDiscount: number;
    };
  };

  basePriceNet: number;
  sellerMarkupNet: number;
  finalNet: number;
  finalGross: number;
  vatRate: number;
  companyMargin: number;
  breakdown: {
    label: string;
    value: number;
  }[];
  additionalServices?: {
    id: number | null;
    name: string;
    unitLabel?: string;
    unit_label?: string;
    priceNet: number;
    quantity: number;
    totalNet: number;
  }[];
  additionalServicesNet?: number;
};


type CatalogPanel = {
  code: string;
  name: string;
  display_name: string | null;
  power_wp: number;
  price_net: number;
  catalog_card_url?: string | null;
  catalogCardUrl?: string | null;
};

type CatalogStorage = {
  code: string;
  name: string;
  display_name: string | null;
  capacity_kwh: number;
  voltage_type?: "low_voltage" | "high_voltage" | null;
  voltageType?: "low_voltage" | "high_voltage" | null;
  price_net: number;
  installation_net: number;
  catalog_card_url?: string | null;
  catalogCardUrl?: string | null;
  is_eu?: boolean;
  isEu?: boolean;
};

type CatalogInverter = {
  name: string;
  display_name: string | null;
  type: string;
  battery_voltage_type?: "low_voltage" | "high_voltage" | null;
  batteryVoltageType?: "low_voltage" | "high_voltage" | null;
  max_pv_kw: number;
  price_net: number;
  catalog_card_url?: string | null;
  catalogCardUrl?: string | null;
  is_eu?: boolean;
  isEu?: boolean;
  has_ems?: boolean;
  hasEms?: boolean;
};

function getCatalogStorageVoltageType(storageItem?: CatalogStorage) {
  return getExplicitStorageVoltageType(storageItem);
}

type CatalogCardEmailAttachment = {
  title: string;
  fileName: string;
  url: string;
};

type SelectedAdditionalService = {
  id: number;
  name: string;
  unit_label?: string;
  price_net: number;
  allows_quantity: boolean;
  quantity: number;
};

type UserProfile = {
  id: string;
  display_name: string | null;
  phone: string | null;
  default_seller_markup?: number | null;
  role: "admin" | "owner" | "seller" | "cc" | null;
  is_active?: boolean | null;
  custom_mode_access?: boolean;
};

type CrmClientOption = {
  id: string;
  full_name?: string | null;
  name?: string | null;
  company_name?: string | null;
  contact_person?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  contact_phone?: string | null;
  city?: string | null;
  postal_code?: string | null;
  street?: string | null;
  building_number?: string | null;
  lead_public_id?: string | null;
  client_public_id?: string | null;
  public_id?: string | null;
  [key: string]: unknown;
};

const CRM_CLIENTS_CACHE_KEY = "ideasol:calculator:crmClients:v1";
const OFFLINE_OFFER_QUEUE_KEY = "ideasol:calculator:offlineOfferQueue:v1";
const CALCULATOR_CATALOG_CACHE_KEY = "ideasol:calculator:catalog:v2";
const CALCULATOR_PRICING_CACHE_KEY = "ideasol:calculator:pricing:v1";


type CachedCrmClientsPayload = {
  savedAt: string;
  clients: CrmClientOption[];
};
type OfflineOfferQueueItem = {
  id: string;
  createdAt: string;
  status: "pending";
  clientId: string;
  clientName: string | null;
  clientEmail: string;
  sendMode: "anonymous" | "public";
  offerText: string;
  snapshot: Record<string, unknown>;
};

type CachedCalculatorCatalogPayload = {
  savedAt: string;
  panels: CatalogPanel[];
  storages: CatalogStorage[];
  inverters: CatalogInverter[];
};
function isCalculatorOnline() {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

function readCachedCrmClients() {
  if (typeof window === "undefined") return [] as CrmClientOption[];

  try {
    const rawValue = window.localStorage.getItem(CRM_CLIENTS_CACHE_KEY);

    if (!rawValue) {
      return [] as CrmClientOption[];
    }

    const parsedValue = JSON.parse(rawValue) as CachedCrmClientsPayload;

    if (!Array.isArray(parsedValue.clients)) {
      return [] as CrmClientOption[];
    }

    return parsedValue.clients;
  } catch (error) {
    console.warn("Nie udało się odczytać cache klientów CRM kalkulatora", error);
    return [] as CrmClientOption[];
  }
}

function writeCachedCrmClients(clients: CrmClientOption[]) {
  if (typeof window === "undefined") return;

  try {
    const payload: CachedCrmClientsPayload = {
      savedAt: new Date().toISOString(),
      clients,
    };

    window.localStorage.setItem(CRM_CLIENTS_CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Nie udało się zapisać cache klientów CRM kalkulatora", error);
  }
}
function createOfflineQueueId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readOfflineOfferQueue() {
  if (typeof window === "undefined") return [] as OfflineOfferQueueItem[];

  try {
    const rawValue = window.localStorage.getItem(OFFLINE_OFFER_QUEUE_KEY);

    if (!rawValue) {
      return [] as OfflineOfferQueueItem[];
    }

    const parsedValue = JSON.parse(rawValue) as OfflineOfferQueueItem[];

    if (!Array.isArray(parsedValue)) {
      return [] as OfflineOfferQueueItem[];
    }

    return parsedValue;
  } catch (error) {
    console.warn("Nie udało się odczytać kolejki ofert offline", error);
    return [] as OfflineOfferQueueItem[];
  }
}

function writeOfflineOfferQueue(queue: OfflineOfferQueueItem[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(OFFLINE_OFFER_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.warn("Nie udało się zapisać kolejki ofert offline", error);
  }
}

function addOfflineOfferToQueue(item: OfflineOfferQueueItem) {
  const currentQueue = readOfflineOfferQueue();
  const nextQueue = [item, ...currentQueue];
  writeOfflineOfferQueue(nextQueue);
  return nextQueue.length;
}
function removeOfflineOfferFromQueue(itemId: string) {
  const currentQueue = readOfflineOfferQueue();
  const nextQueue = currentQueue.filter((item) => item.id !== itemId);
  writeOfflineOfferQueue(nextQueue);
  return nextQueue.length;
}


const DEFAULT_PRICING_OVERRIDES = {
  subsidy: {
    qualifyVat: false,
  },
  panels: {},
  storages: {},
  installation: {
    pvPerKwNet: 500,
    storageWithPvNet: 1500,
    storageWithoutPvNet: 2500,
  },
  roof: {
    blacha: 1500,
    dachowka: 2000,
    papa: 2200,
    grunt: 4500,
  },
  placeholders: {
    protections: 1500,
    wiring: 800,
    transportElectronics: 250,
    transportPanels: 350,
    documentation: 700,
    ems: 1200,
  },
  margins: {
    marketing: 500,

    ownersCount: 3,

    pvSmallPerKw: 250,
    pvSmallFixed: 500,

    pvLargePerKw: 150,
    pvLargeFixed: 700,

    storagePerOwner: 500,

    managerFeeNet: 500,
  },
  operator: {
    percent: 15,
  },
};
function readCachedCalculatorCatalog() {
  if (typeof window === "undefined") return null as CachedCalculatorCatalogPayload | null;

  try {
    const rawValue = window.localStorage.getItem(CALCULATOR_CATALOG_CACHE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as CachedCalculatorCatalogPayload;

    if (
      !Array.isArray(parsedValue.panels) ||
      !Array.isArray(parsedValue.storages) ||
      !Array.isArray(parsedValue.inverters)
    ) {
      return null;
    }

    if (
      parsedValue.panels.length === 0 ||
      parsedValue.storages.length === 0 ||
      parsedValue.inverters.length === 0
    ) {
      return null;
    }

    return parsedValue;
  } catch (error) {
    console.warn("Nie udało się odczytać cache katalogu kalkulatora", error);
    return null;
  }
}

function writeCachedCalculatorCatalog(payload: Omit<CachedCalculatorCatalogPayload, "savedAt">) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      CALCULATOR_CATALOG_CACHE_KEY,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        ...payload,
      })
    );
  } catch (error) {
    console.warn("Nie udało się zapisać cache katalogu kalkulatora", error);
  }
}

function readCachedPricingOverrides() {
  if (typeof window === "undefined") return null as typeof DEFAULT_PRICING_OVERRIDES | null;

  try {
    const rawValue = window.localStorage.getItem(CALCULATOR_PRICING_CACHE_KEY);

    if (!rawValue) {
      return null;
    }

    return JSON.parse(rawValue) as typeof DEFAULT_PRICING_OVERRIDES;
  } catch (error) {
    console.warn("Nie udało się odczytać cache ustawień cen kalkulatora", error);
    return null;
  }
}

function writeCachedPricingOverrides(pricing: typeof DEFAULT_PRICING_OVERRIDES) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(CALCULATOR_PRICING_CACHE_KEY, JSON.stringify(pricing));
  } catch (error) {
    console.warn("Nie udało się zapisać cache ustawień cen kalkulatora", error);
  }
}
export default function Home() {
  const [clientIdFromUrl, setClientIdFromUrl] = useState("");
  const [isOffline, setIsOffline] = useState(false);
  const [queuedOfferCount, setQueuedOfferCount] = useState(0);
  const [syncingOfflineOffers, setSyncingOfflineOffers] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminStatus, setAdminStatus] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [crmClients, setCrmClients] = useState<CrmClientOption[]>([]);
  const [savingOffer, setSavingOffer] = useState(false);
  const [saveOfferStatus, setSaveOfferStatus] = useState("");
  const [savedOfferId, setSavedOfferId] = useState<string | null>(null);
  const [offerType, setOfferType] = useState("none");
  const [panelModel, setPanelModel] = useState("");
  const [panelCount, setPanelCount] = useState(16);
  const [manualPowerKw, setManualPowerKw] = useState("");
  const [panels, setPanels] = useState<CatalogPanel[]>([]);
  const [storages, setStorages] = useState<CatalogStorage[]>([]);
  const [inverters, setInverters] = useState<CatalogInverter[]>([]);
  const [selectedInverterName, setSelectedInverterName] = useState("auto");
  const [roofType, setRoofType] = useState("blacha");
  const [storage, setStorage] = useState("none");
  const [clientHasOwnHybridInverter, setClientHasOwnHybridInverter] = useState(false);
  const [includeSubsidy, setIncludeSubsidy] = useState(false);
  const [isUpsell, setIsUpsell] = useState(false);
  const [existingPvPowerKw, setExistingPvPowerKw] = useState("0");
  const [selectedAdditionalServices, setSelectedAdditionalServices] = useState<SelectedAdditionalService[]>([]);
  const [identicalSetCount, setIdenticalSetCount] = useState(1);
  const [includeCatalogCards, setIncludeCatalogCards] = useState(true);
  const [customMode, setCustomMode] = useState(false);
  const [customProductMode, setCustomProductMode] = useState(false);
  const [customOfferItems, setCustomOfferItems] = useState<CustomOfferItem[]>([
    createCustomOfferItem(),
  ]);
  const [customPaymentTerms, setCustomPaymentTerms] = useState("");
  const [customPaymentSchedule, setCustomPaymentSchedule] = useState(
    createEmptyCustomPaymentSchedule
  );
  const [customEquipment, setCustomEquipment] = useState<CustomEquipment>(
    createDefaultCustomEquipment
  );

  const [billingSystem, setBillingSystem] = useState<
    "net_billing" | "net_metering"
  >("net_billing");
  const [sellerMarkup, setSellerMarkup] = useState(3000);
  const [showSettings, setShowSettings] = useState(false);
  const [vatRate, setVatRate] = useState(8);
  const [result, setResult] = useState<Result | null>(null);
  const [resultIsDirty, setResultIsDirty] = useState(false);
  const [resultPanelTab, setResultPanelTab] = useState<"summary" | "subsidy" | "credit">("summary");
  const [isResultFocusMode, setIsResultFocusMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [clientEmail, setClientEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [pricingOverrides, setPricingOverrides] = useState(DEFAULT_PRICING_OVERRIDES);
  const resultSectionRef = useRef<HTMLDivElement | null>(null);
  const calculationAuditIdRef = useRef<string | null>(null);

  const currentUserRole = String(userProfile?.role || "seller")
    .trim()
    .toLowerCase();
  const advisorName = userProfile?.display_name || currentUserEmail || "IdeaSol";
  const advisorPhone = userProfile?.phone || "501 000 000";
  const advisorEmail = currentUserEmail || "kontakt@ideasol.pl";
  const canSeeTechnicalView = currentUserRole === "admin" || currentUserRole === "owner";
  const canSeePricingPanel = currentUserRole.includes("admin");
  const customModeAvailable = userProfile?.custom_mode_access === true;
  const customModeActive = customMode && customModeAvailable;

  useEffect(() => {
    function updateOnlineStatus() {
      setIsOffline(!isCalculatorOnline());
      setQueuedOfferCount(readOfflineOfferQueue().length);
    }

    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  function getPanelPowerWp(model: string) {
    if (customModeActive && model === CUSTOM_PANEL_CODE) {
      return Number(customEquipment.panel.powerWp || 0);
    }

    const selectedPanel = panels.find((panel) => panel.code === model);

    if (selectedPanel) {
      return Number(selectedPanel.power_wp);
    }

    return 0;
  }

  function getPanelDisplayName(model: string) {
    if (customModeActive && model === CUSTOM_PANEL_CODE) {
      return customEquipment.panel.displayName.trim() || "Panel niestandardowy";
    }

    const selectedPanel = panels.find((panel) => panel.code === model);

    return selectedPanel?.display_name || selectedPanel?.name || model;
  }

  function getClientDisplayName(client: CrmClientOption) {
    return (
      client.full_name ||
      client.name ||
      client.company_name ||
      client.contact_person ||
      [client.first_name, client.last_name].filter(Boolean).join(" ") ||
      "Klient CRM"
    );
  }

  function getSelectedInverterType(inverterDisplayName: string) {
    if (customModeActive && inverterDisplayName === customEquipment.inverter.displayName) {
      return customEquipment.inverter.type;
    }

    if (!inverterDisplayName || inverterDisplayName === "Brak") {
      return null;
    }

    const selectedInverter =
      selectedInverterName !== "auto"
        ? inverters.find((inverter) => inverter.name === selectedInverterName)
        : inverters.find(
          (inverter) =>
            inverter.name === inverterDisplayName ||
            inverter.display_name === inverterDisplayName
        );

    return selectedInverter?.type || null;
  }

  function getInverterLabel(inverterDisplayName: string) {
    const inverterType = getSelectedInverterType(inverterDisplayName);
    const normalizedType = String(inverterType || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");

    if (["hybrid", "hybrydowy", "hybryda", "hybrid_inverter"].includes(normalizedType)) {
      return "falownik hybrydowy";
    }

    if (
      [
        "grid",
        "on_grid",
        "ongrid",
        "sieciowy",
        "network",
        "network_inverter",
        "grid_tied",
      ].includes(normalizedType)
    ) {
      return "falownik sieciowy";
    }

    return "falownik";
  }
  function getResultStorageDisplayName(offerResult: Result) {
    return offerResult.energyStorage || offerResult.storage || "Brak";
  }

  function sanitizeCatalogCardFileName(value: string, fallback: string) {
    const normalized = String(value || fallback)
      .trim()
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, "_");

    if (!normalized) {
      return fallback;
    }

    return normalized.toLowerCase().endsWith(".pdf") ? normalized : `${normalized}.pdf`;
  }

  function getSelectedPanelCatalogCard(): CatalogCardEmailAttachment | null {
    if (offerType === "storage") {
      return null;
    }

    if (customModeActive) {
      const url = customEquipment.panel.catalogCardUrl.trim();
      const title = customEquipment.panel.displayName.trim();

      return url && title
        ? { title, fileName: sanitizeCatalogCardFileName(title, "karta-panelu.pdf"), url }
        : null;
    }

    const selectedPanel = panels.find((panel) => panel.code === panelModel);
    const url = selectedPanel?.catalog_card_url || selectedPanel?.catalogCardUrl || null;

    if (!selectedPanel || !url) {
      return null;
    }

    const title = selectedPanel.display_name || selectedPanel.name || selectedPanel.code;

    return {
      title,
      fileName: sanitizeCatalogCardFileName(title, "karta-panelu.pdf"),
      url,
    };
  }

  function getSelectedStorageCatalogCard(): CatalogCardEmailAttachment | null {
    if (!storage || storage === "none") {
      return null;
    }

    if (customModeActive) {
      const url = customEquipment.storage.catalogCardUrl.trim();
      const title = customEquipment.storage.displayName.trim();

      return url && title
        ? { title, fileName: sanitizeCatalogCardFileName(title, "karta-magazynu-energii.pdf"), url }
        : null;
    }

    const selectedStorage = storages.find((catalogStorage) => catalogStorage.code === storage);
    const url = selectedStorage?.catalog_card_url || selectedStorage?.catalogCardUrl || null;

    if (!selectedStorage || !url) {
      return null;
    }

    const title = selectedStorage.display_name || selectedStorage.name || selectedStorage.code;

    return {
      title,
      fileName: sanitizeCatalogCardFileName(title, "karta-magazynu-energii.pdf"),
      url,
    };
  }

  function getSelectedInverterCatalogCard(offerResult: Result): CatalogCardEmailAttachment | null {
    if (!offerResult.inverter || offerResult.inverter === "Brak") {
      return null;
    }

    if (customModeActive) {
      const url = customEquipment.inverter.catalogCardUrl.trim();
      const title = customEquipment.inverter.displayName.trim();

      return url && title
        ? { title, fileName: sanitizeCatalogCardFileName(title, "karta-falownika.pdf"), url }
        : null;
    }

    const selectedInverter =
      selectedInverterName !== "auto"
        ? inverters.find((inverter) => inverter.name === selectedInverterName)
        : inverters.find(
          (inverter) =>
            inverter.name === offerResult.inverter ||
            inverter.display_name === offerResult.inverter
        );

    const url = selectedInverter?.catalog_card_url || selectedInverter?.catalogCardUrl || null;

    if (!selectedInverter || !url) {
      return null;
    }

    const title = selectedInverter.display_name || selectedInverter.name;

    return {
      title,
      fileName: sanitizeCatalogCardFileName(title, "karta-falownika.pdf"),
      url,
    };
  }

  function buildCatalogCardRequests(offerResult: Result): CatalogCardEmailAttachment[] {
    if (offerResult.offerType === "custom") return [];

    const cards = [
      getSelectedPanelCatalogCard(),
      getSelectedInverterCatalogCard(offerResult),
      getSelectedStorageCatalogCard(),
    ].filter((card): card is CatalogCardEmailAttachment => Boolean(card?.url));

    const uniqueUrls = new Set<string>();

    return cards.filter((card) => {
      if (uniqueUrls.has(card.url)) {
        return false;
      }

      uniqueUrls.add(card.url);
      return true;
    });
  }

  function calculateNearestPanelCount(powerKwText: string, model: string) {
    const powerKw = Number(powerKwText.replace(",", "."));

    if (!powerKw || powerKw <= 0) return;

    const panelPowerWp = getPanelPowerWp(model);
    const nearestPanelCount = Math.max(1, Math.round((powerKw * 1000) / panelPowerWp));

    setPanelCount(nearestPanelCount);
  }

  useEffect(() => {
    async function loadCurrentUserProfile() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;

      if (!user) {
        setUserProfile(null);
        setCurrentUserEmail("");
        return null;
      }

      setCurrentUserEmail(user.email || "");

      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, phone, default_seller_markup, role, is_active")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.warn("Nie znaleziono profilu użytkownika kalkulatora", error);
        return user;
      }

      if (data) {
        const { data: customModePermission } = await supabase
          .from("user_permissions")
          .select("custom_mode")
          .eq("user_id", user.id)
          .maybeSingle();
        const profile = {
          ...data,
          custom_mode_access: customModePermission?.custom_mode === true,
        } as UserProfile;
        setUserProfile(profile);

        const defaultMargin = profile.default_seller_markup;

        if (defaultMargin !== null && defaultMargin !== undefined) {
          const parsedDefaultMargin = Number(defaultMargin);

          if (Number.isFinite(parsedDefaultMargin)) {
            setSellerMarkup(parsedDefaultMargin);
          }
        }
      }

      return user;
    }

    async function loadPricingSettings() {
      const cachedPricing = readCachedPricingOverrides();

      if (cachedPricing) {
        setPricingOverrides({
          ...DEFAULT_PRICING_OVERRIDES,
          ...cachedPricing,
          installation: {
            ...DEFAULT_PRICING_OVERRIDES.installation,
            ...cachedPricing.installation,
          },
          placeholders: {
            ...DEFAULT_PRICING_OVERRIDES.placeholders,
            ...cachedPricing.placeholders,
          },
        });
      }

      if (!isCalculatorOnline()) {
        console.warn("Kalkulator offline — używam ustawień cen zapisanych w cache");
        return;
      }

      const { data, error } = await supabase
        .from("pricing_settings")
        .select("*")
        .maybeSingle();

      if (error) {
        console.warn("Nie udało się załadować pricing_settings — kalkulator użyje wartości domyślnych lub cache", error);
        return;
      }

      if (!data) {
        return;
      }

      setPricingOverrides((current) => {
        const nextPricing = {
          ...current,
          installation: {
            ...current.installation,
            pvPerKwNet: Number(data.installation_pv_per_kw ?? current.installation.pvPerKwNet),
            storageWithPvNet: Number(data.storage_installation_with_pv_net ?? current.installation.storageWithPvNet),
            storageWithoutPvNet: Number(data.storage_installation_without_pv_net ?? current.installation.storageWithoutPvNet),
          },
          placeholders: {
            ...current.placeholders,
            protections: Number(data.protections_cost ?? current.placeholders.protections),
            wiring: Number(data.wiring_cost ?? current.placeholders.wiring),
            transportElectronics: Number(data.transport_electronics_net ?? current.placeholders.transportElectronics),
            transportPanels: Number(data.transport_panels_net ?? current.placeholders.transportPanels),
            documentation: Number(data.documentation_cost ?? current.placeholders.documentation),
            ems: Number(data.ems_cost ?? current.placeholders.ems),
          },
          margins: {
            ...current.margins,
            marketing: Number(data.marketing_cost ?? current.margins.marketing),
            ownersCount: Number(data.owners_count ?? current.margins.ownersCount),
            pvSmallPerKw: Number(data.pv_small_per_kw ?? current.margins.pvSmallPerKw),
            pvSmallFixed: Number(data.pv_small_fixed ?? current.margins.pvSmallFixed),
            pvLargePerKw: Number(data.pv_large_per_kw ?? current.margins.pvLargePerKw),
            pvLargeFixed: Number(data.pv_large_fixed ?? current.margins.pvLargeFixed),
            storagePerOwner: Number(data.storage_per_owner ?? current.margins.storagePerOwner),
            managerFeeNet: Number(data.manager_fee_percent ?? current.margins.managerFeeNet),
          },
          operator: {
            ...current.operator,
            percent: Number(data.warranty_percent ?? current.operator.percent),
          },
          subsidy: {
            qualifyVat: Boolean(data.pme_qualify_vat ?? current.subsidy.qualifyVat),
          },
        };

        writeCachedPricingOverrides(nextPricing);
        return nextPricing;
      });
    }

    async function loadCrmClients() {
      const cachedClients = readCachedCrmClients();

      if (cachedClients.length > 0) {
        setCrmClients(cachedClients);
      }

      if (!isCalculatorOnline()) {
        console.warn("Kalkulator offline — używam klientów CRM zapisanych w cache");
        return;
      }

      const { data, error } = await supabase
        .from("clients")
        .select(
          "id, public_id, full_name, company_name, client_type, phone, email, city, postal_code, street, building_number, contact_person, contact_phone"
        )
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) {
        console.warn("Nie udało się załadować klientów CRM do kalkulatora", error);

        if (cachedClients.length === 0) {
          setCrmClients([]);
        }

        return;
      }

      const loadedClients = (data || []) as CrmClientOption[];
      setCrmClients(loadedClients);
      writeCachedCrmClients(loadedClients);
    }

    async function loadCatalog() {
      const cachedCatalog = readCachedCalculatorCatalog();

      if (
        cachedCatalog &&
        cachedCatalog.panels.length > 0 &&
        cachedCatalog.storages.length > 0 &&
        cachedCatalog.inverters.length > 0
      ) {
        setPanels(cachedCatalog.panels);
        setStorages(cachedCatalog.storages);
        setInverters(cachedCatalog.inverters);
      }

      if (!isCalculatorOnline()) {
        console.warn("Kalkulator offline — używam katalogu zapisanego w cache");
        if (!cachedCatalog) {
          setCatalogError("Brak połączenia i brak katalogu sprzętu pobranego wcześniej z bazy.");
        }
        return;
      }
      let catalogResponse: Response;

      try {
        catalogResponse = await fetch("/api/calculate", {
          method: "GET",
          cache: "no-store",
        });
      } catch (error) {
        console.warn("Nie udało się pobrać katalogu kalkulatora z API — blokuję kalkulację online", error);
        setPanels([]);
        setStorages([]);
        setInverters([]);
        setCatalogError("Nie udało się połączyć z bazą sprzętu. Kalkulacja została zablokowana, aby nie użyć nieaktualnych danych.");
        return;
      }

      if (!catalogResponse.ok) {
        console.warn("Nie udało się pobrać katalogu kalkulatora z API — blokuję kalkulację online");
        setPanels([]);
        setStorages([]);
        setInverters([]);
        setCatalogError("Baza sprzętu nie odpowiedziała poprawnie. Kalkulacja została zablokowana.");
        return;
      }

      const catalogPayload = await catalogResponse.json();
      const apiCatalog = catalogPayload?.catalog as CalculatorCatalog | undefined;

      if (!apiCatalog) {
        console.warn("API kalkulatora nie zwróciło katalogu — blokuję kalkulację online");
        setPanels([]);
        setStorages([]);
        setInverters([]);
        setCatalogError("Baza nie zwróciła katalogu sprzętu. Kalkulacja została zablokowana.");
        return;
      }

      const loadedPanels = Object.entries(apiCatalog.panels || {}).map(([code, panel]) => ({
        code,
        name: panel.name,
        display_name: panel.displayName || panel.name,
        power_wp: panel.powerWp,
        price_net: panel.priceNet,
        catalog_card_url:
          (panel as { catalogCardUrl?: string | null }).catalogCardUrl || null,
        catalogCardUrl:
          (panel as { catalogCardUrl?: string | null }).catalogCardUrl || null,
      })) as CatalogPanel[];

      const loadedStorages = Object.entries(apiCatalog.storages || {})
        .filter(([code]) => code !== "none")
        .map(([code, catalogStorage]) => {
          const storageVoltageType =
            (catalogStorage as { voltageType?: "low_voltage" | "high_voltage" | null })
              .voltageType || null;

          return {
            code,
            name: catalogStorage.name,
            display_name: catalogStorage.displayName || catalogStorage.name,
            capacity_kwh: catalogStorage.capacityKwh,
            voltage_type: storageVoltageType,
            voltageType: storageVoltageType,
            price_net: catalogStorage.priceNet,
            installation_net: catalogStorage.installationNet,
            is_eu: Boolean(catalogStorage.isEu),
            isEu: Boolean(catalogStorage.isEu),
            catalog_card_url:
              (catalogStorage as { catalogCardUrl?: string | null }).catalogCardUrl || null,
            catalogCardUrl:
              (catalogStorage as { catalogCardUrl?: string | null }).catalogCardUrl || null,
          };
        }) as CatalogStorage[];

      const loadedInverters = (apiCatalog.inverters || []).map((inverter) => {
        const inverterBatteryVoltageType =
          (inverter as { batteryVoltageType?: "low_voltage" | "high_voltage" | null })
            .batteryVoltageType || null;
        const inverterCatalogCardUrl =
          (inverter as { catalogCardUrl?: string | null }).catalogCardUrl || null;

        return {
          name: inverter.name,
          display_name: inverter.displayName || inverter.name,
          type: inverter.type,
          battery_voltage_type: inverterBatteryVoltageType,
          batteryVoltageType: inverterBatteryVoltageType,
          max_pv_kw: inverter.maxPvKw,
          price_net: inverter.priceNet,
          is_eu: Boolean(inverter.isEu),
          isEu: Boolean(inverter.isEu),
          has_ems: Boolean(inverter.hasEms),
          hasEms: Boolean(inverter.hasEms),
          catalog_card_url: inverterCatalogCardUrl,
          catalogCardUrl: inverterCatalogCardUrl,
        };
      }) as CatalogInverter[];
      if (loadedPanels.length === 0 || loadedStorages.length === 0 || loadedInverters.length === 0) {
        console.warn("Katalog kalkulatora z Supabase jest pusty — nie nadpisuję cache pustymi danymi", {
          panels: loadedPanels.length,
          storages: loadedStorages.length,
          inverters: loadedInverters.length,
        });
        setPanels([]);
        setStorages([]);
        setInverters([]);
        setCatalogError("W bazie brakuje aktywnych paneli, falowników lub magazynów energii.");
        return;
      }

      setPanels(loadedPanels);
      setStorages(loadedStorages);
      setInverters(loadedInverters);
      setCatalogError("");

      writeCachedCalculatorCatalog({
        panels: loadedPanels,
        storages: loadedStorages,
        inverters: loadedInverters,
      });

      if (loadedPanels.length > 0) {
        setPanelModel((current) =>
          current === CUSTOM_PANEL_CODE ||
          loadedPanels.some((panel: CatalogPanel) => panel.code === current)
            ? current
            : loadedPanels[0].code
        );
      }

      if (loadedStorages.length > 0) {
        setStorage((current) =>
          current === "none" ||
            current === CUSTOM_STORAGE_CODE ||
            loadedStorages.some((catalogStorage: CatalogStorage) => catalogStorage.code === current)
            ? current
            : loadedStorages[0].code
        );
      }
    }

    async function loadCalculatorData() {
      const user = await loadCurrentUserProfile();

      await Promise.all([
        loadCatalog(),
        loadPricingSettings(),
        user ? loadCrmClients() : Promise.resolve(),
      ]);
    }

    loadCalculatorData();
  }, []);

  useEffect(() => {
    if (panels.length === 0 || storages.length === 0 || inverters.length === 0) {
      return;
    }

    writeCachedCalculatorCatalog({
      panels,
      storages,
      inverters,
    });
  }, [panels, storages, inverters]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setClientIdFromUrl(params.get("clientId") || "");
  }, []);

  useEffect(() => {
    if (!clientIdFromUrl || selectedClientId || crmClients.length === 0) {
      return;
    }

    const clientFromUrl = crmClients.find((client) => client.id === clientIdFromUrl);

    if (!clientFromUrl) {
      return;
    }

    setSelectedClientId(clientFromUrl.id);
    setClientName(getClientDisplayName(clientFromUrl));
    setClientEmail(clientFromUrl.email?.trim() || "");
  }, [clientIdFromUrl, selectedClientId, crmClients]);


  function updatePricingValue(path: string[], value: string | boolean) {
    const numberValue = typeof value === "string" ? Number(value.replace(",", ".")) : 0;
    const safeValue = typeof value === "boolean"
      ? value
      : Number.isFinite(numberValue) ? numberValue : 0;

    setPricingOverrides((current) => {
      const next = structuredClone(current);
      let target: any = next;

      for (let i = 0; i < path.length - 1; i++) {
        target[path[i]] ||= {};
        target = target[path[i]];
      }

      target[path[path.length - 1]] = safeValue;
      setAdminStatus("Masz niezapisane zmiany");

      return next;
    });
  }

  async function savePricingSettings(pricing: typeof DEFAULT_PRICING_OVERRIDES) {
    setAdminStatus("Zapisywanie ustawień...");

    const { error } = await supabase
      .from("pricing_settings")
      .update({
        installation_pv_per_kw: pricing.installation.pvPerKwNet,
        storage_installation_with_pv_net: pricing.installation.storageWithPvNet,
        storage_installation_without_pv_net: pricing.installation.storageWithoutPvNet,
        protections_cost: pricing.placeholders.protections,
        wiring_cost: pricing.placeholders.wiring,
        transport_electronics_net: pricing.placeholders.transportElectronics,
        transport_panels_net: pricing.placeholders.transportPanels,
        documentation_cost: pricing.placeholders.documentation,
        ems_cost: pricing.placeholders.ems,
        marketing_cost: pricing.margins.marketing,

        owners_count: pricing.margins.ownersCount,

        pv_small_per_kw: pricing.margins.pvSmallPerKw,
        pv_small_fixed: pricing.margins.pvSmallFixed,

        pv_large_per_kw: pricing.margins.pvLargePerKw,
        pv_large_fixed: pricing.margins.pvLargeFixed,

        storage_per_owner: pricing.margins.storagePerOwner,

        manager_fee_percent: pricing.margins.managerFeeNet,

        warranty_percent: pricing.operator.percent,
        pme_qualify_vat: Boolean(pricing.subsidy?.qualifyVat),
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    if (error) {
      console.error("Błąd zapisu pricing_settings", error);
      setAdminStatus("Błąd zapisu do Supabase");
      return;
    }

    setAdminStatus("Zapisano ustawienia cen");
    setResult(null);
    setIsResultFocusMode(false);
  }

  function resetPricingOverrides() {
    setPricingOverrides(DEFAULT_PRICING_OVERRIDES);
    setAdminStatus("Przywrócono wartości domyślne — zapisz, żeby utrwalić w bazie");
    setResult(null);
    setIsResultFocusMode(false);
  }

  function buildCalculatorCatalogFromState(): CalculatorCatalog {
    const panelCatalog = panels.reduce<CalculatorCatalog["panels"]>((acc, panel) => {
      const panelName = panel.display_name || panel.name || panel.code;

      acc[panel.code] = {
        name: panelName,
        displayName: panelName,
        powerWp: Number(panel.power_wp || 0),
        priceNet: Number(panel.price_net || 0),
        catalogCardUrl: panel.catalog_card_url || panel.catalogCardUrl || null,
      };

      return acc;
    }, {});

    const storageCatalog: CalculatorCatalog["storages"] = storages.reduce<CalculatorCatalog["storages"]>(
      (acc, catalogStorage) => {
        const storageName = catalogStorage.display_name || catalogStorage.name || catalogStorage.code;
        const storageVoltageType =
          catalogStorage.voltage_type || catalogStorage.voltageType || null;

        acc[catalogStorage.code] = {
          name: storageName,
          displayName: storageName,
          capacityKwh: Number(catalogStorage.capacity_kwh || 0),
          voltageType: storageVoltageType,
          priceNet: Number(catalogStorage.price_net || 0),
          installationNet: Number(catalogStorage.installation_net || 0),
          catalogCardUrl: catalogStorage.catalog_card_url || catalogStorage.catalogCardUrl || null,
          isEu: Boolean(catalogStorage.is_eu ?? catalogStorage.isEu),
        };

        return acc;
      },
      {
        none: {
          name: "Brak",
          displayName: "Brak",
          capacityKwh: 0,
          voltageType: "low_voltage",
          priceNet: 0,
          installationNet: 0,
          catalogCardUrl: null,
        },
      } as CalculatorCatalog["storages"]
    );

    const inverterCatalog = inverters.map((inverter) => ({
      name: inverter.name,
      displayName: inverter.display_name || inverter.name,
      type: String(inverter.type || "ongrid") as any,
      batteryVoltageType: inverter.battery_voltage_type || inverter.batteryVoltageType || null,
      maxPvKw: Number(inverter.max_pv_kw || 0),
      priceNet: Number(inverter.price_net || 0),
      catalogCardUrl: inverter.catalog_card_url || inverter.catalogCardUrl || null,
      isEu: Boolean(inverter.is_eu ?? inverter.isEu),
      hasEms: Boolean(inverter.has_ems ?? inverter.hasEms),
    }));

    return {
      panels: panelCatalog,
      storages: storageCatalog,
      inverters: inverterCatalog,
    };
  }

  function buildCalculationPayload() {
    return {
      customMode: customModeActive,
      customProductMode,
      customOfferItems: customProductMode ? customOfferItems : null,
      customPaymentTerms: customProductMode ? customPaymentTerms.trim() : null,
      customEquipment: customModeActive ? customEquipment : null,
      offerType,
      panelModel,
      panelCount,
      roofType,
      storage,
      includeSubsidy,
      isUpsell,
      existingPvPowerKw: isUpsell
        ? Number(String(existingPvPowerKw).replace(",", ".")) || 0
        : 0,
      billingSystem,
      selectedInverterName,
      clientHasOwnHybridInverter,
      sellerMarkup,
      vatRate,
      pricingOverrides,
      additionalServices: selectedAdditionalServices,
      additional_services: selectedAdditionalServices,
      advisor: {
        id: userProfile?.id || null,
        name: advisorName,
        phone: advisorPhone,
        email: advisorEmail,
        role: userProfile?.role || currentUserRole,
      },
    };
  }

  async function calculate() {
    const calculationPayload = buildCalculationPayload();

    try {
      let data: Result;

      if (customProductMode) {
        if (!customModeAvailable) {
          throw new Error("Nie masz uprawnienia do trybu Custom Mode.");
        }

        const validItems = getValidCustomOfferItems(customOfferItems);
        const finalNet = getCustomOfferNetTotal(validItems);
        const normalizedItems = validItems.map((item, index) => {
          const quantity = getCustomOfferItemQuantity(item);

          return {
            id: -(index + 1),
            name: item.name.trim(),
            unitLabel: "szt.",
            unit_label: "szt.",
            priceNet: item.unitNet,
            quantity,
            totalNet: item.unitNet * quantity,
          };
        });

        if (normalizedItems.length === 0 || finalNet <= 0) {
          throw new Error("Dodaj przynajmniej jedną pozycję z nazwą i ceną netto.");
        }

        data = {
          pvPowerKw: 0,
          inverter: "Brak",
          energyStorage: "Brak",
          offerType: "custom",
          billingSystem: "net_billing",
          withEms: false,
          withBackup: false,
          includeSubsidy: false,
          basePriceNet: finalNet,
          sellerMarkupNet: 0,
          finalNet,
          finalGross: finalNet * (1 + vatRate / 100),
          vatRate,
          companyMargin: 0,
          breakdown: normalizedItems.map((item) => ({
            label: item.name,
            value: item.totalNet,
          })),
          additionalServices: normalizedItems,
          additionalServicesNet: finalNet,
          customPaymentTerms: customPaymentTerms.trim(),
        };
      } else if (!isCalculatorOnline()) {
        const offlineCatalog = buildCalculatorCatalogFromState();

        if (
          Object.keys(offlineCatalog.panels).length === 0 ||
          offlineCatalog.inverters.length === 0 ||
          Object.keys(offlineCatalog.storages).length === 0
        ) {
          throw new Error(
            "Brak katalogu offline. Otwórz kalkulator raz przy dostępie do internetu, żeby zapisać katalog w pamięci przeglądarki."
          );
        }

        data = calculateOffer({
          body: calculationPayload,
          catalog: offlineCatalog,
          currentUser: userProfile,
          settingsRow: null,
          nodeEnv: process.env.NODE_ENV,
        }) as Result;
      } else {
        const headers: HeadersInit = {
          "Content-Type": "application/json",
        };

        if (calculationPayload.customMode) {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (!session?.access_token) {
            throw new Error("Tryb niestandardowy wymaga aktywnej sesji użytkownika.");
          }

          headers.Authorization = `Bearer ${session.access_token}`;
        }

        const res = await fetch("/api/calculate", {
          method: "POST",
          headers,
          body: JSON.stringify(calculationPayload),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => null);
          throw new Error(
            errorData?.error || "Nie udało się przeliczyć oferty"
          );
        }

        data = await res.json();
      }

      setResult(data);
      setResultIsDirty(false);
      setResultPanelTab("summary");
      const calculationId = crypto.randomUUID();
      calculationAuditIdRef.current = calculationId;
      void recordCrmAuditEvent({
        eventType: "calculation_completed",
        action: "calculate",
        module: "calculator",
        summary: `Wykonano kalkulację: ${data.offerType}, ${Number(data.finalGross || 0).toLocaleString("pl-PL")} PLN brutto`,
        entityType: "calculation",
        entityId: calculationId,
        clientId: selectedClientId || clientIdFromUrl || null,
        correlationId: calculationId,
        path: "/calculator",
        metadata: {
          input: calculationPayload,
          result: {
            offer_type: data.offerType,
            final_net: data.finalNet,
            final_gross: data.finalGross,
            vat_rate: data.vatRate,
            pv_power_kw: data.pvPowerKw,
            inverter: data.inverter,
            energy_storage: getResultStorageDisplayName(data),
          },
        },
      });
      setCopied(false);
      setEmailStatus("");
      setSaveOfferStatus("");
      setSavedOfferId(null);
    } catch (error) {
      console.error("Błąd kalkulacji", error);
      setEmailStatus(
        error instanceof Error ? error.message : "Nie udało się przeliczyć oferty"
      );
    }
  }

  function resetForm() {
    setCustomMode(false);
    setCustomProductMode(false);
    setCustomOfferItems([createCustomOfferItem()]);
    setCustomPaymentTerms("");
    setCustomEquipment(createDefaultCustomEquipment());
    setOfferType("none");
    setPanelModel(panels[0]?.code || "");
    setPanelCount(16);
    setManualPowerKw("");
    setRoofType("blacha");
    setStorage("none");
    setClientHasOwnHybridInverter(false);
    setIncludeSubsidy(false);
    setIsUpsell(false);
    setExistingPvPowerKw("0");
    setBillingSystem("net_billing");
    setSelectedInverterName("auto");
    setSelectedAdditionalServices([]);
    setIdenticalSetCount(1);
    setCustomPaymentSchedule(createEmptyCustomPaymentSchedule());
    const defaultMargin = userProfile?.default_seller_markup;

    if (defaultMargin !== null && defaultMargin !== undefined) {
      const parsedDefaultMargin = Number(defaultMargin);

      if (Number.isFinite(parsedDefaultMargin)) {
        setSellerMarkup(parsedDefaultMargin);
      }
    }
    setVatRate(8);
    setResult(null);
    setIsResultFocusMode(false);
    setResultIsDirty(false);
    setResultPanelTab("summary");
    setCopied(false);
    setClientEmail("");
    setClientName("");
    setSelectedClientId("");
    setSaveOfferStatus("");
    setSavedOfferId(null);
    setEmailStatus("");
    setShowSettings(false);
    setIncludeCatalogCards(true);
  }



  async function saveOfferToCrm(clientIdOverride?: string) {
    if (!result) return;

    const clientIdForSave = clientIdOverride || selectedClientId;

    if (!clientIdForSave) {
      setSaveOfferStatus("Wybierz klienta z CRM przed zapisem oferty.");
      return null;
    }

    if (!userProfile?.id) {
      setSaveOfferStatus("Brak zalogowanego użytkownika — nie można zapisać oferty.");
      return;
    }

    const installationCount = customProductMode
      ? 1
      : normalizeInstallationCount(identicalSetCount);
    const customPaymentScheduleForSave = normalizeCustomPaymentSchedule({
      ...customPaymentSchedule,
      enabled: !customProductMode && customModeAvailable && customPaymentSchedule.enabled,
    });
    const customPaymentError = validateCustomPaymentSchedule(
      customPaymentScheduleForSave,
      Number(result.finalGross || 0) * installationCount
    );

    if (customPaymentError) {
      setSaveOfferStatus(customPaymentError);
      return null;
    }

    setSavingOffer(true);
    setSaveOfferStatus("Zapisywanie oferty w CRM...");

    // Use clientEmail from CRM or typed in the input
    const selectedClientForOffer = crmClients.find(
      (client) => client.id === clientIdForSave
    );
    const selectedClientEmailForOffer =
      selectedClientForOffer?.email?.trim() || clientEmail.trim();
    const panelModelForSave = customProductMode
      ? "Oferta niestandardowa"
      : customModeActive
      ? customEquipment.panel.displayName.trim()
      : panelModel;
    const storageForSave = customProductMode
      ? "Brak"
      : customModeActive
      ? customEquipment.storage.displayName.trim()
      : storage;
    const inverterForSave = customProductMode
      ? "Brak"
      : customModeActive
      ? customEquipment.inverter.displayName.trim()
      : selectedInverterName;
    const resultForSave = {
      ...result,
      installationCount,
      identicalSetCount: installationCount,
    };

    const offerPayload = {
      client_id: clientIdForSave,
      created_by: userProfile.id,
      offer_type: result.offerType,
      status: "draft",
      client_name: clientName || null,
      client_email: selectedClientEmailForOffer || null,
      sale_price_net: result.finalNet,
      sale_price_gross: result.finalGross,
      vat_rate: result.vatRate,
      seller_margin: result.sellerMarkupNet,
      company_margin: result.companyMargin,
      subsidy_allocation_enabled: result.subsidyAllocation?.enabled ?? false,
      subsidy_billing_system: result.subsidyAllocation?.billingSystem ?? result.billingSystem ?? null,
      subsidy_pv_net: result.subsidyAllocation?.pvNet ?? null,
      subsidy_storage_net: result.subsidyAllocation?.storageNet ?? null,
      subsidy_ems_net: result.subsidyAllocation?.emsNet ?? null,
      subsidy_storage_subsidy: result.subsidyAllocation?.storageSubsidy ?? null,
      subsidy_ems_bonus: 0,
      subsidy_eu_bonus: result.subsidyAllocation?.euBonus ?? null,
      subsidy_total: result.subsidyAllocation?.total ?? null,
      pv_power_kw: result.pvPowerKw,
      panel_model: panelModelForSave,
      panel_count: customProductMode ? 0 : panelCount,
      panel_power_wp: customProductMode ? 0 : getPanelPowerWp(panelModel),
      inverter: result.inverter,
      energy_storage: getResultStorageDisplayName(result),
      roof_type: roofType,
      offer_data: {
        installationCount,
        identicalSetCount: installationCount,
        pdfQuantity: installationCount,
        customMode: customModeActive,
        customProductMode,
        customOfferItems: customProductMode ? customOfferItems : null,
        customPaymentTerms: customProductMode ? customPaymentTerms.trim() : null,
        customEquipment: customModeActive ? customEquipment : null,
        customPaymentSchedule: customPaymentScheduleForSave,
        result: resultForSave,
        contractBreakdown: result.contractBreakdown || null,
        additionalServices: selectedAdditionalServices,
        additional_services: selectedAdditionalServices,
        form: {
          installationCount,
          identicalSetCount: installationCount,
          customMode: customModeActive,
          customProductMode,
          customOfferItems: customProductMode ? customOfferItems : null,
          customPaymentTerms: customProductMode ? customPaymentTerms.trim() : null,
          customEquipment: customModeActive ? customEquipment : null,
          customPaymentSchedule: customPaymentScheduleForSave,
          offerType,
          panelModel: panelModelForSave,
          panelCount: customProductMode ? 0 : panelCount,
          manualPowerKw,
          roofType,
          storage: storageForSave,
          withEms: Boolean(result.withEms),
          withBackup: Boolean(result.withBackup),
          includeSubsidy,
          isUpsell,
          existingPvPowerKw: isUpsell ? existingPvPowerKw : "0",
          billingSystem,
          selectedInverterName: inverterForSave,
          clientHasOwnHybridInverter,
          sellerMarkup,
          vatRate,
          defaultCalculatorMargin: userProfile?.default_seller_markup ?? null,
          contractBreakdown: result.contractBreakdown || null,
          additionalServices: selectedAdditionalServices,
          additional_services: selectedAdditionalServices,
        },
        pricingOverrides,
        advisor: {
          id: userProfile.id,
          name: advisorName,
          phone: advisorPhone,
          email: advisorEmail,
        },
      },
    };

    const { data, error } = await supabase
      .from("client_offers")
      .insert(offerPayload)
      .select("id, offer_public_id")
      .single();

    if (error) {
      console.error("Błąd zapisu oferty w CRM", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });

      setSaveOfferStatus(
        error.message
          ? `Błąd zapisu oferty: ${error.message}`
          : "Błąd zapisu oferty w CRM. Sprawdź tabelę client_offers i RLS."
      );

      setSavingOffer(false);
      return null;
    }

    setSavedOfferId(data.id);

    void recordCrmAuditEvent({
      eventType: "offer_saved",
      action: "save",
      module: "offers",
      summary: `Zapisano ofertę ${data.offer_public_id || data.id} w CRM`,
      entityType: "client_offers",
      entityId: data.id,
      clientId: clientIdForSave,
      offerId: data.id,
      correlationId: calculationAuditIdRef.current,
      path: "/calculator",
    });

    setSaveOfferStatus(
      data?.offer_public_id
        ? `Oferta zapisana w CRM jako ${data.offer_public_id}.`
        : "Oferta zapisana w CRM."
    );
    setSavingOffer(false);
    return data.id;
  }


  function buildOfferText(result: Result) {
    if (result.offerType === "custom") {
      const itemLines = (result.additionalServices || [])
        .map((item) => {
          const quantity = Number(item.quantity || 1);
          const quantityText = quantity !== 1 ? ` × ${quantity} szt.` : "";
          return `- ${item.name}${quantityText}: ${Number(item.totalNet || 0).toLocaleString("pl-PL")} zł netto`;
        })
        .join("\n");
      const paymentTerms = result.customPaymentTerms?.trim()
        ? `\nForma rozliczenia / warunki płatności:\n${result.customPaymentTerms.trim()}\n`
        : "";

      return `Dzień dobry,

przesyłam ofertę przygotowaną na wskazane produkty lub usługi.

Zakres oferty:
${itemLines}

Cena netto: ${result.finalNet.toLocaleString("pl-PL")} zł
Cena brutto ${result.vatRate}%: ${result.finalGross.toLocaleString("pl-PL")} zł
${paymentTerms}

Pozdrawiamy,
IdeaSol`;
    }

    const isStorageOnly = result.offerType === "storage";
const storageDisplayName = getResultStorageDisplayName(result);
const hasStorage = storageDisplayName !== "Brak";
const hasInverter = result.inverter && result.inverter !== "Brak";

    const intro = isStorageOnly
      ? "przesyłam wstępną ofertę magazynu energii."
      : hasStorage
        ? "przesyłam wstępną ofertę instalacji fotowoltaicznej wraz z magazynem energii."
        : "przesyłam wstępną ofertę instalacji fotowoltaicznej.";

    const pvLine = isStorageOnly ? "" : `- instalacja PV: ${result.pvPowerKw} kWp\n`;
    const inverterLine = hasInverter
      ? `- ${getInverterLabel(result.inverter)}: ${result.inverter}\n`
      : "";
    const storageLine = hasStorage ? `- magazyn energii: ${storageDisplayName}\n` : "";

    return `Dzień dobry,

${intro}

Zakres oferty:
${pvLine}${inverterLine}${storageLine}- montaż instalacji
- podstawowe zabezpieczenia
- dokumentacja i przygotowanie do zgłoszenia

Cena netto: ${result.finalNet.toLocaleString("pl-PL")} zł
Cena brutto ${result.vatRate}%: ${result.finalGross.toLocaleString("pl-PL")} zł

Oferta ma charakter wstępny i wymaga potwierdzenia po analizie warunków montażowych.

Pozdrawiamy,
IdeaSol`;
  }

  async function copyOffer() {
    if (!result) return;

    await navigator.clipboard.writeText(buildOfferText(result));
    setCopied(true);
  }

  async function sendOfferEmail(
    mode: "anonymous" | "public" = "anonymous",
    emailOptions?: OfferEmailOptions
  ) {
    if (!result) return;

    const selectedClient = crmClients.find(
      (client) => client.id === selectedClientId
    );

    if (!selectedClientId || !selectedClient) {
      setEmailStatus(
        "Wybierz klienta z CRM przed wysłaniem oferty mailowej."
      );
      return;
    }

    const selectedClientEmail = String(selectedClient.email || "").trim();
    const typedClientEmail = clientEmail.trim();
    const emailForSend = selectedClientEmail || typedClientEmail;

    if (!emailForSend) {
      setEmailStatus(
        "Podaj adres e-mail klienta przed wysyłką oferty."
      );
      return;
    }

    if (!emailForSend.includes("@")) {
      setEmailStatus("Podaj poprawny adres e-mail klienta.");
      return;
    }

    setClientEmail(emailForSend);
    setSendingEmail(true);
    setEmailStatus("");

    const catalogCardsForEmail = includeCatalogCards
      ? buildCatalogCardRequests(result)
      : [];

    if (!isCalculatorOnline()) {
      const offlineItem: OfflineOfferQueueItem = {
        id: createOfflineQueueId(),
        createdAt: new Date().toISOString(),
        status: "pending",
        clientId: selectedClientId,
        clientName: clientName || getClientDisplayName(selectedClient),
        clientEmail: emailForSend,
        sendMode: mode,
        offerText: buildOfferText(result),
        snapshot: {
          result,
          selectedClientId,
          clientName: clientName || getClientDisplayName(selectedClient),
          clientEmail: emailForSend,
          selectedClientEmail,
          typedClientEmail,
          customMode: customModeActive,
          customProductMode,
          customOfferItems: customProductMode ? customOfferItems : null,
          customPaymentTerms: customProductMode ? customPaymentTerms.trim() : null,
          customEquipment: customModeActive ? customEquipment : null,
          customPaymentSchedule: normalizeCustomPaymentSchedule({
            ...customPaymentSchedule,
            enabled: !customProductMode && customModeAvailable && customPaymentSchedule.enabled,
          }),
          offerType,
          panelModel: getPanelDisplayName(panelModel),
          panelCount,
          panelPowerWp: getPanelPowerWp(panelModel),
          panelName: getPanelDisplayName(panelModel),
          manualPowerKw,
          roofType,
          storage: customModeActive ? customEquipment.storage.displayName : storage,
          withEms: Boolean(result.withEms),
          withBackup: Boolean(result.withBackup),
          includeSubsidy,
          isUpsell,
          existingPvPowerKw,
          billingSystem,
          selectedInverterName: customModeActive
            ? customEquipment.inverter.displayName
            : selectedInverterName,
          clientHasOwnHybridInverter,
          sellerMarkup,
          vatRate,
          selectedAdditionalServices,
          installationCount: normalizeInstallationCount(identicalSetCount),
          identicalSetCount: normalizeInstallationCount(identicalSetCount),
          pricingOverrides,
          advisor: {
            id: userProfile?.id || null,
            name: advisorName,
            phone: advisorPhone,
            email: advisorEmail,
            role: userProfile?.role || currentUserRole,
          },
          includeCatalogCards,
          catalogCards: catalogCardsForEmail,
          sellerNote: emailOptions?.sellerNote || "",
          includeOfferPdf: Boolean(emailOptions?.includeOfferPdf),
          offerPdfPayload: emailOptions?.offerPdfPayload || null,
        },
      };

      const nextQueueLength = addOfflineOfferToQueue(offlineItem);
      void recordCrmAuditEvent({
        eventType: "offer_queued",
        action: "queue",
        module: "offers",
        summary: `Oferta dla ${emailForSend} została dodana do kolejki offline`,
        entityType: "client_offers",
        clientId: selectedClientId,
        correlationId: calculationAuditIdRef.current,
        path: "/calculator",
        metadata: { recipient: emailForSend, send_mode: mode },
      });
      setQueuedOfferCount(nextQueueLength);
      setSendingEmail(false);
      setEmailStatus(
        `Brak internetu — oferta została dodana do kolejki offline. Liczba oczekujących ofert: ${nextQueueLength}.`
      );
      return;
    }

    if (!selectedClientEmail && typedClientEmail) {
      const { error: updateClientEmailError } = await supabase
        .from("clients")
        .update({ email: typedClientEmail })
        .eq("id", selectedClientId);

      if (updateClientEmailError) {
        console.error("Nie udało się zapisać e-maila na karcie klienta:", {
          message: updateClientEmailError.message,
          details: updateClientEmailError.details,
          hint: updateClientEmailError.hint,
          code: updateClientEmailError.code,
        });

        setSendingEmail(false);
        setEmailStatus(
          `Nie udało się zapisać e-maila na karcie klienta: ${updateClientEmailError.message}`
        );
        return;
      }

      setCrmClients((currentClients) =>
        currentClients.map((client) =>
          client.id === selectedClientId
            ? { ...client, email: typedClientEmail }
            : client
        )
      );
    }

    try {
      const savedOfferId = await saveOfferToCrm(selectedClientId);

      if (!savedOfferId) {
        throw new Error("Nie udało się zapisać oferty w CRM");
      }

      const offerPdfBase64 = emailOptions?.includeOfferPdf
        ? await generateOfferPdfBase64(emailOptions.offerPdfPayload)
        : undefined;

      const res = await fetch("/api/send-offer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientEmail: emailForSend,
          sendMode: mode,
          advisor: {
            id: userProfile?.id || null,
            name: advisorName,
            phone: advisorPhone,
            email: advisorEmail,
            role: userProfile?.role || currentUserRole,
          },
          advisorName,
          advisorPhone,
          advisorEmail,
          offerType: result.offerType,
          pvPowerKw: result.pvPowerKw,
          panelName: getPanelDisplayName(panelModel),
          panelModel: getPanelDisplayName(panelModel),
          panelCount,
          panelPowerWp: getPanelPowerWp(panelModel),
          inverter: result.inverter,
          inverterType: getSelectedInverterType(result.inverter),
          energyStorage: getResultStorageDisplayName(result),
          finalNet: result.finalNet,
          finalGross: result.finalGross,
          vatRate: result.vatRate,
          additionalServices: result.additionalServices || [],
          customPaymentTerms: result.customPaymentTerms || "",
          subsidyAllocation: result.subsidyAllocation || null,
          subsidyTotal: result.subsidyAllocation?.total || 0,
          includeCatalogCards: catalogCardsForEmail.length > 0,
          catalogCards: catalogCardsForEmail,
          sellerNote: emailOptions?.sellerNote || "",
          includeOfferPdf: Boolean(emailOptions?.includeOfferPdf),
          offerPdfBase64,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || "Nie udało się wysłać maila");
      }

      void recordCrmAuditEvent({
        eventType: "offer_sent",
        action: "send",
        module: "offers",
        summary: `Wysłano ofertę e-mail do ${emailForSend}`,
        entityType: "client_offers",
        entityId: savedOfferId,
        clientId: selectedClientId,
        offerId: savedOfferId,
        correlationId: calculationAuditIdRef.current,
        path: "/calculator",
        metadata: {
          recipient: emailForSend,
          send_mode: mode,
          pdf_attached: Boolean(emailOptions?.includeOfferPdf),
          catalog_cards_attached: catalogCardsForEmail.length,
        },
      });

      const mailActivityDescription = [
        `Wysłano ofertę mailową z kalkulatora.`,
        savedOfferId ? `OfferID: ${savedOfferId}` : null,
        `Odbiorca: ${emailForSend}`,
        !selectedClientEmail && typedClientEmail
          ? "E-mail został automatycznie zapisany na karcie klienta."
          : null,
        emailOptions?.includeOfferPdf ? "Załączono ofertę PDF." : null,
        emailOptions?.sellerNote ? `Notatka handlowca: ${emailOptions.sellerNote}` : null,
        "",
        buildOfferText(result),
      ]
        .filter(Boolean)
        .join("\n");

      const { error: activityError } = await supabase
        .from("client_activities")
        .insert({
          client_id: selectedClientId,
          created_by: userProfile?.id || null,
          activity_type: "email",
          status: "wyslano",
          description: mailActivityDescription,
        });

      if (activityError) {
        console.error("Mail wysłany, ale nie udało się zapisać aktywności CRM:", {
          message: activityError.message,
          details: activityError.details,
          hint: activityError.hint,
          code: activityError.code,
        });

        setEmailStatus(
          `Mail został wysłany, ale nie udało się zapisać aktywności w CRM: ${activityError.message}`
        );
        return;
      }

      setEmailStatus("Mail został wysłany i zapisany w CRM");
    } catch (error) {
      console.error("Błąd wysyłki oferty mailowej z kalkulatora:", error);
      void recordCrmAuditEvent({
        eventType: "offer_send_failed",
        action: "error",
        module: "offers",
        summary: `Nie udało się wysłać oferty do ${emailForSend}`,
        entityType: "client_offers",
        clientId: selectedClientId,
        correlationId: calculationAuditIdRef.current,
        path: "/calculator",
        metadata: {
          recipient: emailForSend,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      setEmailStatus(
        error instanceof Error ? error.message : "Błąd wysyłki maila"
      );
    } finally {
      setSendingEmail(false);
    }
  }

  async function syncOfflineOfferQueue() {
    if (syncingOfflineOffers) return;
    if (!isCalculatorOnline()) return;

    const queue = readOfflineOfferQueue();

    if (queue.length === 0) {
      setQueuedOfferCount(0);
      return;
    }

    if (!userProfile?.id) {
      setEmailStatus("Nie można zsynchronizować ofert offline — brak zalogowanego użytkownika.");
      return;
    }

    setSyncingOfflineOffers(true);
    setEmailStatus(`Synchronizuję oferty offline: ${queue.length} oczekujących...`);

    try {
      for (const item of queue) {
        const snapshot = item.snapshot as Record<string, any>;
        const queuedResult = snapshot.result as Result | null;

        if (!queuedResult) {
          continue;
        }

        const selectedAdditionalServicesSnapshot =
          (snapshot.selectedAdditionalServices as SelectedAdditionalService[] | undefined) || [];
        const customPaymentScheduleSnapshot = normalizeCustomPaymentSchedule(
          snapshot.customPaymentSchedule
        );
        const installationCountSnapshot = normalizeInstallationCount(
          snapshot.installationCount ?? snapshot.identicalSetCount
        );
        const pricingOverridesSnapshot = snapshot.pricingOverrides || pricingOverrides;
        const advisorSnapshot =
          (snapshot.advisor as Record<string, unknown> | undefined) || {};
        const catalogCardsSnapshot = Array.isArray(snapshot.catalogCards)
          ? (snapshot.catalogCards as CatalogCardEmailAttachment[])
          : [];
        const includeOfferPdfSnapshot = Boolean(snapshot.includeOfferPdf);
        const offerPdfPayloadSnapshot = snapshot.offerPdfPayload as Record<string, unknown> | null;

        if (!snapshot.selectedClientEmail && snapshot.typedClientEmail) {
          const { error: updateClientEmailError } = await supabase
            .from("clients")
            .update({ email: item.clientEmail })
            .eq("id", item.clientId);

          if (updateClientEmailError) {
            throw new Error(
              `Nie udało się zapisać e-maila klienta dla oferty offline: ${updateClientEmailError.message}`
            );
          }
        }

        const offerPayload = {
          client_id: item.clientId,
          created_by: userProfile.id,
          offer_type: queuedResult.offerType,
          status: "draft",
          client_name: item.clientName || null,
          client_email: item.clientEmail || null,
          sale_price_net: queuedResult.finalNet,
          sale_price_gross: queuedResult.finalGross,
          vat_rate: queuedResult.vatRate,
          seller_margin: queuedResult.sellerMarkupNet,
          company_margin: queuedResult.companyMargin,
          subsidy_allocation_enabled: queuedResult.subsidyAllocation?.enabled ?? false,
          subsidy_billing_system:
            queuedResult.subsidyAllocation?.billingSystem ?? queuedResult.billingSystem ?? null,
          subsidy_pv_net: queuedResult.subsidyAllocation?.pvNet ?? null,
          subsidy_storage_net: queuedResult.subsidyAllocation?.storageNet ?? null,
          subsidy_ems_net: queuedResult.subsidyAllocation?.emsNet ?? null,
          subsidy_storage_subsidy: queuedResult.subsidyAllocation?.storageSubsidy ?? null,
          subsidy_ems_bonus: 0,
          subsidy_eu_bonus: queuedResult.subsidyAllocation?.euBonus ?? null,
          subsidy_total: queuedResult.subsidyAllocation?.total ?? null,
          pv_power_kw: queuedResult.pvPowerKw,
          panel_model: snapshot.panelModel || null,
          panel_count: Number(snapshot.panelCount || 0),
          panel_power_wp: Number(snapshot.panelPowerWp || 0),
          inverter: queuedResult.inverter,
          energy_storage: getResultStorageDisplayName(queuedResult),
          roof_type: snapshot.roofType || null,
          offer_data: {
            installationCount: installationCountSnapshot,
            identicalSetCount: installationCountSnapshot,
            pdfQuantity: installationCountSnapshot,
            customMode: Boolean(snapshot.customMode),
            customEquipment: snapshot.customEquipment || null,
            customPaymentSchedule: customPaymentScheduleSnapshot,
            result: {
              ...queuedResult,
              installationCount: installationCountSnapshot,
              identicalSetCount: installationCountSnapshot,
            },
            contractBreakdown: queuedResult.contractBreakdown || null,
            additionalServices: selectedAdditionalServicesSnapshot,
            additional_services: selectedAdditionalServicesSnapshot,
            form: {
              installationCount: installationCountSnapshot,
              identicalSetCount: installationCountSnapshot,
              customMode: Boolean(snapshot.customMode),
              customEquipment: snapshot.customEquipment || null,
              customPaymentSchedule: customPaymentScheduleSnapshot,
              offerType: snapshot.offerType || queuedResult.offerType,
              panelModel: snapshot.panelModel || null,
              panelCount: Number(snapshot.panelCount || 0),
              manualPowerKw: snapshot.manualPowerKw || "",
              roofType: snapshot.roofType || null,
              storage: snapshot.storage || null,
              withEms: Boolean(queuedResult.withEms ?? snapshot.withEms),
              withBackup: Boolean(queuedResult.withBackup ?? snapshot.withBackup),
              includeSubsidy: Boolean(snapshot.includeSubsidy),
              isUpsell: Boolean(snapshot.isUpsell),
              existingPvPowerKw: snapshot.isUpsell ? snapshot.existingPvPowerKw || "0" : "0",
              billingSystem: snapshot.billingSystem || queuedResult.billingSystem || "net_billing",
              selectedInverterName: snapshot.selectedInverterName || "auto",
              clientHasOwnHybridInverter: Boolean(
                snapshot.clientHasOwnHybridInverter || queuedResult.clientHasOwnHybridInverter
              ),
              sellerMarkup: Number(snapshot.sellerMarkup || 0),
              vatRate: Number(snapshot.vatRate || queuedResult.vatRate || 8),
              defaultCalculatorMargin: userProfile?.default_seller_markup ?? null,
              contractBreakdown: queuedResult.contractBreakdown || null,
              additionalServices: selectedAdditionalServicesSnapshot,
              additional_services: selectedAdditionalServicesSnapshot,
            },
            pricingOverrides: pricingOverridesSnapshot,
            advisor: {
              id: userProfile.id,
              name: advisorSnapshot.name || advisorName,
              phone: advisorSnapshot.phone || advisorPhone,
              email: advisorSnapshot.email || advisorEmail,
            },
          },
        };

        const { data: savedOffer, error: offerError } = await supabase
          .from("client_offers")
          .insert(offerPayload)
          .select("id, offer_public_id")
          .single();

        if (offerError || !savedOffer) {
          throw new Error(
            offerError?.message || "Nie udało się zapisać oferty offline w CRM"
          );
        }

        const offerPdfBase64 = includeOfferPdfSnapshot && offerPdfPayloadSnapshot
          ? await generateOfferPdfBase64(offerPdfPayloadSnapshot)
          : undefined;

        const res = await fetch("/api/send-offer", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clientEmail: item.clientEmail,
            sendMode: item.sendMode,
            advisor: {
              id: userProfile.id,
              name: advisorSnapshot.name || advisorName,
              phone: advisorSnapshot.phone || advisorPhone,
              email: advisorSnapshot.email || advisorEmail,
              role: advisorSnapshot.role || currentUserRole,
            },
            advisorName: advisorSnapshot.name || advisorName,
            advisorPhone: advisorSnapshot.phone || advisorPhone,
            advisorEmail: advisorSnapshot.email || advisorEmail,
            offerType: queuedResult.offerType,
            pvPowerKw: queuedResult.pvPowerKw,
            panelName: snapshot.panelName || snapshot.panelModel,
            panelModel: snapshot.panelModel,
            panelCount: Number(snapshot.panelCount || 0),
            panelPowerWp: Number(snapshot.panelPowerWp || 0),
            inverter: queuedResult.inverter,
            inverterType: getSelectedInverterType(queuedResult.inverter),
            energyStorage: getResultStorageDisplayName(queuedResult),
            finalNet: queuedResult.finalNet,
            finalGross: queuedResult.finalGross,
            vatRate: queuedResult.vatRate,
            subsidyAllocation: queuedResult.subsidyAllocation || null,
            subsidyTotal: queuedResult.subsidyAllocation?.total || 0,
            includeCatalogCards: Boolean(snapshot.includeCatalogCards) && catalogCardsSnapshot.length > 0,
            catalogCards: Boolean(snapshot.includeCatalogCards) ? catalogCardsSnapshot : [],
            sellerNote: String(snapshot.sellerNote || ""),
            includeOfferPdf: includeOfferPdfSnapshot,
            offerPdfBase64,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => null);
          throw new Error(errorData?.error || "Nie udało się wysłać zaległej oferty mailowej");
        }

        const mailActivityDescription = [
          `Wysłano zaległą ofertę mailową z kolejki offline kalkulatora.`,
          savedOffer?.offer_public_id ? `OfferID: ${savedOffer.offer_public_id}` : `OfferID: ${savedOffer.id}`,
          `Odbiorca: ${item.clientEmail}`,
          !snapshot.selectedClientEmail && snapshot.typedClientEmail
            ? "E-mail został automatycznie zapisany na karcie klienta."
            : null,
          includeOfferPdfSnapshot ? "Załączono ofertę PDF." : null,
          snapshot.sellerNote ? `Notatka handlowca: ${String(snapshot.sellerNote)}` : null,
          "",
          item.offerText,
        ]
          .filter(Boolean)
          .join("\n");

        const { error: activityError } = await supabase
          .from("client_activities")
          .insert({
            client_id: item.clientId,
            created_by: userProfile.id,
            activity_type: "email",
            status: "wyslano",
            description: mailActivityDescription,
          });

        if (activityError) {
          throw new Error(
            `Oferta offline została wysłana, ale nie udało się zapisać aktywności CRM: ${activityError.message}`
          );
        }

        const nextQueueLength = removeOfflineOfferFromQueue(item.id);
        setQueuedOfferCount(nextQueueLength);
      }

      setEmailStatus("Zaległe oferty offline zostały zsynchronizowane.");
    } catch (error) {
      console.error("Błąd synchronizacji ofert offline", error);
      setEmailStatus(
        error instanceof Error
          ? `Błąd synchronizacji ofert offline: ${error.message}`
          : "Błąd synchronizacji ofert offline"
      );
    } finally {
      setSyncingOfflineOffers(false);
      setQueuedOfferCount(readOfflineOfferQueue().length);
    }
  }

  useEffect(() => {
    if (isOffline || queuedOfferCount === 0 || !userProfile?.id) {
      return;
    }

    void syncOfflineOfferQueue();
  }, [isOffline, queuedOfferCount, userProfile?.id]);

  const quickEditStorageItem = storages.find((storageItem) => storageItem.code === storage);
  const quickEditInverters = (result?.energyStorage !== "Brak" && quickEditStorageItem
    ? rankInvertersForStorage(inverters, quickEditStorageItem)
    : inverters.filter((inverterItem) => inverterItem.type !== "hybrid"))
    .filter((inverterItem, index, compatibleInverters) => (
      compatibleInverters.findIndex((candidate) => candidate.name === inverterItem.name) === index
    ));

  function markResultForRecalculation() {
    if (result) setResultIsDirty(true);
  }



  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">

        {(isOffline || queuedOfferCount > 0) && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-semibold">
              {isOffline ? "Tryb offline kalkulatora" : "Kolejka ofert offline"}
            </p>
            <p className="mt-1">
              {isOffline
                ? "Korzystasz z klientów zapisanych wcześniej w pamięci tego urządzenia. Wysyłka oferty zostanie dodana do kolejki offline."
                : "Masz oczekujące oferty zapisane offline."}
            </p>
            {queuedOfferCount > 0 && (
              <p className="mt-2 font-medium">
                Oczekujące oferty do synchronizacji: {queuedOfferCount}
              </p>
            )}
          </div>
        )}

        {catalogError && (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-800 shadow-sm dark:border-red-900 dark:bg-red-950/40 dark:text-red-100" role="alert">
            Katalog sprzętu: {catalogError}
          </div>
        )}

        {canSeePricingPanel && showAdminPanel && (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
            <AdminPanel
              adminStatus={adminStatus}
              pricingOverrides={pricingOverrides}
              updatePricingValue={updatePricingValue}
              savePricingSettings={savePricingSettings}
              resetPricingOverrides={resetPricingOverrides}
            />
          </section>
        )}

        <section>
          <div
            className={`${isResultFocusMode ? "gap-0 xl:grid-cols-[0fr_minmax(0,1fr)]" : "gap-5 xl:grid-cols-[minmax(0,1fr)_380px]"} grid items-start transition-[grid-template-columns,gap] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none`}
          >
            <div className={`${isResultFocusMode ? "pointer-events-none max-h-0 opacity-0" : "max-h-[4000px] opacity-100"} min-w-0 overflow-hidden transition-[max-height,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none`}>
              <OfferForm
              offerType={offerType}
              setOfferType={setOfferType}
              panelModel={panelModel}
              setPanelModel={setPanelModel}
              panelCount={panelCount}
              setPanelCount={setPanelCount}
              manualPowerKw={manualPowerKw}
              identicalSetCount={identicalSetCount}
              setIdenticalSetCount={setIdenticalSetCount}
              clientName={clientName}
              setClientName={setClientName}
              setClientEmail={setClientEmail}
              selectedClientId={selectedClientId}
              setSelectedClientId={setSelectedClientId}
              setManualPowerKw={setManualPowerKw}
              calculateNearestPanelCount={calculateNearestPanelCount}
              roofType={roofType}
              setRoofType={setRoofType}
              storage={storage}
              setStorage={setStorage}
              billingSystem={billingSystem}
              setBillingSystem={setBillingSystem}
              includeSubsidy={includeSubsidy}
              setIncludeSubsidy={setIncludeSubsidy}
              isUpsell={isUpsell}
              setIsUpsell={setIsUpsell}
              existingPvPowerKw={existingPvPowerKw}
              setExistingPvPowerKw={setExistingPvPowerKw}
              storages={storages}
              panels={panels}
              inverters={inverters}
              clientHasOwnHybridInverter={clientHasOwnHybridInverter}
              setClientHasOwnHybridInverter={setClientHasOwnHybridInverter}
              selectedInverterName={selectedInverterName}
              setSelectedInverterName={setSelectedInverterName}
              vatRate={vatRate}
              setVatRate={setVatRate}
              calculate={calculate}
              setResult={(nextResult) => {
                if (nextResult === null) {
                  if (result) setResultIsDirty(true);
                  return;
                }
                setResult(nextResult);
              }}
              setEmailStatus={setEmailStatus}
              showSettings={showSettings}
              setShowSettings={setShowSettings}
              sellerMarkup={sellerMarkup}
              setSellerMarkup={setSellerMarkup}
              selectedAdditionalServices={selectedAdditionalServices}
              setSelectedAdditionalServices={setSelectedAdditionalServices}
              customModeAvailable={customModeAvailable}
              customMode={customModeActive}
              setCustomMode={setCustomMode}
              customProductMode={customProductMode}
              setCustomProductMode={setCustomProductMode}
              customOfferItems={customOfferItems}
              setCustomOfferItems={setCustomOfferItems}
              customPaymentTerms={customPaymentTerms}
              setCustomPaymentTerms={setCustomPaymentTerms}
              customEquipment={customEquipment}
              setCustomEquipment={setCustomEquipment}
              customPaymentSchedule={customPaymentSchedule}
              setCustomPaymentSchedule={setCustomPaymentSchedule}
              customPaymentTotalGross={
                Number(result?.finalGross || 0) * (customProductMode ? 1 : normalizeInstallationCount(identicalSetCount))
              }
              hasStaleResult={resultIsDirty}
            />
            </div>

            <aside
              ref={resultSectionRef}
              className={
                isResultFocusMode
                  ? "relative mx-auto w-full max-w-6xl transition-[max-width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                  : "relative min-w-0 transition-[max-width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none xl:sticky xl:top-4"
              }
            >
              {result && (
                <ResultPanelFocusToggle
                  expanded={isResultFocusMode}
                  onToggle={() => setIsResultFocusMode((current) => !current)}
                />
              )}
              <div className={`${isResultFocusMode ? "p-3" : "p-2"} overflow-hidden rounded-[26px] border border-slate-200 bg-slate-100/70 shadow-xl shadow-slate-200/50 dark:border-slate-700 dark:bg-slate-950 dark:shadow-black/20`}>
                <div className={`${isResultFocusMode ? "p-6" : "p-4"} rounded-[20px] bg-slate-950 text-white dark:border dark:border-slate-700 dark:bg-black`}>
                  <div className={`${isResultFocusMode ? "mb-5" : "mb-3"} flex items-center justify-between gap-3`}>
                    <div>
                      <p className={`${isResultFocusMode ? "text-xs" : "text-[10px]"} font-black uppercase tracking-[0.18em] text-emerald-400`}>Pulpit oferty</p>
                      <h2 className={`${isResultFocusMode ? "mt-2 text-3xl" : "mt-1"} font-bold text-white`}>Wynik kalkulacji</h2>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${resultIsDirty ? "border-amber-400/40 bg-amber-400/10 text-amber-300" : result ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/5 text-white/40"}`}>
                      {resultIsDirty ? "DO PRZELICZENIA" : result ? "AKTUALNY" : "BRAK WYNIKU"}
                    </span>
                  </div>
                  {result && (
                    <ResultOverviewBar
                      priceGross={result.finalGross * (customProductMode ? 1 : normalizeInstallationCount(identicalSetCount))}
                      pvPowerKw={result.pvPowerKw}
                      storageCapacityKwh={result.storageCapacityKwh}
                      expanded={isResultFocusMode}
                    />
                  )}
                  <div className={`${isResultFocusMode ? "gap-2 p-1.5" : "gap-1 p-1"} grid ${result?.offerType === "custom" ? "grid-cols-1" : "grid-cols-3"} rounded-xl bg-white/10`}>
                    {(result?.offerType === "custom"
                      ? [{ value: "summary", label: "Wycena" }]
                      : [
                          { value: "summary", label: "Wycena" },
                          { value: "subsidy", label: "Dotacja" },
                          { value: "credit", label: "Raty" },
                        ]
                    ).map((tab) => (
                      <button key={tab.value} type="button" disabled={!result} onClick={() => setResultPanelTab(tab.value as "summary" | "subsidy" | "credit")} className={`${isResultFocusMode ? "py-3 text-sm" : "py-2 text-xs"} rounded-lg px-2 font-bold transition ${resultPanelTab === tab.value && result ? "bg-white text-slate-950 shadow-sm" : "text-white/45 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"}`}>
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {resultIsDirty && (
                  <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                    Konfiguracja została zmieniona. Ostatni wynik pozostaje widoczny, ale zapis i dokumenty są zablokowane do ponownego przeliczenia.
                  </div>
                )}

                {!result ? (
                  <div className="p-7 text-center">
                    <div className="mx-auto h-12 w-px bg-gradient-to-b from-emerald-400 to-transparent" />
                    <p className="mt-3 font-bold text-slate-900 dark:text-white">Czekam na przeliczenie</p>
                    <p className="mx-auto mt-1 max-w-56 text-xs leading-5 text-slate-500">Tutaj pojawi się cena, konfiguracja, dotacja i finansowanie.</p>
                  </div>
                ) : (
                  <div className={`${isResultFocusMode ? "w-full px-5 pb-5 pt-5" : "max-h-[calc(100vh-13rem)] overflow-y-auto px-1 pb-1 pt-2"} ${resultIsDirty ? "pointer-events-none opacity-65" : ""}`}>
                    {resultPanelTab === "summary" && (
                      <OfferResult
                  result={result}
                  panelCount={panelCount}
                  panelPowerWp={getPanelPowerWp(panelModel)}
                  panelName={getPanelDisplayName(panelModel)}
                  identicalSetCount={customProductMode ? 1 : identicalSetCount}
                  customPaymentSchedule={
                    customProductMode ? createEmptyCustomPaymentSchedule() : customPaymentSchedule
                  }
                  copied={copied}
                  copyOffer={copyOffer}
                  resetForm={resetForm}
                  setResult={(nextResult) => {
                    setResult(nextResult);
                    if (nextResult === null) setIsResultFocusMode(false);
                  }}
                  setCopied={setCopied}
                  setEmailStatus={setEmailStatus}
                  catalogCards={buildCatalogCardRequests(result)}
                  includeCatalogCards={includeCatalogCards}
                  setIncludeCatalogCards={setIncludeCatalogCards}
                  clientEmail={clientEmail}
                  clientName={clientName}
                  setClientEmail={setClientEmail}
                  sendOfferEmail={sendOfferEmail}
                  sendingEmail={sendingEmail}
                  emailStatus={emailStatus}
                  saveOfferToCrm={saveOfferToCrm}
                  savingOffer={savingOffer}
                  saveOfferStatus={saveOfferStatus}
                  savedOfferId={savedOfferId}
                  selectedClientId={selectedClientId}
                  crmClients={crmClients}
                  setSelectedClientId={setSelectedClientId}
                  canSeeTechnicalView={canSeeTechnicalView}
                  currentUserRole={currentUserRole}
                  advisorName={advisorName}
                  advisorPhone={advisorPhone}
                  advisorEmail={advisorEmail}
                  compact
                  wide={isResultFocusMode}
                  hideSubsidy
                  equipmentQuickEdit={customModeActive || customProductMode ? undefined : {
                    panel: result.offerType === "storage" ? undefined : {
                      value: panelModel,
                      options: panels.map((panel) => ({
                        value: panel.code,
                        label: `${panel.display_name || panel.name} · ${panel.power_wp} Wp`,
                      })),
                      onChange: (value) => {
                        setPanelModel(value);
                        markResultForRecalculation();
                      },
                    },
                    storage: result.energyStorage === "Brak" ? undefined : {
                      value: storage,
                      options: storages.map((storageItem) => ({
                        value: storageItem.code,
                        label: `${storageItem.display_name || storageItem.name} · ${storageItem.capacity_kwh.toLocaleString("pl-PL")} kWh · ${getCatalogStorageVoltageType(storageItem) === "high_voltage" ? "HV" : getCatalogStorageVoltageType(storageItem) === "low_voltage" ? "LV" : "brak danych"}`,
                      })),
                      onChange: (value) => {
                        setStorage(value);
                        setSelectedInverterName("auto");
                        markResultForRecalculation();
                      },
                    },
                    inverter: result.inverter === "Brak" || clientHasOwnHybridInverter ? undefined : {
                      value: selectedInverterName,
                      options: [
                        { value: "auto", label: "Dobierz automatycznie" },
                        ...quickEditInverters.map((inverterItem) => ({
                          value: inverterItem.name,
                          label: `${inverterItem.display_name || inverterItem.name} · do ${Number(inverterItem.max_pv_kw).toLocaleString("pl-PL")} kWp`,
                        })),
                      ],
                      onChange: (value) => {
                        setSelectedInverterName(value);
                        markResultForRecalculation();
                      },
                    },
                  }}
                />
                    )}
                    {resultPanelTab === "subsidy" && (
                      result.energyStorage !== "Brak" && (result.includeSubsidy || result.subsidyAllocation?.requested) ? (
                        <SubsidyOptimizer
                          totalOfferNetPrice={result.finalNet}
                          totalOfferGrossPrice={result.finalGross * normalizeInstallationCount(identicalSetCount)}
                          allocation={result.subsidyAllocation}
                          compact
                          expanded={isResultFocusMode}
                        />
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">Dotacja nie została uwzględniona w tej kalkulacji.</div>
                      )
                    )}
                    {resultPanelTab === "credit" && (
                      <CreditCalculator installationPrice={result.finalGross * normalizeInstallationCount(identicalSetCount)} compact expanded={isResultFocusMode} />
                    )}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
