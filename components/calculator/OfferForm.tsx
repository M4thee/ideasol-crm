import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type CatalogPanel = {
  code: string;
  name: string;
  power_wp: number;
  price_net: number;
};

type CatalogStorage = {
  code: string;
  name: string;
  capacity_kwh: number;
  price_net: number;
  installation_net: number;
};

type CatalogInverter = {
  name: string;
  type: string;
  max_pv_kw: number;
  price_net: number;
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
}: OfferFormProps) {
  const [clientSearch, setClientSearch] = useState("");
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

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
          .from("user_profiles")
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

  const panelsToShow =
    panels.length > 0
      ? panels
      : [
          {
            code: "AMERISOLAR_450_FB",
            name: "AMERISOLAR 450 FB",
            power_wp: 450,
            price_net: 230,
          },
          {
            code: "HORAY_435_BIFACIAL",
            name: "HORAY 435 BIFACIAL",
            power_wp: 435,
            price_net: 240,
          },
        ];

  const storagesToShow =
    storages.length > 0
      ? storages
      : [
          {
            code: "ZBPOWER_10",
            name: "ZBPOWER ZB-G512200 10 kWh",
            capacity_kwh: 10,
            price_net: 4394.5,
            installation_net: 1500,
          },
          {
            code: "ZBPOWER_16",
            name: "ZBPOWER ZB-G512314 16 kWh",
            capacity_kwh: 16,
            price_net: 5372,
            installation_net: 1500,
          },
        ];

  const invertersToShow =
    inverters.length > 0
      ? inverters
      : [
          {
            name: "Deye SUN-10K-SG05LP3-EU",
            type: "hybrid",
            max_pv_kw: 10.8,
            price_net: 5631.25,
          },
          {
            name: "Falownik Sieciowy 10K",
            type: "ongrid",
            max_pv_kw: 10.8,
            price_net: 1000,
          },
        ];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-blue-100 bg-white p-6 shadow-lg shadow-slate-200/70 ring-1 ring-blue-50">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-blue-500 via-emerald-400 to-cyan-400" />
      <div className="relative mb-6 flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-sm font-black text-white shadow-md shadow-blue-100">
            1
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Krok 1</p>
            <h2 className="text-xl font-bold text-slate-950">Konfiguracja</h2>
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
          <div className="absolute right-0 top-16 z-10 w-72 rounded-2xl border border-blue-100 bg-white p-4 shadow-xl shadow-slate-200/70">
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

      <label className="block mb-5">
        <span className="text-sm text-slate-700">Typ oferty</span>

        <select
          className="w-full mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          value={offerType}
          onChange={(e) => {
            const nextOfferType = e.target.value;

            setOfferType(nextOfferType);
            setResult(null);
            setEmailStatus("");

            if (nextOfferType === "pv") {
              setStorage("none");
            }

            if (nextOfferType === "pv_storage") {
              setStorage(storagesToShow[0]?.code || "ZBPOWER_10");
            }

            if (nextOfferType === "storage") {
              setStorage(storagesToShow[0]?.code || "ZBPOWER_10");
            }

            setSelectedInverterName("auto");
          }}
        >
          <option value="pv_storage">PV + ME</option>
          <option value="pv">PV</option>
          <option value="storage">ME</option>
        </select>
      </label>

      {offerType !== "storage" && (
        <label className="block mb-5">
          <span className="text-sm text-slate-700">Model panelu</span>

          <select
            className="w-full mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
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

      <div className="relative mb-5">
        <label className="block">
          <span className="text-sm text-slate-700">
            Klient z CRM <span className="text-slate-500">lub wpisz ręcznie</span>
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
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-950">
                          {getClientDisplayName(client)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {[client.phone || client.contact_phone, client.email, client.city]
                            .filter(Boolean)
                            .join(" • ") || "Brak danych kontaktowych"}
                        </div>
                      </div>

                      {client.public_id && (
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-blue-600 ring-1 ring-blue-100">
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

      {offerType !== "storage" && (
        <div className="mb-5 grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <label className="block">
            <span className="text-sm text-slate-700">Moc instalacji</span>

            <input
              className="w-full mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
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
              className="w-full mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
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
        </div>
      )}

      {offerType !== "storage" && (
        <label className="block mb-5">
          <span className="text-sm text-slate-700">Rodzaj montażu</span>

          <select
            className="w-full mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            value={roofType}
            onChange={(e) => {
              setRoofType(e.target.value);
              setResult(null);
            }}
          >
            <option value="blacha">Blacha</option>
            <option value="dachowka">Dachówka</option>
            <option value="papa">Papa</option>
            <option value="grunt">Grunt</option>
          </select>
        </label>
      )}

      <label className="block mb-5">
        <span className="text-sm text-slate-700">Magazyn energii</span>

        <select
          className="w-full mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          value={storage}
          onChange={(e) => {
            setStorage(e.target.value);
            setSelectedInverterName("auto");
            setResult(null);
          }}
          disabled={offerType === "pv"}
        >
          {offerType !== "storage" && <option value="none">Brak</option>}

          {storagesToShow.map((storageItem) => (
            <option key={storageItem.code} value={storageItem.code}>
              {storageItem.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block mb-5">
        <span className="text-sm text-slate-700">Falownik</span>

        <select
          className="w-full mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          value={selectedInverterName}
          onChange={(e) => {
            setSelectedInverterName(e.target.value);
            setResult(null);
          }}
        >
          <option value="auto">
            {offerType === "storage"
              ? "Auto — dobierz falownik pod magazyn"
              : "Automatycznie dobierz falownik do mocy instalacji"}
          </option>

          {offerType === "storage" && (
            <option value="none">Brak — klient ma już falownik hybrydowy</option>
          )}

          {invertersToShow
            .filter((inverterItem) => {
              if (offerType === "storage") return inverterItem.type === "hybrid";
              return true;
            })
            .map((inverterItem) => (
              <option key={inverterItem.name} value={inverterItem.name}>
                {inverterItem.type === "hybrid" ? "Hybrydowy" : "Sieciowy"} — {inverterItem.name} — do {Number(inverterItem.max_pv_kw).toLocaleString("pl-PL")} kWp
              </option>
            ))}
        </select>

        <p className="mt-2 rounded-xl bg-blue-50 px-3 py-2 text-xs text-slate-500">
          Auto dobiera falownik domyślnie. Ręczny wybór pozwala wymusić model, np. hybrydę „na zaś”.
        </p>
      </label>

      <label className="block mb-6">
        <span className="text-sm text-slate-700">VAT klienta</span>

        <select
          className="w-full mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
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

      <button
        onClick={calculate}
        className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 p-4 font-bold text-white shadow-lg shadow-emerald-200 transition hover:from-emerald-500 hover:to-teal-400"
      >
        Oblicz ofertę
      </button>
    </section>
  );
}