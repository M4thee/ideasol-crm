"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import OfferResult from "@/components/calculator/OfferResult";
import OfferForm from "@/components/calculator/OfferForm";
import AdminPanel from "@/components/calculator/AdminPanel";


type Result = {
  pvPowerKw: number;
  inverter: string;
  energyStorage: string;
  offerType: string;
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

type UserProfile = {
  id: string;
  display_name: string | null;
  phone: string | null;
  default_calculator_margin: number | null;
  default_seller_markup?: number | null;
  role: "admin" | "owner" | "seller" | "cc" | null;
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
    partner1: 2000,
    partner2: 2000,
  },
  operator: {
    percent: 15,
  },
};

export default function Home() {

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminStatus, setAdminStatus] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [savingOffer, setSavingOffer] = useState(false);
  const [saveOfferStatus, setSaveOfferStatus] = useState("");

  const [offerType, setOfferType] = useState("pv_storage");
  const [panelModel, setPanelModel] = useState("AMERISOLAR_450_FB");
  const [panelCount, setPanelCount] = useState(16);
  const [manualPowerKw, setManualPowerKw] = useState("");
  const [panels, setPanels] = useState<CatalogPanel[]>([]);
  const [storages, setStorages] = useState<CatalogStorage[]>([]);
  const [inverters, setInverters] = useState<CatalogInverter[]>([]);
  const [selectedInverterName, setSelectedInverterName] = useState("auto");
  const [roofType, setRoofType] = useState("dachowka");
  const [storage, setStorage] = useState("ZBPOWER_10");
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

  const currentUserRole = userProfile?.role || "seller";
  const advisorName = userProfile?.display_name || currentUserEmail || "IdeaSol";
  const advisorPhone = userProfile?.phone || "501 000 000";
  const advisorEmail = currentUserEmail || "kontakt@ideasol.pl";
  const canSeeTechnicalView = currentUserRole === "admin" || currentUserRole === "owner";
  const canSeePricingPanel = currentUserRole === "admin";

  function getPanelPowerWp(model: string) {
    const selectedPanel = panels.find((panel) => panel.code === model);

    if (selectedPanel) {
      return Number(selectedPanel.power_wp);
    }

    if (model === "HORAY_435_BIFACIAL") return 435;
    return 450;
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
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUserProfile(null);
        setCurrentUserEmail("");
        return;
      }

      setCurrentUserEmail(user.email || "");

      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, display_name, phone, default_calculator_margin, default_seller_markup, role")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Błąd ładowania profilu użytkownika kalkulatora", error);
        return;
      }

      if (data) {
        const profile = data as UserProfile;

        setUserProfile(profile);

        const defaultMargin = profile.default_calculator_margin;

        if (defaultMargin !== null && defaultMargin !== undefined) {
          const parsedDefaultMargin = Number(defaultMargin);

          if (Number.isFinite(parsedDefaultMargin)) {
            setSellerMarkup(parsedDefaultMargin);
          }
        }
      }
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
        },
        operator: {
          ...current.operator,
          percent: Number(data.warranty_percent ?? current.operator.percent),
        },
      }));
    }

    async function loadCatalog() {
      const [panelsResponse, storagesResponse, invertersResponse] = await Promise.all([
        supabase
          .from("panels")
          .select("code, name, power_wp, price_net")
          .eq("active", true)
          .order("power_wp", { ascending: false }),

        supabase
          .from("storages")
          .select("code, name, capacity_kwh, price_net, installation_net")
          .eq("active", true)
          .neq("code", "none")
          .order("capacity_kwh", { ascending: true }),

        supabase
          .from("inverters")
          .select("name, type, max_pv_kw, price_net")
          .eq("active", true)
          .order("max_pv_kw", { ascending: true }),
      ]);

      const loadedPanels = panelsResponse.data || [];
      const loadedStorages = storagesResponse.data || [];
      const loadedInverters = invertersResponse.data || [];

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

    loadCurrentUserProfile();
    loadCatalog();
    loadPricingSettings();
  }, []);


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
        selectedInverterName,
        sellerMarkup,
        vatRate,
        pricingOverrides,
      }),
    });

    const data = await res.json();
    setResult(data);
    setCopied(false);
    setEmailStatus("");
    setSaveOfferStatus("");
  }

  function resetForm() {
    setOfferType("pv_storage");
    setPanelModel("AMERISOLAR_450_FB");
    setPanelCount(16);
    setManualPowerKw("");
    setRoofType("dachowka");
    setStorage("ZBPOWER_10");
    setSelectedInverterName("auto");
    const defaultMargin = userProfile?.default_calculator_margin;

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
    setEmailStatus("");
    setShowSettings(false);
  }



  async function saveOfferToCrm() {
    if (!result) return;

    if (!selectedClientId) {
      setSaveOfferStatus("Wybierz klienta z CRM przed zapisem oferty.");
      return;
    }

    if (!userProfile?.id) {
      setSaveOfferStatus("Brak zalogowanego użytkownika — nie można zapisać oferty.");
      return;
    }

    setSavingOffer(true);
    setSaveOfferStatus("Zapisywanie oferty w CRM...");

    const offerPayload = {
      client_id: selectedClientId,
      created_by: userProfile.id,
      offer_type: result.offerType,
      status: "draft",
      client_name: clientName || null,
      client_email: clientEmail || null,
      sale_price_net: result.finalNet,
      sale_price_gross: result.finalGross,
      vat_rate: result.vatRate,
      seller_margin: result.sellerMarkupNet,
      company_margin: result.companyMargin,
      pv_power_kw: result.pvPowerKw,
      panel_model: panelModel,
      panel_count: panelCount,
      panel_power_wp: getPanelPowerWp(panelModel),
      inverter: result.inverter,
      energy_storage: result.energyStorage,
      roof_type: roofType,
      offer_data: {
        result,
        form: {
          offerType,
          panelModel,
          panelCount,
          manualPowerKw,
          roofType,
          storage,
          selectedInverterName,
          sellerMarkup,
          vatRate,
          defaultCalculatorMargin: userProfile?.default_calculator_margin ?? null,
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
      return;
    }

    setSaveOfferStatus(
      data?.offer_public_id
        ? `Oferta zapisana w CRM jako ${data.offer_public_id}.`
        : "Oferta zapisana w CRM."
    );
    setSavingOffer(false);
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
    const inverterLine = hasInverter ? `- falownik: ${result.inverter}\n` : "";
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

  async function sendOfferEmail() {
    if (!result) return;

    setSendingEmail(true);
    setEmailStatus("");

    try {
      const res = await fetch("/api/send-offer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientEmail,
          offerType: result.offerType,
          pvPowerKw: result.pvPowerKw,
          inverter: result.inverter,
          energyStorage: result.energyStorage,
          finalNet: result.finalNet,
          finalGross: result.finalGross,
          vatRate: result.vatRate,
        }),
      });

      if (!res.ok) {
        throw new Error("Nie udało się wysłać maila");
      }

      setEmailStatus("Mail został wysłany");
    } catch (error) {
      setEmailStatus("Błąd wysyłki maila");
    } finally {
      setSendingEmail(false);
    }
  }



  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {canSeePricingPanel && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowAdminPanel((current) => !current)}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700 hover:shadow-md"
            >
              {showAdminPanel ? "Ukryj panel cen" : "Panel cen admina"}
            </button>
          </div>
        )}

        {canSeePricingPanel && showAdminPanel && (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <AdminPanel
              adminStatus={adminStatus}
              pricingOverrides={pricingOverrides}
              updatePricingValue={updatePricingValue}
              savePricingSettings={savePricingSettings}
              resetPricingOverrides={resetPricingOverrides}
            />
          </section>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className={result ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.8fr)]" : "grid grid-cols-1 gap-6"}>
            <OfferForm
              offerType={offerType}
              setOfferType={setOfferType}
              panelModel={panelModel}
              setPanelModel={setPanelModel}
              panelCount={panelCount}
              setPanelCount={setPanelCount}
              manualPowerKw={manualPowerKw}
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
            />

            {result && (
              <OfferResult
                result={result}
                panelCount={panelCount}
                panelPowerWp={getPanelPowerWp(panelModel)}
                panelName={panels.find((panel) => panel.code === panelModel)?.name || panelModel}
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
                selectedClientId={selectedClientId}
                canSeeTechnicalView={canSeeTechnicalView}
                currentUserRole={currentUserRole}
                advisorName={advisorName}
                advisorPhone={advisorPhone}
                advisorEmail={advisorEmail}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}