import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { supabase } from "@/lib/supabase";
import {
  CustomInverterFields,
  CustomPanelFields,
  CustomStorageFields,
} from "@/components/calculator/CustomEquipmentFields";
import {
  CUSTOM_INVERTER_CODE,
  CUSTOM_PANEL_CODE,
  CUSTOM_STORAGE_CODE,
  type CustomEquipment,
} from "@/lib/calculator/customEquipment";
import CustomPaymentScheduleFields from "@/components/calculator/CustomPaymentScheduleFields";
import CustomOfferFields from "@/components/calculator/CustomOfferFields";
import type { CustomPaymentSchedule } from "@/lib/customPaymentSchedule";
import {
  getValidCustomOfferItems,
  type CustomOfferItem,
} from "@/lib/calculator/customOffer";
import {
  getExplicitStorageVoltageType,
  rankInvertersForStorage,
} from "@/lib/calculator/equipmentCompatibility";

function isOfferFormOnline() {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

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
  voltage_type?: "low_voltage" | "high_voltage" | null;
  voltageType?: "low_voltage" | "high_voltage" | null;
  price_net: number;
  installation_net: number;
};

type CatalogInverter = {
  name: string;
  display_name: string | null;
  type: string;
  battery_voltage_type?: "low_voltage" | "high_voltage" | null;
  batteryVoltageType?: "low_voltage" | "high_voltage" | null;
  max_pv_kw: number;
  price_net: number;
};

type CatalogAdditionalService = {
  id: number;
  name: string;
  unit_label: string | null;
  price_net: number;
  allows_quantity: boolean;
  active: boolean;
};

type SelectedAdditionalService = {
  id: number;
  name: string;
  unit_label?: string;
  price_net: number;
  allows_quantity: boolean;
  quantity: number;
};

type StorageVoltageFilter = "low_voltage" | "high_voltage";

function getStorageVoltageType(storageItem: CatalogStorage) {
  return getExplicitStorageVoltageType(storageItem);
}

function getStorageVoltageLabel(voltageType: "low_voltage" | "high_voltage" | null) {
  if (!voltageType) return "brak danych o napięciu";
  return voltageType === "high_voltage" ? "wysokonapięciowy" : "niskonapięciowy";
}

type CrmClientOption = {
  id: string;
  public_id: number | null;
  client_type: string | null;
  full_name: string | null;
  company_name: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  contact_phone: string | null;
  city: string | null;
  province: string | null;
};

const CRM_CLIENTS_CACHE_KEY = "ideasol:calculator:crmClients:v1";

type CachedCrmClientsPayload = {
  savedAt: string;
  clients: CrmClientOption[];
};

function readCachedOfferFormClients() {
  if (typeof window === "undefined") return [] as CrmClientOption[];

  try {
    const rawValue = window.localStorage.getItem(CRM_CLIENTS_CACHE_KEY);

    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue) as CachedCrmClientsPayload;

    if (!Array.isArray(parsedValue.clients)) {
      return [];
    }

    return parsedValue.clients;
  } catch {
    return [];
  }
}

function writeCachedOfferFormClients(clients: CrmClientOption[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      CRM_CLIENTS_CACHE_KEY,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        clients,
      })
    );
  } catch {
    // Cache jest tylko dodatkiem do trybu offline, więc błędy ignorujemy.
  }
}


type OfferFormProps = {
  offerType: string;
  setOfferType: (value: string) => void;
  panelModel: string;
  setPanelModel: (value: string) => void;
  panelCount: number;
  setPanelCount: (value: number) => void;
  manualPowerKw: string;
  identicalSetCount?: number;
  setIdenticalSetCount?: (value: number) => void;
  clientName: string;
  setClientName: (value: string) => void;
  setClientEmail?: (value: string) => void;
  crmClients?: CrmClientOption[];
  todayMeetingClients?: CrmClientOption[];
  selectedClientId?: string;
  setSelectedClientId?: (value: string) => void;
  setManualPowerKw: (value: string) => void;
  calculateNearestPanelCount: (value: string, model: string) => void;
  roofType: string;
  setRoofType: (value: string) => void;
  storage: string;
  setStorage: (value: string) => void;
  clientHasOwnHybridInverter: boolean;
  setClientHasOwnHybridInverter: (value: boolean) => void;
  billingSystem: "net_billing" | "net_metering";
  setBillingSystem: (value: "net_billing" | "net_metering") => void;
  includeSubsidy: boolean;
  setIncludeSubsidy: (value: boolean) => void;
  isUpsell: boolean;
  setIsUpsell: (value: boolean) => void;
  existingPvPowerKw: string;
  setExistingPvPowerKw: (value: string) => void;
  storages: CatalogStorage[];
  panels: CatalogPanel[];
  inverters: CatalogInverter[];
  selectedInverterName: string;
  setSelectedInverterName: (value: string) => void;
  vatRate: number;
  setVatRate: (value: number) => void;
  calculate: () => void;
  setResult: (value: any) => void;
  setEmailStatus: (value: string) => void;
  showSettings: boolean;
  setShowSettings: (value: boolean | ((current: boolean) => boolean)) => void;
  sellerMarkup: number;
  setSellerMarkup: (value: number) => void;
  selectedAdditionalServices?: SelectedAdditionalService[];
  setSelectedAdditionalServices?: (value: SelectedAdditionalService[]) => void;
  customModeAvailable?: boolean;
  customMode: boolean;
  setCustomMode: (value: boolean) => void;
  customProductMode: boolean;
  setCustomProductMode: (value: boolean) => void;
  customOfferItems: CustomOfferItem[];
  setCustomOfferItems: Dispatch<SetStateAction<CustomOfferItem[]>>;
  customPaymentTerms: string;
  setCustomPaymentTerms: (value: string) => void;
  customEquipment: CustomEquipment;
  setCustomEquipment: Dispatch<SetStateAction<CustomEquipment>>;
  customPaymentSchedule: CustomPaymentSchedule;
  setCustomPaymentSchedule: Dispatch<SetStateAction<CustomPaymentSchedule>>;
  customPaymentTotalGross: number;
  hasStaleResult?: boolean;
};

export default function OfferForm({
  offerType,
  setOfferType,
  panelModel,
  setPanelModel,
  panelCount,
  setPanelCount,
  manualPowerKw,
  identicalSetCount = 1,
  setIdenticalSetCount = () => { },
  clientName,
  setClientName,
  setClientEmail,
  crmClients = [],
  todayMeetingClients = [],
  selectedClientId = "",
  setSelectedClientId = () => { },
  setManualPowerKw,
  calculateNearestPanelCount,
  roofType,
  setRoofType,
  storage,
  setStorage,
  clientHasOwnHybridInverter,
  setClientHasOwnHybridInverter,
  billingSystem,
  setBillingSystem,
  includeSubsidy,
  setIncludeSubsidy,
  isUpsell,
  setIsUpsell,
  existingPvPowerKw,
  setExistingPvPowerKw,
  storages,
  panels,
  inverters,
  selectedInverterName,
  setSelectedInverterName,
  vatRate,
  setVatRate,
  calculate,
  setResult,
  setEmailStatus,
  showSettings,
  setShowSettings,
  sellerMarkup,
  setSellerMarkup,
  selectedAdditionalServices = [],
  setSelectedAdditionalServices = () => { },
  customModeAvailable = false,
  customMode,
  setCustomMode,
  customProductMode,
  setCustomProductMode,
  customOfferItems,
  setCustomOfferItems,
  customPaymentTerms,
  setCustomPaymentTerms,
  customEquipment,
  setCustomEquipment,
  customPaymentSchedule,
  setCustomPaymentSchedule,
  customPaymentTotalGross,
  hasStaleResult = false,
}: OfferFormProps) {
  const [clientSearch, setClientSearch] = useState("");
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [existingPvAnswer, setExistingPvAnswer] = useState<"yes" | "no" | "">("");

  const [storageVoltageFilter, setStorageVoltageFilter] =
    useState<StorageVoltageFilter>("low_voltage");

  const [additionalServices, setAdditionalServices] = useState<CatalogAdditionalService[]>([]);
  const [showAdditionalServices, setShowAdditionalServices] = useState(false);
  const [additionalServicesStatus, setAdditionalServicesStatus] = useState("");
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [activeWorkspaceStep, setActiveWorkspaceStep] = useState<
    "client" | "equipment" | "extras" | "settlement"
  >("client");
  const [activeEquipmentEditor, setActiveEquipmentEditor] = useState<
    "pv" | "storage" | "inverter"
  >("pv");
  useEffect(() => {
    async function loadAdditionalServices() {
      if (!isOfferFormOnline()) {
        setAdditionalServicesStatus("");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("additional_services")
          .select("id, name, unit_label, price_net, allows_quantity, active")
          .eq("active", true)
          .order("name", { ascending: true });

        if (error) {
          setAdditionalServicesStatus("");
          return;
        }

        setAdditionalServices((data || []) as CatalogAdditionalService[]);
        setAdditionalServicesStatus("");
      } catch {
        setAdditionalServicesStatus("");
      }
    }

    loadAdditionalServices();
  }, []);

  const [internalCrmClients, setInternalCrmClients] = useState<CrmClientOption[]>([]);
  const [internalTodayMeetingClients, setInternalTodayMeetingClients] = useState<CrmClientOption[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);

  useEffect(() => {
    async function loadClientsIfNeeded() {
      const cachedClients = readCachedOfferFormClients();

      if (cachedClients.length > 0 && internalCrmClients.length === 0) {
        setInternalCrmClients(cachedClients);
      }

      if (crmClients.length > 0 || internalCrmClients.length > 0) return;

      if (!isOfferFormOnline()) {
        return;
      }

      setIsLoadingClients(true);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.warn("OfferForm: nie udało się załadować profilu, używam roli seller", profileError);
        }

        const role = profile?.role || "seller";

        const baseClientsSelect =
          "id, public_id, client_type, full_name, company_name, contact_person, email, phone, contact_phone, city, province";

        const buildClientsQuery = () =>
          supabase
            .from("clients")
            .select(baseClientsSelect)
            .order("created_at", { ascending: false })
            .limit(300);

        let clientsData: CrmClientOption[] | null = null;
        let clientsError: unknown = null;

        if (role === "seller") {
          const assignedClientsResult = await buildClientsQuery().eq(
            "assigned_user_id",
            user.id
          );

          clientsData = (assignedClientsResult.data || []) as CrmClientOption[];
          clientsError = assignedClientsResult.error;

          if (clientsError) {
            console.warn(
              "OfferForm: nie udało się pobrać klientów po assigned_user_id, próbuję pobrać klientów dostępnych przez RLS",
              clientsError
            );

            const fallbackClientsResult = await buildClientsQuery();
            clientsData = (fallbackClientsResult.data || []) as CrmClientOption[];
            clientsError = fallbackClientsResult.error;
          }
        } else {
          const clientsResult = await buildClientsQuery();
          clientsData = (clientsResult.data || []) as CrmClientOption[];
          clientsError = clientsResult.error;
        }

        if (clientsError) {
          setInternalCrmClients([]);
          setInternalTodayMeetingClients([]);
          return;
        }

        const loadedClients = clientsData || [];
        setInternalCrmClients(loadedClients);
        writeCachedOfferFormClients(loadedClients);

        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date(start);
        end.setDate(end.getDate() + 1);

        const { data: eventsData, error: eventsError } = await supabase
          .from("calendar_events")
          .select("client_id")
          .eq("event_type", "meeting")
          .gte("event_at", start.toISOString())
          .lt("event_at", end.toISOString())
          .not("client_id", "is", null);

        if (eventsError) {
          console.warn("OfferForm: nie udało się załadować dzisiejszych spotkań", eventsError);
          setInternalTodayMeetingClients([]);
          return;
        }

        const meetingClientIds = Array.from(
          new Set((eventsData || []).map((event: { client_id: string | null }) => event.client_id).filter(Boolean))
        );

        setInternalTodayMeetingClients(
          loadedClients.filter((client) => meetingClientIds.includes(client.id))
        );
      } finally {
        setIsLoadingClients(false);
      }
    }

    loadClientsIfNeeded();
  }, [crmClients.length, internalCrmClients.length]);

  function getClientDisplayName(client: CrmClientOption) {
    return (
      client.company_name ||
      client.full_name ||
      client.contact_person ||
      "Klient bez nazwy"
    );
  }

  function getClientSearchText(client: CrmClientOption) {
    return [
      client.public_id ? String(client.public_id) : "",
      client.public_id ? `lead${client.public_id}` : "",
      client.public_id ? `leadid${client.public_id}` : "",
      client.company_name || "",
      client.full_name || "",
      client.contact_person || "",
      client.email || "",
      client.phone || "",
      client.contact_phone || "",
      client.city || "",
      client.province || "",
    ]
      .join(" ")
      .toLowerCase();
  }

  const safeCrmClients =
    Array.isArray(crmClients) && crmClients.length > 0
      ? crmClients
      : internalCrmClients;

  const safeTodayMeetingClients =
    Array.isArray(todayMeetingClients) && todayMeetingClients.length > 0
      ? todayMeetingClients
      : internalTodayMeetingClients;

  const selectedClient = useMemo(
    () => safeCrmClients.find((client) => client.id === selectedClientId) || null,
    [safeCrmClients, selectedClientId]
  );

  useEffect(() => {
    if (!setClientEmail) return;

    if (!selectedClientId) {
      setClientEmail("");
      return;
    }

    setClientEmail(selectedClient?.email?.trim() || "");
  }, [selectedClientId, selectedClient?.email, setClientEmail]);

  const clientSuggestions = useMemo(() => {
    const normalizedSearch = clientSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return safeTodayMeetingClients.slice(0, 8);
    }

    return safeCrmClients
      .filter((client) => getClientSearchText(client).includes(normalizedSearch))
      .slice(0, 12);
  }, [clientSearch, safeCrmClients, safeTodayMeetingClients]);

  function selectCrmClient(client: CrmClientOption) {
    const clientEmail = client.email?.trim() || "";

    setSelectedClientId(client.id);
    setClientName(getClientDisplayName(client));
    setClientEmail?.(clientEmail);
    setClientSearch("");
    setIsClientDropdownOpen(false);
    setResult(null);
    setEmailStatus(
      clientEmail
        ? ""
        : "Wybrany klient nie ma adresu e-mail na karcie CRM. Możesz wpisać go ręcznie przy wysyłce oferty — zostanie zapisany na karcie klienta."
    );
  }

  function isAdditionalServiceSelected(serviceId: number) {
    return selectedAdditionalServices.some((service) => service.id === serviceId);
  }

  function toggleAdditionalService(service: CatalogAdditionalService) {
    if (isAdditionalServiceSelected(service.id)) {
      setSelectedAdditionalServices(
        selectedAdditionalServices.filter((item) => item.id !== service.id)
      );
      setResult(null);
      return;
    }

    setSelectedAdditionalServices([
      ...selectedAdditionalServices,
      {
        id: service.id,
        name: service.name,
        unit_label: service.unit_label?.trim() || "szt.",
        price_net: Number(service.price_net || 0),
        allows_quantity: Boolean(service.allows_quantity),
        quantity: 1,
      },
    ]);
    setResult(null);
  }

  function updateAdditionalServiceQuantity(serviceId: number, quantity: number) {
    const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;

    setSelectedAdditionalServices(
      selectedAdditionalServices.map((service) =>
        service.id === serviceId
          ? {
            ...service,
            quantity: safeQuantity,
          }
          : service
      )
    );
    setResult(null);
  }

  const panelsToShow = panels;
  const hasPvSelected = offerType === "pv" || offerType === "pv_storage";
  const hasStorageSelected = offerType === "storage" || offerType === "pv_storage";

  const storagesToShow = useMemo(() => {
    return storages.filter(
      (storageItem) => getStorageVoltageType(storageItem) === storageVoltageFilter
    );
  }, [storages, storageVoltageFilter]);

  const selectedStorageItem = useMemo(
    () => storages.find((storageItem) => storageItem.code === storage) || null,
    [storage, storages]
  );

  const selectedStorageVoltageType = useMemo<StorageVoltageFilter | null>(() => {
    if (customMode) return customEquipment.storage.voltageType;

    return selectedStorageItem
      ? getStorageVoltageType(selectedStorageItem)
      : storageVoltageFilter;
  }, [customEquipment.storage.voltageType, customMode, selectedStorageItem, storageVoltageFilter]);

  const invertersToShow = useMemo(() => {
    if (!hasStorageSelected || !selectedStorageItem) return inverters;
    return rankInvertersForStorage(inverters, selectedStorageItem);
  }, [hasStorageSelected, inverters, selectedStorageItem]);

  const existingPvPowerNumber = Number(String(existingPvPowerKw || "0").replace(",", "."));
  const canConfigureOffer =
    customProductMode || existingPvAnswer === "no" ||
    (existingPvAnswer === "yes" && Number.isFinite(existingPvPowerNumber) && existingPvPowerNumber > 0);
  const hasValidCustomOfferItems = getValidCustomOfferItems(customOfferItems).length > 0;
  useEffect(() => {
    if (customMode) return;
    if (!hasStorageSelected) return;
    if (storage === "none") return;
    if (storagesToShow.length === 0) return;

    const selectedStorageIsVisible = storagesToShow.some(
      (storageItem) => storageItem.code === storage
    );

    if (!selectedStorageIsVisible) {
      setStorage(storagesToShow[0].code);
      setSelectedInverterName("auto");
      setResult(null);
    }
  }, [
    hasStorageSelected,
    customMode,
    setResult,
    setSelectedInverterName,
    setStorage,
    storage,
    storagesToShow,
  ]);

  function invalidateCalculation() {
    setResult(null);
    setEmailStatus("");
  }

  function changeCustomMode(enabled: boolean) {
    setCustomMode(enabled);
    if (enabled) setCustomProductMode(false);
    invalidateCalculation();

    if (enabled) {
      setPanelModel(CUSTOM_PANEL_CODE);
      setStorage(hasStorageSelected ? CUSTOM_STORAGE_CODE : "none");
      setSelectedInverterName(CUSTOM_INVERTER_CODE);
      setCustomEquipment((current) => ({
        ...current,
        inverter: {
          ...current.inverter,
          type: hasStorageSelected ? "hybrid" : "ongrid",
          batteryVoltageType: hasStorageSelected
            ? current.storage.voltageType
            : current.inverter.batteryVoltageType,
        },
      }));
      return;
    }

    setPanelModel(panels[0]?.code || "");
    setStorage(hasStorageSelected ? storagesToShow[0]?.code || "none" : "none");
    setSelectedInverterName("auto");
  }

  function changeCustomProductMode(enabled: boolean) {
    setCustomProductMode(enabled);
    setCustomMode(false);
    invalidateCalculation();
    setActiveWorkspaceStep("equipment");

    if (enabled) {
      setOfferType("custom");
      setStorage("none");
      setSelectedInverterName("auto");
      setIncludeSubsidy(false);
      setClientHasOwnHybridInverter(false);
      return;
    }

    setOfferType("none");
  }

  function updateOfferModules(nextHasPv: boolean, nextHasStorage: boolean) {
    if (!nextHasPv && !nextHasStorage) {
      setOfferType("none");
      setStorage("none");
      setClientHasOwnHybridInverter(false);
      setIncludeSubsidy(false);
      setIsUpsell(false);
      setExistingPvPowerKw("0");
      setSelectedInverterName(customMode ? CUSTOM_INVERTER_CODE : "auto");
      setResult(null);
      setEmailStatus("");
      return;
    }

    const nextOfferType = nextHasPv && nextHasStorage
      ? "pv_storage"
      : nextHasPv
        ? "pv"
        : "storage";

    setOfferType(nextOfferType);
    setResult(null);
    setEmailStatus("");

    if (nextOfferType === "pv") {
      setStorage("none");
      setClientHasOwnHybridInverter(false);
      setIncludeSubsidy(false);
    }

    if (nextOfferType === "pv_storage") {
      setIncludeSubsidy(true);
      if (storage === "none") {
        setStorage(customMode ? CUSTOM_STORAGE_CODE : storagesToShow[0]?.code || "none");
      }
    }

    if (nextOfferType === "storage") {
      setIncludeSubsidy(true);
      if (storage === "none") {
        setStorage(customMode ? CUSTOM_STORAGE_CODE : storagesToShow[0]?.code || "none");
      }
    }

    if (customMode) {
      setCustomEquipment((current) => ({
        ...current,
        inverter: {
          ...current.inverter,
          type: nextHasStorage ? "hybrid" : "ongrid",
          batteryVoltageType: nextHasStorage
            ? current.storage.voltageType
            : current.inverter.batteryVoltageType,
        },
      }));
      setPanelModel(CUSTOM_PANEL_CODE);
      setStorage(nextHasStorage ? CUSTOM_STORAGE_CODE : "none");
      setSelectedInverterName(CUSTOM_INVERTER_CODE);
    } else {
      setSelectedInverterName("auto");
    }
  }

  const standardWorkspaceSteps = [
    {
      id: "client" as const,
      number: "01",
      label: "Klient",
      description: selectedClient ? getClientDisplayName(selectedClient) : clientName || "Dane i obecna PV",
    },
    {
      id: "equipment" as const,
      number: "02",
      label: "Instalacja",
      description: hasPvSelected && hasStorageSelected
        ? "PV + magazyn"
        : hasPvSelected
          ? "Fotowoltaika"
          : hasStorageSelected
            ? "Magazyn energii"
            : "Dobór urządzeń",
    },
    {
      id: "extras" as const,
      number: "03",
      label: "Dodatki",
      description: selectedAdditionalServices.length > 0
        ? `${selectedAdditionalServices.length} wybrane`
        : "Usługi i opcje",
    },
    {
      id: "settlement" as const,
      number: "04",
      label: "Rozliczenie",
      description: `VAT ${vatRate}% · ${billingSystem === "net_billing" ? "Net Billing" : "Net Metering"}`,
    },
  ];
  const workspaceSteps = customProductMode
    ? [
        {
          id: "client" as const,
          number: "01",
          label: "Klient",
          description: selectedClient ? getClientDisplayName(selectedClient) : clientName || "Wybierz odbiorcę",
        },
        {
          id: "equipment" as const,
          number: "02",
          label: "Pozycje",
          description: `${getValidCustomOfferItems(customOfferItems).length} uzupełnionych`,
        },
        {
          id: "settlement" as const,
          number: "03",
          label: "Rozliczenie",
          description: `VAT ${vatRate}%`,
        },
      ]
    : standardWorkspaceSteps;
  const activeWorkspaceStepIndex = workspaceSteps.findIndex((step) => step.id === activeWorkspaceStep);
  const activeWorkspaceStepData = workspaceSteps[activeWorkspaceStepIndex];
  const equipmentEditors = customProductMode ? [] : [
    ...(hasPvSelected ? [{ id: "pv" as const, label: "PV" }] : []),
    ...(hasStorageSelected ? [{ id: "storage" as const, label: "magazyn" }] : []),
    ...((hasPvSelected || hasStorageSelected) ? [{ id: "inverter" as const, label: "falownik" }] : []),
  ];
  const activeEquipmentEditorIndex = equipmentEditors.findIndex(
    (editor) => editor.id === activeEquipmentEditor
  );
  const previousEquipmentEditor = activeEquipmentEditorIndex > 0
    ? equipmentEditors[activeEquipmentEditorIndex - 1]
    : null;
  const nextEquipmentEditor = activeEquipmentEditorIndex >= 0 && activeEquipmentEditorIndex < equipmentEditors.length - 1
    ? equipmentEditors[activeEquipmentEditorIndex + 1]
    : null;

  function goToPreviousWorkspaceSection() {
    if (activeWorkspaceStep === "equipment" && previousEquipmentEditor) {
      setActiveEquipmentEditor(previousEquipmentEditor.id);
      return;
    }

    setActiveWorkspaceStep(workspaceSteps[Math.max(0, activeWorkspaceStepIndex - 1)].id);
  }

  function goToNextWorkspaceSection() {
    if (activeWorkspaceStep === "equipment" && nextEquipmentEditor) {
      setActiveEquipmentEditor(nextEquipmentEditor.id);
      return;
    }

    setActiveWorkspaceStep(workspaceSteps[Math.min(workspaceSteps.length - 1, activeWorkspaceStepIndex + 1)].id);
  }

  const nextSectionLabel = activeWorkspaceStep === "equipment"
    ? nextEquipmentEditor?.label || (customProductMode ? "rozliczenie" : "dodatki")
    : workspaceSteps[Math.min(workspaceSteps.length - 1, activeWorkspaceStepIndex + 1)].label.toLocaleLowerCase("pl-PL");
  const previousSectionLabel = activeWorkspaceStep === "equipment" && previousEquipmentEditor
    ? previousEquipmentEditor.label
    : null;

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl shadow-slate-200/60 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/30">
      <div className="relative flex items-center justify-between gap-4 bg-slate-950 px-5 py-4 text-white dark:bg-black">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-400">IdeaSol Configurator</p>
          <h2 className="mt-1 text-xl font-black tracking-tight">
            {customProductMode ? "Zbuduj ofertę niestandardową" : "Zbuduj wariant instalacji"}
          </h2>
        </div>

        {!customProductMode ? <button
          type="button"
          onClick={() => setShowSettings((current) => !current)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-lg transition hover:bg-white/20"
          aria-label="Ustawienia kalkulatora"
        >
          ⚙
        </button> : null}

        {showSettings && !customProductMode && (
          <div className="absolute right-4 top-[calc(100%+0.75rem)] z-40 w-[calc(100%-2rem)] rounded-2xl border border-blue-100 bg-white p-4 text-slate-900 shadow-xl shadow-slate-950/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:w-72">
            <label className="block">
              <span className="text-sm text-slate-700 dark:text-slate-200">
                Narzut handlowca netto
              </span>

              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:shadow-none dark:focus:border-blue-500 dark:focus:bg-slate-950 dark:focus:ring-blue-500/20"
                type="number"
                min="0"
                value={sellerMarkup}
                onChange={(e) => {
                  setSellerMarkup(Number(e.target.value));
                  setResult(null);
                }}
              />
            </label>

            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
              To ustawienie jest ukryte z głównego formularza, ale nadal wpływa na cenę oferty.
            </p>

            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="mt-4 w-full rounded-2xl bg-emerald-600 p-3 font-bold text-white shadow-md shadow-emerald-100 transition hover:bg-emerald-500 dark:shadow-black/30"
            >
              ✓ Zapisz
            </button>
          </div>
        )}
      </div>
      <div className="grid xl:grid-cols-[190px_minmax(0,1fr)]">
        <nav className="border-b border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950 xl:border-b-0 xl:border-r">
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
            {workspaceSteps.map((step, index) => {
              const isActive = activeWorkspaceStep === step.id;
              const isVisited = index < activeWorkspaceStepIndex;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveWorkspaceStep(step.id)}
                  className={`group rounded-2xl p-3 text-left transition ${isActive
                    ? "bg-slate-950 text-white shadow-lg shadow-slate-300 dark:bg-white dark:text-slate-950 dark:shadow-none"
                    : "text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black ${isActive
                      ? "bg-emerald-400 text-slate-950"
                      : isVisited
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-slate-200 text-slate-500 dark:bg-slate-800"
                      }`}>
                      {isVisited ? "✓" : step.number}
                    </span>
                    <span className="text-sm font-bold">{step.label}</span>
                  </div>
                  <p className={`mt-2 truncate text-[11px] ${isActive ? "text-slate-300 dark:text-slate-600" : "text-slate-400"}`}>
                    {step.description}
                  </p>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0 p-4 sm:p-5">
          <div className="mb-5 flex items-end justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Etap {activeWorkspaceStepData.number}</p>
              <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white">{activeWorkspaceStepData.label}</h3>
            </div>
            <span className="hidden rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400 sm:block">
              {activeWorkspaceStepIndex + 1} / {workspaceSteps.length}
            </span>
          </div>
      {/* CRM CLIENT SELECTOR */}
      <div className={`relative mb-4 min-w-0 border-b border-slate-200 pb-5 dark:border-slate-700 ${activeWorkspaceStep === "client" ? "" : "hidden"}`}>
        <label className="block">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-black uppercase tracking-[0.16em] text-slate-600 dark:text-slate-300">
            Klient CRM
            <span className="normal-case tracking-normal text-slate-500 dark:text-slate-400">wymagany do wysyłki maila</span>
          </span>

          <input
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:shadow-none dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:bg-slate-950 dark:focus:ring-blue-500/20"
            type="text"
            placeholder="Kliknij, aby zobaczyć dzisiejsze spotkania albo wyszukaj klienta"
            value={
              isClientDropdownOpen
                ? clientSearch
                : selectedClient
                  ? getClientDisplayName(selectedClient)
                  : clientName
            }
            onFocus={() => {
              setIsClientDropdownOpen(true);
              setClientSearch("");
            }}
            onChange={(e) => {
              const value = e.target.value;

              setClientSearch(value);
              setClientName(value);
              setSelectedClientId("");
              setClientEmail?.("");
              setIsClientDropdownOpen(true);
              setResult(null);
              setEmailStatus(
                value.trim()
                  ? "Ręcznie wpisany klient nie jest powiązany z CRM. Wysyłka maila będzie zablokowana do czasu wyboru klienta z CRM."
                  : ""
              );
            }}
          />
        </label>

        {isClientDropdownOpen && (
          <div className="absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40">
            <div className="mb-2 flex items-center justify-between px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
              <span>
                {isLoadingClients
                  ? "Ładowanie klientów..."
                  : clientSearch.trim()
                    ? "Wyniki wyszukiwania"
                    : "Klienci ze spotkaniami na dziś"}
              </span>
              <button
                type="button"
                onClick={() => setIsClientDropdownOpen(false)}
                className="text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
              >
                Zamknij
              </button>
            </div>

            {clientSuggestions.length > 0 ? (
              <div className="space-y-2">
                {clientSuggestions.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => selectCrmClient(client)}
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-500/50 dark:hover:bg-slate-800"
                  >
                    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0">
                        <div className="break-words font-semibold text-slate-950 dark:text-slate-100">
                          {getClientDisplayName(client)}
                        </div>
                        <div className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">
                          {[client.phone || client.contact_phone, client.email, client.city]
                            .filter(Boolean)
                            .join(" • ") || "Brak danych kontaktowych"}
                        </div>
                        {!client.email && (
                          <div className="mt-1 text-xs font-semibold text-amber-600 dark:text-amber-300">
                            Brak e-maila — będzie można wpisać go ręcznie przy wysyłce oferty
                          </div>
                        )}
                      </div>

                      {client.public_id && (
                        <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-semibold text-blue-600 ring-1 ring-blue-100 dark:bg-slate-950 dark:text-blue-300 dark:ring-blue-500/40">
                          LeadID {client.public_id}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                {isLoadingClients
                  ? "Pobieram klientów z CRM..."
                  : clientSearch.trim()
                    ? "Brak wyników. Możesz wpisać klienta ręcznie."
                    : "Brak klientów ze spotkaniami na dziś. Zacznij pisać, aby wyszukać innego klienta."}
              </div>
            )}
          </div>
        )}

        {selectedClient && (
          <div className="mt-3 space-y-2 border-l-2 border-emerald-400 pl-3 text-sm text-slate-700 dark:text-slate-200">
            <div>
              Wybrany klient CRM: <strong>{getClientDisplayName(selectedClient)}</strong>
              {selectedClient.public_id ? ` • LeadID ${selectedClient.public_id}` : ""}
            </div>

            {selectedClient.email ? (
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-200">
                E-mail do wysyłki: {selectedClient.email}
              </div>
            ) : (
              <div className="text-xs font-semibold text-amber-700 dark:text-amber-200">
                Brak e-maila na karcie klienta — wpiszesz go przy wysyłce oferty, a system zapisze go automatycznie w CRM.
              </div>
            )}
          </div>
        )}
      </div>

      {!customProductMode ? <div className={`mb-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 ${activeWorkspaceStep === "client" ? "" : "hidden"}`}>
        <div className="grid gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-800 dark:text-slate-100">
              Stan obecny: czy klient posiada fotowoltaikę?
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              To pole wpływa na warunek dotacji PME: pojemność magazynu musi wynosić minimum dwukrotność łącznej mocy PV klienta.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setExistingPvAnswer("yes");
                setIsUpsell(true);
                setResult(null);
                setEmailStatus("");
              }}
              className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${existingPvAnswer === "yes"
                  ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                }`}
            >
              TAK
            </button>

            <button
              type="button"
              onClick={() => {
                setExistingPvAnswer("no");
                setIsUpsell(false);
                setExistingPvPowerKw("0");
                setResult(null);
                setEmailStatus("");
              }}
              className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${existingPvAnswer === "no"
                  ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                }`}
            >
              NIE
            </button>
          </div>
        </div>

        {existingPvAnswer === "yes" && (
          <label className="mt-4 block max-w-md">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Moc obecnej instalacji PV klienta</span>
            <input
              className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-slate-900 shadow-inner shadow-emerald-100/40 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-emerald-500/40 dark:bg-slate-950 dark:text-slate-100 dark:shadow-none dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
              type="text"
              inputMode="decimal"
              placeholder="np. 6,44"
              value={existingPvPowerKw === "0" ? "" : existingPvPowerKw}
              onChange={(e) => {
                setExistingPvPowerKw(e.target.value);
                setIsUpsell(true);
                setResult(null);
                setEmailStatus("");
              }}
            />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Po wpisaniu mocy odblokujemy wybór PV / ME w kalkulatorze.
            </p>
          </label>
        )}

      </div> : null}

      {customModeAvailable ? (
        <div className={`mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950 sm:grid-cols-2 ${activeWorkspaceStep === "equipment" ? "" : "hidden"}`}>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={customMode}
              onChange={(event) => changeCustomMode(event.target.checked)}
              className="mt-1 h-5 w-5 accent-emerald-500"
            />
            <div>
              <div className="font-bold text-slate-900 dark:text-slate-100">Sprzęt niestandardowy</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Wpisujesz sprzęt jednorazowo. Nie zostanie dodany do katalogu i nie będzie widoczny dla innych użytkowników.
              </p>
            </div>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-violet-200 bg-white p-3 dark:border-violet-500/30 dark:bg-slate-900">
            <input
              type="checkbox"
              checked={customProductMode}
              onChange={(event) => changeCustomProductMode(event.target.checked)}
              className="mt-1 h-5 w-5 accent-violet-600"
            />
            <div>
              <div className="font-bold text-slate-900 dark:text-slate-100">Dowolne produkty</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Prosta oferta z własnymi nazwami, ilością i ceną netto, generowana na szablonie IdeaSol.
              </p>
            </div>
          </label>
        </div>
      ) : null}

      {customProductMode && activeWorkspaceStep === "equipment" ? (
        <CustomOfferFields
          items={customOfferItems}
          onChange={setCustomOfferItems}
          onInvalidate={invalidateCalculation}
        />
      ) : null}

      {/* MODULE/PRODUCT SECTION */}
      <div className={`mb-4 transition ${activeWorkspaceStep === "equipment" && !customProductMode ? "" : "hidden"} ${canConfigureOffer ? "" : "pointer-events-none opacity-45 grayscale"}`}>
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-950">
          <button
            type="button"
            onClick={() => {
              const nextValue = !hasPvSelected;
              updateOfferModules(nextValue, hasStorageSelected);
              setActiveEquipmentEditor(nextValue ? "pv" : hasStorageSelected ? "storage" : "pv");
            }}
            className={`rounded-xl px-3 py-3 text-left transition ${hasPvSelected ? "bg-white shadow-sm dark:bg-slate-800" : "text-slate-500"}`}
          >
            <span className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Moduł</span>
            <span className="mt-1 flex items-center justify-between text-sm font-bold text-slate-900 dark:text-white">
              Fotowoltaika <span>{hasPvSelected ? "✓" : "+"}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              const nextValue = !hasStorageSelected;
              updateOfferModules(hasPvSelected, nextValue);
              setActiveEquipmentEditor(nextValue ? "storage" : hasPvSelected ? "pv" : "storage");
            }}
            className={`rounded-xl px-3 py-3 text-left transition ${hasStorageSelected ? "bg-white shadow-sm dark:bg-slate-800" : "text-slate-500"}`}
          >
            <span className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Moduł</span>
            <span className="mt-1 flex items-center justify-between text-sm font-bold text-slate-900 dark:text-white">
              Magazyn energii <span>{hasStorageSelected ? "✓" : "+"}</span>
            </span>
          </button>
        </div>

        {(hasPvSelected || hasStorageSelected) && (
          <div className="mb-4 flex gap-1 border-b border-slate-200 dark:border-slate-700">
            {[
              ...(hasPvSelected ? [{ value: "pv" as const, label: "PV" }] : []),
              ...(hasStorageSelected ? [{ value: "storage" as const, label: "Magazyn" }] : []),
              { value: "inverter" as const, label: "Falownik" },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveEquipmentEditor(tab.value)}
                className={`border-b-2 px-3 py-2 text-xs font-bold transition ${activeEquipmentEditor === tab.value
                  ? "border-slate-950 text-slate-950 dark:border-white dark:text-white"
                  : "border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div
            className={`rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 ${hasPvSelected && activeEquipmentEditor === "pv" ? "" : "hidden"}`}
          >
            {hasPvSelected && (
              <div className="grid gap-4 sm:grid-cols-3">
                {customMode ? (
                  <CustomPanelFields
                    value={customEquipment.panel}
                    onChange={(panel) => setCustomEquipment((current) => ({ ...current, panel }))}
                    onInvalidate={invalidateCalculation}
                  />
                ) : (
                  <label className="block">
                    <span className="text-sm text-slate-700 dark:text-slate-200">Model panelu</span>

                    <select
                      className="mt-2 h-[50px] w-full rounded-[18px] border border-slate-200 bg-white px-4 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:shadow-none dark:focus:border-blue-500 dark:focus:bg-slate-950 dark:focus:ring-blue-500/20"
                      value={panelModel}
                      onChange={(e) => {
                        const nextPanelModel = e.target.value;

                        setPanelModel(nextPanelModel);
                        setSelectedInverterName("auto");
                        calculateNearestPanelCount(manualPowerKw, nextPanelModel);
                        setResult(null);
                      }}
                    >
                      {panelsToShow.map((panel) => (
                        <option key={panel.code} value={panel.code}>
                          {panel.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="block">
                  <span className="text-sm text-slate-700 dark:text-slate-200">Moc instalacji</span>

                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:shadow-none dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:bg-slate-950 dark:focus:ring-blue-500/20"
                    type="text"
                    inputMode="decimal"
                    placeholder="np. 10"
                    value={manualPowerKw}
                    onChange={(e) => {
                      const nextManualPowerKw = e.target.value;

                      setManualPowerKw(nextManualPowerKw);
                      setSelectedInverterName("auto");
                      calculateNearestPanelCount(nextManualPowerKw, panelModel);
                      setResult(null);
                    }}
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-slate-700 dark:text-slate-200">Liczba paneli</span>

                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:shadow-none dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:bg-slate-950 dark:focus:ring-blue-500/20"
                    type="number"
                    min="1"
                    value={panelCount}
                    onChange={(e) => {
                      setPanelCount(Number(e.target.value));
                      setSelectedInverterName("auto");
                      setManualPowerKw("");
                      setResult(null);
                    }}
                  />
                </label>

                <div className="block sm:col-span-3">
                  <span className="text-sm text-slate-700 dark:text-slate-200">Rodzaj montażu</span>

                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { value: "blacha", label: "Blacha" },
                      { value: "dachowka", label: "Dachówka" },
                      { value: "papa", label: "Papa" },
                      { value: "grunt", label: "Grunt" },
                    ].map((option) => (
                      <label
                        key={option.value}
                        className={`cursor-pointer rounded-xl border px-3 py-2.5 transition ${roofType === option.value
                            ? "border-slate-950 bg-slate-100 dark:border-white dark:bg-slate-800"
                            : "border-slate-200 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="roofType"
                            checked={roofType === option.value}
                            onChange={() => {
                              setRoofType(option.value);
                              setResult(null);
                            }}
                            className="h-4 w-4"
                          />

                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {option.label}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div
            className={`rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 ${hasStorageSelected && activeEquipmentEditor === "storage" ? "" : "hidden"}`}
          >
            {hasStorageSelected && (
              <div className="grid gap-4">
                {customMode ? (
                  <CustomStorageFields
                    value={customEquipment.storage}
                    onChange={(nextStorage) => {
                      setCustomEquipment((current) => ({
                        ...current,
                        storage: nextStorage,
                        inverter: {
                          ...current.inverter,
                          batteryVoltageType: nextStorage.voltageType,
                          type: "hybrid",
                        },
                      }));
                    }}
                    onInvalidate={invalidateCalculation}
                  />
                ) : (
                  <>
                    <div>
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Typ magazynu energii
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {[
                          { value: "low_voltage", label: "LV - niskonapięciowe" },
                          { value: "high_voltage", label: "HV - wysokonapięciowe" },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setStorageVoltageFilter(option.value as StorageVoltageFilter);
                              setResult(null);
                            }}
                            className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${storageVoltageFilter === option.value
                                ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                              }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="block">
                      <span className="text-sm text-slate-700 dark:text-slate-200">
                        Model magazynu energii
                      </span>

                      <select
                        className="mt-2 h-[50px] w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:ring-blue-500/20"
                        value={storage}
                        onChange={(e) => {
                          setStorage(e.target.value);
                          setSelectedInverterName("auto");
                          setResult(null);
                        }}
                      >
                        {storagesToShow.map((storageItem) => (
                          <option key={storageItem.code} value={storageItem.code}>
                            {storageItem.name} ({getStorageVoltageLabel(getStorageVoltageType(storageItem))})
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {(hasPvSelected || hasStorageSelected) && (
        <div className={`mb-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 ${activeWorkspaceStep === "equipment" && activeEquipmentEditor === "inverter" ? "" : "hidden"}`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-slate-900 dark:text-slate-100">Falownik</span>
            {hasStorageSelected && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Zgodne modele {selectedStorageVoltageType === "high_voltage" ? "HV" : selectedStorageVoltageType === "low_voltage" ? "LV" : "—"}
              </span>
            )}
          </div>

          {hasStorageSelected && (
            <label className="mb-3 flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950">
              <input
                type="checkbox"
                checked={clientHasOwnHybridInverter}
                onChange={(event) => {
                  setClientHasOwnHybridInverter(event.target.checked);
                  setSelectedInverterName("auto");
                  setResult(null);
                }}
                className="h-4 w-4 accent-blue-600"
              />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Klient posiada własny falownik hybrydowy
              </span>
            </label>
          )}

          {!clientHasOwnHybridInverter && (
            customMode ? (
              <CustomInverterFields
                value={customEquipment.inverter}
                onChange={(inverter) => setCustomEquipment((current) => ({ ...current, inverter }))}
                onInvalidate={invalidateCalculation}
              />
            ) : (
              <label className="block">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Model falownika</span>
                <select
                  className="mt-1.5 h-[46px] w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:ring-blue-500/20"
                  value={selectedInverterName}
                  onChange={(event) => {
                    setSelectedInverterName(event.target.value);
                    setResult(null);
                  }}
                >
                  <option value="auto">
                    {hasStorageSelected
                      ? "Automatycznie dobierz zgodny zestaw"
                      : "Automatycznie dobierz falownik sieciowy pod moc instalacji"}
                  </option>
                  {invertersToShow
                    .filter((inverterItem) => {
                      if (hasStorageSelected) {
                        const inverterVoltageType =
                          inverterItem.battery_voltage_type || inverterItem.batteryVoltageType;
                        return inverterItem.type === "hybrid" &&
                          Boolean(inverterVoltageType) &&
                          inverterVoltageType === selectedStorageVoltageType;
                      }
                      return inverterItem.type !== "hybrid";
                    })
                    .map((inverterItem, index) => (
                      <option key={`${inverterItem.name}-${inverterItem.type}-${index}`} value={inverterItem.name}>
                        {inverterItem.type === "hybrid" ? "Hybrydowy" : "Sieciowy"} — {inverterItem.display_name || inverterItem.name} — do {Number(inverterItem.max_pv_kw).toLocaleString("pl-PL")} kWp
                      </option>
                    ))}
                </select>
              </label>
            )
          )}
        </div>
      )}
      <div className={`mb-4 grid gap-3 sm:grid-cols-2 ${activeWorkspaceStep === "extras" && !customProductMode ? "" : "hidden"}`}>
      {(hasPvSelected || hasStorageSelected) && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setShowAdvancedOptions((current) => !current)}
            className="flex w-full items-center justify-between gap-4 text-left"
          >
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">Opcje zaawansowane</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Ilość identycznych zestawów: {identicalSetCount || 1}
                {customPaymentSchedule.enabled ? " · płatność niestandardowa" : ""}
              </div>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-700">
              Otwórz
            </span>
          </button>

          {showAdvancedOptions && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
              <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:border dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-950 dark:text-slate-100">Opcje zaawansowane</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Ustawienia wielu zestawów i harmonogramu płatności.</p>
                  </div>
                  <button type="button" onClick={() => setShowAdvancedOptions(false)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">Zamknij</button>
                </div>
              <label className="block max-w-xs">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Ilość identycznych zestawów / instalacji
                </span>
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:bg-slate-900 dark:focus:ring-blue-500/20"
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={identicalSetCount || 1}
                  onChange={(e) => {
                    const nextValue = Number(e.target.value);
                    setIdenticalSetCount(
                      Number.isFinite(nextValue) && nextValue > 0
                        ? Math.min(Math.floor(nextValue), 100)
                        : 1
                    );
                    setResult(null);
                  }}
                />
                <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Użyj, gdy klient kupuje kilka identycznych instalacji. Liczba trafi do oferty PDF,
                  umowy i sprzedaży w CRM, a wartości łączne zostaną odpowiednio przemnożone.
                </p>
              </label>

              {customModeAvailable ? (
                <CustomPaymentScheduleFields
                  value={customPaymentSchedule}
                  onChange={setCustomPaymentSchedule}
                  totalGross={customPaymentTotalGross}
                />
              ) : null}
              </div>
            </div>
          )}
        </div>
      )}
      {(hasPvSelected || hasStorageSelected) && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setShowAdditionalServices((current) => !current)}
            className="flex w-full items-center justify-between gap-4 text-left"
          >
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">Usługi dodatkowe</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {selectedAdditionalServices.length > 0
                  ? `Wybrano: ${selectedAdditionalServices.length}`
                  : "Opcjonalne dodatki do oferty"}
              </div>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-700">
              Otwórz
            </span>
          </button>

          {showAdditionalServices && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
              <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:border dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-950 dark:text-slate-100">Usługi dodatkowe</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Wybierz usługi i określ ich ilość.</p>
                  </div>
                  <button type="button" onClick={() => setShowAdditionalServices(false)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">Gotowe</button>
                </div>
                <div className="space-y-3">
              {additionalServicesStatus && (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {additionalServicesStatus}
                </div>
              )}

              {additionalServices.length === 0 && !additionalServicesStatus && (
                <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-400 dark:ring-slate-700">
                  Brak aktywnych usług dodatkowych w panelu admina.
                </div>
              )}

              {additionalServices.map((service) => {
                const selectedService = selectedAdditionalServices.find(
                  (item) => item.id === service.id
                );

                return (
                  <div
                    key={service.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedService)}
                          onChange={() => toggleAdditionalService(service)}
                          className="mt-1 h-5 w-5"
                        />
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{service.name}</div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {Number(service.price_net || 0).toLocaleString("pl-PL", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} zł netto
                            {service.allows_quantity ? ` / ${service.unit_label?.trim() || "szt."}` : ""}
                          </div>
                        </div>
                      </label>

                      {selectedService && service.allows_quantity && (
                        <label className="block sm:w-32">
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            Ilość {service.unit_label?.trim() || "szt."}
                          </span>
                          <input
                            className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:bg-slate-900 dark:focus:ring-blue-500/20"
                            type="number"
                            min="1"
                            step="1"
                            value={selectedService.quantity}
                            onChange={(e) =>
                              updateAdditionalServiceQuantity(
                                service.id,
                                Number(e.target.value)
                              )
                            }
                          />
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
      {(customProductMode || hasPvSelected || hasStorageSelected) && (
        <div className={`mb-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 ${activeWorkspaceStep === "settlement" ? "" : "hidden"}`}>
          <div className="space-y-4">
            {!customProductMode ? <div>
              <span className="mb-2 block text-xs font-semibold text-slate-500 dark:text-slate-400">System rozliczeń</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "net_billing", label: "Net Billing", limit: "16 tys. zł" },
                  { value: "net_metering", label: "Net Metering", limit: "8 tys. zł" },
                ].map((option) => (
                  <label key={option.value} className={`cursor-pointer rounded-xl border px-4 py-3 transition ${billingSystem === option.value ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 bg-white text-slate-900 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"}`}>
                    <div className="flex items-center gap-3">
                      <input type="radio" name="billingSystem" checked={billingSystem === option.value} onChange={() => { setBillingSystem(option.value as "net_billing" | "net_metering"); setResult(null); }} className="h-4 w-4 shrink-0 accent-emerald-400" />
                      <span><span className="block text-sm font-bold">{option.label}</span><span className={`mt-0.5 block text-xs ${billingSystem === option.value ? "text-white/65 dark:text-slate-500" : "text-slate-500"}`}>Maksymalna dotacja: {option.limit}</span></span>
                    </div>
                  </label>
                ))}
              </div>
            </div> : null}

            <div>
              <span className="mb-2 block text-xs font-semibold text-slate-500 dark:text-slate-400">VAT klienta</span>
              <div className="grid grid-cols-2 gap-2">
                {[{ value: 8, label: "VAT 8%", meta: "B2C" }, { value: 23, label: "VAT 23%", meta: "B2B" }].map((option) => (
                  <label key={option.value} className={`cursor-pointer rounded-xl border px-4 py-3 transition ${vatRate === option.value ? "border-slate-950 bg-slate-100 dark:border-white dark:bg-white/10" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"}`}>
                    <div className="flex items-center gap-3"><input type="radio" name="vatRate" checked={vatRate === option.value} onChange={() => { setVatRate(option.value); setResult(null); }} className="h-4 w-4 shrink-0 accent-slate-950 dark:accent-white" /><span className="text-sm font-bold text-slate-900 dark:text-slate-100">{option.label} <span className="font-medium text-slate-500">({option.meta})</span></span></div>
                  </label>
                ))}
              </div>
            </div>

            {customProductMode ? (
              <label className="block">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Forma rozliczenia / warunki płatności
                </span>
                <textarea
                  className="mt-2 min-h-32 w-full resize-y rounded-2xl border border-violet-200 bg-white px-4 py-3 text-slate-900 shadow-inner shadow-violet-100/40 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-violet-500/40 dark:bg-slate-950 dark:text-slate-100 dark:shadow-none dark:focus:border-violet-400 dark:focus:ring-violet-500/20"
                  placeholder="np. Zadatek 20% w terminie 3 dni od podpisania umowy. Pozostała kwota przed odbiorem."
                  value={customPaymentTerms}
                  maxLength={1200}
                  onChange={(event) => {
                    setCustomPaymentTerms(event.target.value);
                    invalidateCalculation();
                  }}
                />
                <span className="mt-1 block text-right text-xs text-slate-400">
                  {customPaymentTerms.length}/1200
                </span>
              </label>
            ) : null}

            {!customProductMode ? <div>
              <span className="mb-2 block text-xs font-semibold text-slate-500 dark:text-slate-400">Program PME</span>
              {hasStorageSelected ? (
                <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 ${includeSubsidy ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"}`}>
                  <span><span className="block text-sm font-bold text-slate-900 dark:text-slate-100">Uwzględnij dotację</span><span className="mt-0.5 block text-xs text-slate-500">Optymalizacja programu PME w wyniku</span></span>
                  <input type="checkbox" checked={includeSubsidy} onChange={(event) => { setIncludeSubsidy(event.target.checked); setResult(null); }} className="h-5 w-5 shrink-0 accent-emerald-500" />
                </label>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 p-2.5 text-xs text-slate-400 dark:border-slate-700">Dostępne przy magazynie energii</div>
              )}
            </div> : null}
          </div>
        </div>
      )}

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              disabled={activeWorkspaceStepIndex === 0}
              onClick={goToPreviousWorkspaceSection}
              className="rounded-xl px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-100 disabled:invisible dark:hover:bg-slate-800"
            >
              ← {previousSectionLabel || "Wstecz"}
            </button>

            {activeWorkspaceStep !== "settlement" ? (
              <button
                type="button"
                onClick={goToNextWorkspaceSection}
                className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:shadow-none dark:hover:bg-slate-200"
              >
                Dalej: {nextSectionLabel} →
              </button>
            ) : (
              <button
                onClick={calculate}
                disabled={
                  !canConfigureOffer ||
                  (customProductMode
                    ? !hasValidCustomOfferItems
                    : !hasPvSelected && !hasStorageSelected)
                }
                className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-emerald-200 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none dark:shadow-black/30"
              >
                {!canConfigureOffer
                  ? "Uzupełnij dane klienta"
                  : customProductMode
                    ? hasValidCustomOfferItems
                      ? hasStaleResult
                        ? "Przelicz ofertę"
                        : "Oblicz ofertę"
                      : "Uzupełnij pozycję"
                    : hasPvSelected || hasStorageSelected
                    ? hasStaleResult
                      ? "Przelicz ofertę"
                      : "Oblicz ofertę"
                    : "Wybierz PV lub ME"}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
