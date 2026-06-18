"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useRef, useState } from "react";
import OfferResult from "@/components/calculator/OfferResult";
import OfferForm from "@/components/calculator/OfferForm";
import AdminPanel from "@/components/calculator/AdminPanel";


type Result = {
  pvPowerKw: number;
  inverter: string;
  energyStorage: string;
  offerType: string;

  billingSystem?: "net_billing" | "net_metering";
  withEms?: boolean;
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
};


type CatalogPanel = {
  code: string;
  name: string;
  display_name: string | null;
  power_wp: number;
  price_net: number;
};

type CatalogStorage = {
  code: string;
  name: string;
  display_name: string | null;
  capacity_kwh: number;
  price_net: number;
  installation_net: number;
};

type CatalogInverter = {
  name: string;
  display_name: string | null;
  type: string;
  max_pv_kw: number;
  price_net: number;
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


const DEFAULT_PRICING_OVERRIDES = {
  panels: {
    AMERISOLAR_450_FB: { priceNet: 230 },
    HORAY_435_BIFACIAL: { priceNet: 240 },
  },
  storages: {
    ZBPOWER_10: { priceNet: 4394.5, installationNet: 1500 },
    ZBPOWER_16: { priceNet: 5372, installationNet: 1500 },
  },
  installation: {
    pvPerKwNet: 500,
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
    transport: 500,
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

export default function Home() {
  const [clientIdFromUrl, setClientIdFromUrl] = useState("");

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
  const [panelModel, setPanelModel] = useState("AMERISOLAR_450_FB");
  const [panelCount, setPanelCount] = useState(16);
  const [manualPowerKw, setManualPowerKw] = useState("");
  const [panels, setPanels] = useState<CatalogPanel[]>([]);
  const [storages, setStorages] = useState<CatalogStorage[]>([]);
  const [inverters, setInverters] = useState<CatalogInverter[]>([]);
  const [selectedInverterName, setSelectedInverterName] = useState("auto");
  const [roofType, setRoofType] = useState("blacha");
  const [storage, setStorage] = useState("none");
  const [withEms, setWithEms] = useState(false);
  const [includeSubsidy, setIncludeSubsidy] = useState(false);
  const [isUpsell, setIsUpsell] = useState(false);
  const [existingPvPowerKw, setExistingPvPowerKw] = useState("0");
  const [selectedAdditionalServices, setSelectedAdditionalServices] = useState<SelectedAdditionalService[]>([]);
  const [identicalSetCount, setIdenticalSetCount] = useState(1);

  const [billingSystem, setBillingSystem] = useState<
    "net_billing" | "net_metering"
  >("net_billing");
  const [sellerMarkup, setSellerMarkup] = useState(3000);
  const [showSettings, setShowSettings] = useState(false);
  const [vatRate, setVatRate] = useState(8);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const [clientEmail, setClientEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState("");
  const [pricingOverrides, setPricingOverrides] = useState(DEFAULT_PRICING_OVERRIDES);
  const resultSectionRef = useRef<HTMLDivElement | null>(null);

  const currentUserRole = String(userProfile?.role || "seller")
    .trim()
    .toLowerCase();
  const advisorName = userProfile?.display_name || currentUserEmail || "IdeaSol";
  const advisorPhone = userProfile?.phone || "501 000 000";
  const advisorEmail = currentUserEmail || "kontakt@ideasol.pl";
  const canSeeTechnicalView = currentUserRole === "admin" || currentUserRole === "owner";
  const canSeePricingPanel = currentUserRole.includes("admin");

  function getPanelPowerWp(model: string) {
    const selectedPanel = panels.find((panel) => panel.code === model);

    if (selectedPanel) {
      return Number(selectedPanel.power_wp);
    }

    if (model === "HORAY_435_BIFACIAL") return 435;
    return 450;
  }

  function getPanelDisplayName(model: string) {
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
        const profile = data as UserProfile;
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
      const { data, error } = await supabase
        .from("pricing_settings")
        .select("*")
        .maybeSingle();

      if (error) {
        console.warn("Nie udało się załadować pricing_settings — kalkulator użyje wartości domyślnych", error);
        return;
      }

      if (!data) {
        return;
      }

      setPricingOverrides((current) => ({
        ...current,
        installation: {
          ...current.installation,
          pvPerKwNet: Number(data.installation_pv_per_kw ?? current.installation.pvPerKwNet),
        },
        placeholders: {
          ...current.placeholders,
          protections: Number(data.protections_cost ?? current.placeholders.protections),
          wiring: Number(data.wiring_cost ?? current.placeholders.wiring),
          transport: Number(data.transport_cost ?? current.placeholders.transport),
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

          managerFeeNet: Number(
            data.manager_fee_percent ?? current.margins.managerFeeNet
          ),
        },
        operator: {
          ...current.operator,
          percent: Number(data.warranty_percent ?? current.operator.percent),
        },
      }));
    }

    async function loadCrmClients() {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) {
        console.warn("Nie udało się załadować klientów CRM do kalkulatora", error);
        setCrmClients([]);
        return;
      }

      setCrmClients((data || []) as CrmClientOption[]);
    }

    async function loadCatalog() {
      const [panelsResponse, storagesResponse, invertersResponse] = await Promise.all([
        supabase
          .from("panels")
          .select("code, name, display_name, power_wp, price_net")
          .eq("active", true)
          .order("power_wp", { ascending: false }),

        supabase
          .from("storages")
          .select("code, name, display_name, capacity_kwh, price_net, installation_net")
          .eq("active", true)
          .neq("code", "none")
          .order("capacity_kwh", { ascending: true }),

        supabase
          .from("inverters")
          .select("name, display_name, type, max_pv_kw, price_net")
          .eq("active", true)
          .order("max_pv_kw", { ascending: true }),
      ]);

      const loadedPanels = panelsResponse.data || [];
      const loadedStorages = storagesResponse.data || [];
      const loadedInverters = invertersResponse.data || [];

      if (panelsResponse.error || storagesResponse.error || invertersResponse.error) {
        console.warn("Nie udało się załadować pełnego katalogu kalkulatora", {
          panelsError: panelsResponse.error,
          storagesError: storagesResponse.error,
          invertersError: invertersResponse.error,
        });
      }

      setPanels(loadedPanels as CatalogPanel[]);
      setStorages(loadedStorages as CatalogStorage[]);
      setInverters(loadedInverters as CatalogInverter[]);

      if (loadedPanels.length > 0) {
        setPanelModel((current) =>
          loadedPanels.some((panel: CatalogPanel) => panel.code === current)
            ? current
            : loadedPanels[0].code
        );
      }

      if (loadedStorages.length > 0) {
        setStorage((current) =>
          current === "none" ||
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


  function updatePricingValue(path: string[], value: string) {
    const numberValue = Number(value.replace(",", "."));
    const safeValue = Number.isFinite(numberValue) ? numberValue : 0;

    setPricingOverrides((current) => {
      const next = structuredClone(current);
      let target: any = next;

      for (let i = 0; i < path.length - 1; i++) {
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
        protections_cost: pricing.placeholders.protections,
        wiring_cost: pricing.placeholders.wiring,
        transport_cost: pricing.placeholders.transport,
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
  }

  function resetPricingOverrides() {
    setPricingOverrides(DEFAULT_PRICING_OVERRIDES);
    setAdminStatus("Przywrócono wartości domyślne — zapisz, żeby utrwalić w bazie");
    setResult(null);
  }

  async function calculate() {
    const res = await fetch("/api/calculate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        offerType,
        panelModel,
        panelCount,
        roofType,
        storage,
        withEms,
        includeSubsidy,
        isUpsell,
        existingPvPowerKw: isUpsell
          ? Number(String(existingPvPowerKw).replace(",", ".")) || 0
          : 0,
        billingSystem,
        selectedInverterName,
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
      }),
    });

    const data = await res.json();
    setResult(data);
    setCopied(false);
    setEmailStatus("");
    setSaveOfferStatus("");
    setSavedOfferId(null);
    window.setTimeout(() => {
      resultSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }

  function resetForm() {
    setOfferType("none");
    setPanelModel("AMERISOLAR_450_FB");
    setPanelCount(16);
    setManualPowerKw("");
    setRoofType("blacha");
    setStorage("none");
    setWithEms(false);
    setIncludeSubsidy(false);
    setIsUpsell(false);
    setExistingPvPowerKw("0");
    setBillingSystem("net_billing");
    setSelectedInverterName("auto");
    setSelectedAdditionalServices([]);
    setIdenticalSetCount(1);
    const defaultMargin = userProfile?.default_seller_markup;

    if (defaultMargin !== null && defaultMargin !== undefined) {
      const parsedDefaultMargin = Number(defaultMargin);

      if (Number.isFinite(parsedDefaultMargin)) {
        setSellerMarkup(parsedDefaultMargin);
      }
    }
    setVatRate(8);
    setResult(null);
    setCopied(false);
    setClientEmail("");
    setClientName("");
    setSelectedClientId("");
    setSaveOfferStatus("");
    setSavedOfferId(null);
    setEmailStatus("");
    setShowSettings(false);
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

    setSavingOffer(true);
    setSaveOfferStatus("Zapisywanie oferty w CRM...");

    // Use clientEmail from CRM or typed in the input
    const selectedClientForOffer = crmClients.find(
      (client) => client.id === clientIdForSave
    );
    const selectedClientEmailForOffer =
      selectedClientForOffer?.email?.trim() || clientEmail.trim();

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
      subsidy_ems_bonus: result.subsidyAllocation?.emsBonus ?? null,
      subsidy_total: result.subsidyAllocation?.total ?? null,
      pv_power_kw: result.pvPowerKw,
      panel_model: panelModel,
      panel_count: panelCount,
      panel_power_wp: getPanelPowerWp(panelModel),
      inverter: result.inverter,
      energy_storage: result.energyStorage,
      roof_type: roofType,
      offer_data: {
        result,
        contractBreakdown: result.contractBreakdown || null,
        additionalServices: selectedAdditionalServices,
        additional_services: selectedAdditionalServices,
        form: {
          offerType,
          panelModel,
          panelCount,
          manualPowerKw,
          roofType,
          storage,
          withEms,
          includeSubsidy,
          isUpsell,
          existingPvPowerKw: isUpsell ? existingPvPowerKw : "0",
          billingSystem,
          selectedInverterName,
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

    setSaveOfferStatus(
      data?.offer_public_id
        ? `Oferta zapisana w CRM jako ${data.offer_public_id}.`
        : "Oferta zapisana w CRM."
    );
    setSavingOffer(false);
    return data.id;
  }


  function buildOfferText(result: Result) {
    const isStorageOnly = result.offerType === "storage";
    const hasStorage = result.energyStorage !== "Brak";
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
    const storageLine = hasStorage ? `- magazyn energii: ${result.energyStorage}\n` : "";

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

  async function sendOfferEmail(mode: "anonymous" | "public" = "anonymous") {
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
          panelModel,
          panelCount,
          panelPowerWp: getPanelPowerWp(panelModel),
          inverter: result.inverter,
          inverterType: getSelectedInverterType(result.inverter),
          energyStorage: result.energyStorage,
          finalNet: result.finalNet,
          finalGross: result.finalGross,
          vatRate: result.vatRate,
          subsidyAllocation: result.subsidyAllocation || null,
          subsidyTotal: result.subsidyAllocation?.total || 0,
        }),
      });

      if (!res.ok) {
        throw new Error("Nie udało się wysłać maila");
      }

      const mailActivityDescription = [
        `Wysłano ofertę mailową z kalkulatora.`,
        savedOfferId ? `OfferID: ${savedOfferId}` : null,
        `Odbiorca: ${emailForSend}`,
        !selectedClientEmail && typedClientEmail
          ? "E-mail został automatycznie zapisany na karcie klienta."
          : null,
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
      setEmailStatus(
        error instanceof Error ? error.message : "Błąd wysyłki maila"
      );
    } finally {
      setSendingEmail(false);
    }
  }



  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">


        {canSeePricingPanel && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowAdminPanel((current) => !current)}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-blue-500 dark:hover:text-blue-300"
            >
              {showAdminPanel ? "Ukryj panel cen" : "Panel cen admina"}
            </button>
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

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
          <div className="space-y-8">
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
              withEms={withEms}
              setWithEms={setWithEms}
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
              selectedInverterName={selectedInverterName}
              setSelectedInverterName={setSelectedInverterName}
              vatRate={vatRate}
              setVatRate={setVatRate}
              calculate={calculate}
              setResult={setResult}
              setEmailStatus={setEmailStatus}
              showSettings={showSettings}
              setShowSettings={setShowSettings}
              sellerMarkup={sellerMarkup}
              setSellerMarkup={setSellerMarkup}
              selectedAdditionalServices={selectedAdditionalServices}
              setSelectedAdditionalServices={setSelectedAdditionalServices}
            />

            {result && (
              <div
                ref={resultSectionRef}
                className="scroll-mt-6 animate-in fade-in slide-in-from-bottom-3 duration-500"
              >
                <OfferResult
                  result={result}
                  panelCount={panelCount}
                  panelPowerWp={getPanelPowerWp(panelModel)}
                  panelName={getPanelDisplayName(panelModel)}
                  identicalSetCount={identicalSetCount}
                  copied={copied}
                  copyOffer={copyOffer}
                  resetForm={resetForm}
                  setResult={setResult}
                  setCopied={setCopied}
                  setEmailStatus={setEmailStatus}
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
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}