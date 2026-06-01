import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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


type OfferFormProps = {
  offerType: string;
  setOfferType: (value: string) => void;
  panelModel: string;
  setPanelModel: (value: string) => void;
  panelCount: number;
  setPanelCount: (value: number) => void;
  manualPowerKw: string;
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
  withEms: boolean;
  setWithEms: (value: boolean) => void;
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
};

export default function OfferForm({
  offerType,
  setOfferType,
  panelModel,
  setPanelModel,
  panelCount,
  setPanelCount,
  manualPowerKw,
  clientName,
  setClientName,
  setClientEmail,
  crmClients = [],
  todayMeetingClients = [],
  selectedClientId = "",
  setSelectedClientId = () => {},
  setManualPowerKw,
  calculateNearestPanelCount,
  roofType,
  setRoofType,
  storage,
  setStorage,
  withEms,
  setWithEms,
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
  setSelectedAdditionalServices = () => {},
}: OfferFormProps) {
  const [clientSearch, setClientSearch] = useState("");
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [existingPvAnswer, setExistingPvAnswer] = useState<"yes" | "no" | "">("");

  const [additionalServices, setAdditionalServices] = useState<CatalogAdditionalService[]>([]);
  const [showAdditionalServices, setShowAdditionalServices] = useState(false);
  const [additionalServicesStatus, setAdditionalServicesStatus] = useState("");
  useEffect(() => {
    async function loadAdditionalServices() {
      const { data, error } = await supabase
        .from("additional_services")
        .select("id, name, unit_label, price_net, allows_quantity, active")
        .eq("active", true)
        .order("name", { ascending: true });

      if (error) {
        console.error("OfferForm: błąd ładowania usług dodatkowych", error);
        setAdditionalServicesStatus(`Błąd ładowania usług dodatkowych: ${error.message}`);
        return;
      }

      setAdditionalServices((data || []) as CatalogAdditionalService[]);
      setAdditionalServicesStatus("");
    }

    loadAdditionalServices();
  }, []);

  const [internalCrmClients, setInternalCrmClients] = useState<CrmClientOption[]>([]);
  const [internalTodayMeetingClients, setInternalTodayMeetingClients] = useState<CrmClientOption[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);

  useEffect(() => {
    async function loadClientsIfNeeded() {
      if (crmClients.length > 0 || internalCrmClients.length > 0) return;

      setIsLoadingClients(true);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          console.warn("OfferForm: brak zalogowanego użytkownika przy ładowaniu klientów CRM");
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
          console.error("Błąd ładowania klientów w OfferForm", clientsError);
          setInternalCrmClients([]);
          setInternalTodayMeetingClients([]);
          return;
        }

        const loadedClients = clientsData || [];
        setInternalCrmClients(loadedClients);

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
    setSelectedClientId(client.id);
    setClientName(getClientDisplayName(client));
    if (client.email) {
      setClientEmail?.(client.email);
    }
    setClientSearch("");
    setIsClientDropdownOpen(false);
    setResult(null);
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

  const storagesToShow = storages;

  const invertersToShow =
    inverters.length > 0
      ? inverters
      : [
          {
            name: "Deye SUN-10K-SG05LP3-EU",
            display_name: "Deye SUN-10K-SG05LP3-EU",
            type: "hybrid",
            max_pv_kw: 10.8,
            price_net: 5631.25,
          },
          {
            name: "Falownik Sieciowy 10K",
            display_name: "Falownik Sieciowy 10K",
            type: "ongrid",
            max_pv_kw: 10.8,
            price_net: 1000,
          },
        ];

  const hasPvSelected = offerType === "pv" || offerType === "pv_storage";
  const hasStorageSelected = offerType === "storage" || offerType === "pv_storage";
  const existingPvPowerNumber = Number(String(existingPvPowerKw || "0").replace(",", "."));
  const canConfigureOffer =
    existingPvAnswer === "no" ||
    (existingPvAnswer === "yes" && Number.isFinite(existingPvPowerNumber) && existingPvPowerNumber > 0);

  function updateOfferModules(nextHasPv: boolean, nextHasStorage: boolean) {
    if (!nextHasPv && !nextHasStorage) {
      setOfferType("none");
      setStorage("none");
      setWithEms(false);
      setIncludeSubsidy(false);
      setIsUpsell(false);
      setExistingPvPowerKw("0");
      setSelectedInverterName("auto");
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
      setWithEms(false);
      setIncludeSubsidy(false);
    }

    if (nextOfferType === "pv_storage") {
      setWithEms(false);
      setIncludeSubsidy(true);
      if (storage === "none") {
        setStorage(storagesToShow[0]?.code || "ZBPOWER_10");
      }
    }

    if (nextOfferType === "storage") {
      setWithEms(false);
      setIncludeSubsidy(true);
      if (storage === "none") {
        setStorage(storagesToShow[0]?.code || "ZBPOWER_10");
      }
    }

    setSelectedInverterName("auto");
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-blue-100 bg-white p-4 shadow-lg shadow-slate-200/70 ring-1 ring-blue-50 sm:p-6">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-blue-500 via-emerald-400 to-cyan-400" />
      <div className="relative mb-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-sm font-black text-white shadow-md shadow-blue-100">
            1
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Krok 1</p>
            <h2 className="text-lg font-bold text-slate-950 sm:text-xl">Konfiguracja</h2>
          </div>

          <button
            type="button"
            onClick={() => setShowSettings((current) => !current)}
            className="text-[2rem] text-[#7192dc] transition hover:scale-105 hover:text-[#5f84d8]"
            aria-label="Ustawienia kalkulatora"
          >
            ⚙
          </button>
        </div>

        {showSettings && (
          <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-10 w-full rounded-2xl border border-blue-100 bg-white p-4 shadow-xl shadow-slate-200/70 sm:left-auto sm:right-0 sm:w-72">
            <label className="block">
              <span className="text-sm text-slate-700">
                Narzut handlowca netto
              </span>

              <input
                className="w-full mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                type="number"
                min="0"
                value={sellerMarkup}
                onChange={(e) => {
                  setSellerMarkup(Number(e.target.value));
                  setResult(null);
                }}
              />
            </label>

            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              To ustawienie jest ukryte z głównego formularza, ale nadal wpływa na cenę oferty.
            </p>

            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="w-full mt-4 rounded-2xl bg-emerald-600 p-3 font-bold text-white shadow-md shadow-emerald-100 transition hover:bg-emerald-500"
            >
              ✓ Zapisz
            </button>
          </div>
        )}
      </div>
      {/* CRM CLIENT SELECTOR */}
      <div className="relative mb-5 min-w-0 rounded-3xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 via-white to-emerald-50 p-4 shadow-md shadow-blue-100/70">
        <label className="block">
          <span className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-blue-700">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs text-white">1</span>
            Wyszukaj klienta
            <span className="normal-case tracking-normal text-slate-500">lub wpisz ręcznie</span>
          </span>

          <input
            className="w-full mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
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
              setIsClientDropdownOpen(true);
              setResult(null);
            }}
          />
        </label>

        {isClientDropdownOpen && (
          <div className="absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70">
            <div className="mb-2 flex items-center justify-between px-3 py-2 text-xs text-slate-500">
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
                className="text-slate-400 transition hover:text-slate-700"
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
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50"
                  >
                    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0">
                        <div className="break-words font-semibold text-slate-950">
                          {getClientDisplayName(client)}
                        </div>
                        <div className="mt-1 break-words text-xs text-slate-500">
                          {[client.phone || client.contact_phone, client.email, client.city]
                            .filter(Boolean)
                            .join(" • ") || "Brak danych kontaktowych"}
                        </div>
                      </div>

                      {client.public_id && (
                        <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-semibold text-blue-600 ring-1 ring-blue-100">
                          LeadID {client.public_id}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
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
          <div className="mt-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Wybrany klient CRM: <strong>{getClientDisplayName(selectedClient)}</strong>
            {selectedClient.public_id ? ` • LeadID ${selectedClient.public_id}` : ""}
          </div>
        )}
      </div>

      <div className="mb-5 rounded-3xl border-2 border-emerald-200 bg-emerald-50/70 p-4 shadow-sm shadow-emerald-100">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-emerald-700">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">2</span>
              Czy klient posiada fotowoltaikę?
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              To pole wpływa na warunek dotacji PME: pojemność magazynu musi wynosić minimum dwukrotność łącznej mocy PV klienta.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[320px]">
            <button
              type="button"
              onClick={() => {
                setExistingPvAnswer("yes");
                setIsUpsell(true);
                setResult(null);
                setEmailStatus("");
              }}
              className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                existingPvAnswer === "yes"
                  ? "border-emerald-500 bg-white text-emerald-700 shadow-sm ring-2 ring-emerald-100"
                  : "border-slate-200 bg-white/80 text-slate-700 hover:border-emerald-300"
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
              className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                existingPvAnswer === "no"
                  ? "border-emerald-500 bg-white text-emerald-700 shadow-sm ring-2 ring-emerald-100"
                  : "border-slate-200 bg-white/80 text-slate-700 hover:border-emerald-300"
              }`}
            >
              NIE
            </button>
          </div>
        </div>

        {existingPvAnswer === "yes" && (
          <label className="mt-4 block max-w-md">
            <span className="text-sm font-semibold text-slate-700">Moc obecnej instalacji PV klienta</span>
            <input
              className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-slate-900 shadow-inner shadow-emerald-100/40 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
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
            <p className="mt-2 text-xs text-slate-500">
              Po wpisaniu mocy odblokujemy wybór PV / ME w kalkulatorze.
            </p>
          </label>
        )}

      </div>

      {/* MODULE/PRODUCT SECTION */}
      <div className={`mb-5 transition ${canConfigureOffer ? "" : "pointer-events-none opacity-45 grayscale"}`}>
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">3</span>
          <span className="text-sm font-black uppercase tracking-[0.14em] text-blue-700">Wybierz elementy oferty</span>
        </div>

        <div className="mt-3 space-y-3">
          <div
            className={`rounded-2xl border p-4 transition ${
              hasPvSelected
                ? "border-blue-500 bg-blue-50 shadow-sm"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={hasPvSelected}
                  disabled={!canConfigureOffer}
                  onChange={(event) => {
                    updateOfferModules(event.target.checked, hasStorageSelected);
                  }}
                  className="h-5 w-5"
                />

                <div className="font-semibold text-slate-900">Fotowoltaika</div>
              </label>

            </div>

            {hasPvSelected && (
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <label className="block lg:col-span-1">
                  <span className="text-sm text-slate-700">Model panelu</span>

                  <select
                    className="h-[50px] w-full mt-2 rounded-[18px] border border-slate-200 bg-white px-4 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
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

                <label className="block">
                  <span className="text-sm text-slate-700">Moc instalacji</span>

                  <input
                    className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
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
                  <span className="text-sm text-slate-700">Liczba paneli</span>

                  <input
                    className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
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

                <div className="block lg:col-span-3">
                  <span className="text-sm text-slate-700">Rodzaj montażu</span>

                  <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { value: "blacha", label: "Blacha" },
                      { value: "dachowka", label: "Dachówka" },
                      { value: "papa", label: "Papa" },
                      { value: "grunt", label: "Grunt" },
                    ].map((option) => (
                      <label
                        key={option.value}
                        className={`cursor-pointer rounded-[18px] border px-4 py-3 transition ${
                          roofType === option.value
                            ? "border-blue-500 bg-white shadow-sm ring-1 ring-blue-100"
                            : "border-slate-200 bg-white/70 hover:border-blue-200 hover:bg-white"
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

                          <span className="text-sm font-semibold text-slate-900">
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
            className={`rounded-2xl border p-4 transition ${
              hasStorageSelected
                ? "border-emerald-500 bg-emerald-50 shadow-sm"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={hasStorageSelected}
                disabled={!canConfigureOffer}
                onChange={(event) => {
                  updateOfferModules(hasPvSelected, event.target.checked);
                }}
                className="mt-1 h-5 w-5"
              />

              <div>
                <div className="font-semibold text-slate-900">Magazyn Energii</div>
                <div className="mt-1 text-xs text-slate-500">
                
                </div>
              </div>
            </label>

            {hasStorageSelected && (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <label className="block">
                  

                  <select
                    className="h-[104px] w-full mt-2 rounded-[18px] border border-slate-200 bg-white px-4 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={storage}
                    onChange={(e) => {
                      setStorage(e.target.value);
                      setSelectedInverterName("auto");
                      setResult(null);
                    }}
                  >
                    {storagesToShow.map((storageItem) => (
                      <option key={storageItem.code} value={storageItem.code}>
                        {storageItem.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex min-h-[104px] items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-4">
                  <input
                    type="checkbox"
                    checked={withEms}
                    onChange={(e) => {
                      setWithEms(e.target.checked);
                      setResult(null);
                    }}
                    className="h-5 w-5"
                  />

                  <div>
                    <div className="font-semibold text-slate-900">
                      EMS / HEMS
                    </div>

                    <div className="text-xs text-slate-500">
                      Dolicz system zarządzania energią.
                    </div>
                  </div>
                </label>
              </div>
            )}
          </div>
        </div>
      </div>
      {(hasPvSelected || hasStorageSelected) && (
        <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <button
            type="button"
            onClick={() => setShowAdditionalServices((current) => !current)}
            className="flex w-full items-center justify-between gap-4 text-left"
          >
            <div>
              <div className="font-semibold text-slate-900">Usługi dodatkowe</div>
              <div className="mt-1 text-xs text-slate-500">
                {selectedAdditionalServices.length > 0
                  ? `Wybrano: ${selectedAdditionalServices.length}`
                  : "Opcjonalne dodatki do oferty"}
              </div>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
              {showAdditionalServices ? "Ukryj" : "Pokaż"}
            </span>
          </button>

          {showAdditionalServices && (
            <div className="mt-4 space-y-3">
              {additionalServicesStatus && (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {additionalServicesStatus}
                </div>
              )}

              {additionalServices.length === 0 && !additionalServicesStatus && (
                <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 ring-1 ring-slate-200">
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
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
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
                          <div className="font-semibold text-slate-900">{service.name}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {Number(service.price_net || 0).toLocaleString("pl-PL", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} zł netto
                            {service.allows_quantity ? " / szt." : ""}
                          </div>
                        </div>
                      </label>

                      {selectedService && service.allows_quantity && (
                        <label className="block sm:w-32">
                          <span className="text-xs font-semibold text-slate-500">Ilość szt.</span>
                          <input
                            className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
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
          )}
        </div>
      )}
      {(hasPvSelected || hasStorageSelected) && (
<label className="block mb-5">
        <span className="text-sm text-slate-700">Falownik</span>

        <select
          className="h-[50px] w-full mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          value={selectedInverterName}
          onChange={(e) => {
            setSelectedInverterName(e.target.value);
            setResult(null);
          }}
        >
          <option value="auto">
            {hasStorageSelected
              ? "Automatycznie dobierz falownik hybrydowy"
              : "Automatycznie dobierz falownik sieciowy pod moc instalacji"}
          </option>

          {hasStorageSelected && (
            <option value="none">Brak — klient ma już falownik hybrydowy</option>
          )}

          {invertersToShow
            .filter((inverterItem) => {
              if (hasStorageSelected) return inverterItem.type === "hybrid";
              return inverterItem.type !== "hybrid";
            })
            .map((inverterItem, index) => (
              <option key={`${inverterItem.name}-${inverterItem.type}-${index}`} value={inverterItem.name}>
                {inverterItem.type === "hybrid" ? "Hybrydowy" : "Sieciowy"} — {inverterItem.display_name || inverterItem.name} — do {Number(inverterItem.max_pv_kw).toLocaleString("pl-PL")} kWp
              </option>
            ))}
        </select>

        <p className="mt-2 rounded-xl bg-blue-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
          Funkcja automatyczna dobiera falownik po mocyinstalacji. Ręczny wybór pozwala zmienić model i typ falownika np. sieciowy na hybrydowy.”.
        </p>
      </label>
      )}

      {hasStorageSelected && (
        <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">4</span>
            <span className="text-sm font-black uppercase tracking-[0.14em] text-blue-700">Czy uwzględnić dotację?</span>
          </div>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={includeSubsidy}
              onChange={(e) => {
                setIncludeSubsidy(e.target.checked);
                setResult(null);
              }}
              className="mt-1 h-5 w-5"
            />

            <div>
              <div className="font-semibold text-slate-900">
                Uwzględnij dotację PME
              </div>
              <div className="mt-1 text-xs leading-relaxed text-slate-500">
                Dotacja będzie liczona tylko wtedy, gdy magazyn energii spełnia warunki programu, w tym minimalną pojemność oraz relację pojemności ME do mocy PV.
              </div>
            </div>
          </label>
        </div>
      )}

      {(hasPvSelected || hasStorageSelected) && (
        <div className="mb-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">5</span>
            <span className="text-sm font-black uppercase tracking-[0.14em] text-blue-700">Forma rozliczeń</span>
          </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label
            className={`cursor-pointer rounded-2xl border p-4 transition ${
              billingSystem === "net_billing"
                ? "border-blue-500 bg-blue-50 shadow-sm"
                : "border-slate-200 bg-slate-50 hover:border-blue-200 hover:bg-blue-50/50"
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="billingSystem"
                checked={billingSystem === "net_billing"}
                onChange={() => {
                  setBillingSystem("net_billing");
                  setResult(null);
                }}
                className="mt-1 h-4 w-4"
              />

              <div>
                <div className="font-semibold text-slate-900">Net Billing</div>
                <div className="mt-1 text-xs text-slate-500">
                  Limit dotacji magazynu: 16 000 zł.
                </div>
              </div>
            </div>
          </label>

          <label
            className={`cursor-pointer rounded-2xl border p-4 transition ${
              billingSystem === "net_metering"
                ? "border-blue-500 bg-blue-50 shadow-sm"
                : "border-slate-200 bg-slate-50 hover:border-blue-200 hover:bg-blue-50/50"
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="billingSystem"
                checked={billingSystem === "net_metering"}
                onChange={() => {
                  setBillingSystem("net_metering");
                  setResult(null);
                }}
                className="mt-1 h-4 w-4"
              />

              <div>
                <div className="font-semibold text-slate-900">Net Metering</div>
                <div className="mt-1 text-xs text-slate-500">
                  Limit dotacji magazynu: 8 000 zł.
                </div>
              </div>
            </div>
          </label>
        </div>
        </div>
      )}

      {(hasPvSelected || hasStorageSelected) && (
        <label className="block mb-6">
          <span className="text-sm text-slate-700">VAT klienta</span>

          <select
            className="h-[50px] w-full mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            value={vatRate}
            onChange={(e) => {
              setVatRate(Number(e.target.value));
              setResult(null);
            }}
          >
            <option value={8}>8% B2C</option>
            <option value={23}>23% B2B</option>
          </select>
        </label>
      )}

      <button
        onClick={calculate}
        disabled={!canConfigureOffer || (!hasPvSelected && !hasStorageSelected)}
        className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-200 transition hover:from-emerald-500 hover:to-teal-400 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500 disabled:shadow-none sm:text-base"
      >
        {!canConfigureOffer
          ? "Uzupełnij informację o obecnej PV klienta"
          : hasPvSelected || hasStorageSelected
            ? "Oblicz ofertę"
            : "Wybierz PV lub ME"}
      </button>
    </section>
  );
}