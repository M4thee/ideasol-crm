"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";


type PanelItem = {
  id: number;
  code: string;
  manufacturer: string;
  model: string;
  display_name: string;
  name: string;
  power_wp: number;
  price_net: number;
  catalog_card_url: string | null;
  active: boolean;
};

type InverterItem = {
  id: number;
  manufacturer: string;
  model: string;
  display_name: string;
  name: string;
  type: string;
  battery_voltage_type: "low_voltage" | "high_voltage" | null;
  max_pv_kw: number;
  price_net: number;
  catalog_card_url: string | null;
  active: boolean;
};

type StorageItem = {
  id: number;
  code: string;
  manufacturer: string;
  model: string;
  display_name: string;
  name: string;
  capacity_kwh: number;
  voltage_type: "low_voltage" | "high_voltage";
  price_net: number;
  installation_net: number;
  catalog_card_url: string | null;
  active: boolean;
};

type AdditionalServiceItem = {
  id: number;
  name: string;
  price_net: number;
  unit_label: string;
  allows_quantity: boolean;
  active: boolean;
};

type AdminPanelProps = {
  adminStatus: string;
  pricingOverrides: any;
  updatePricingValue: (path: string[], value: string) => void;
  savePricingSettings: (pricing: any) => void;
  resetPricingOverrides: () => void;
};

const EMPTY_PANEL_FORM = {
  code: "",
  manufacturer: "",
  model: "",
  display_name: "",
  name: "",
  power_wp: "450",
  price_net: "0",
  catalog_card_url: "",
};

const EMPTY_INVERTER_FORM = {
  manufacturer: "",
  model: "",
  display_name: "",
  name: "",
  type: "ongrid",
  battery_voltage_type: "",
  max_pv_kw: "10",
  price_net: "0",
  catalog_card_url: "",
};

const EMPTY_STORAGE_FORM = {
  code: "",
  manufacturer: "",
  model: "",
  display_name: "",
  name: "",
  capacity_kwh: "10",
  voltage_type: "low_voltage",
  price_net: "0",
  installation_net: "1500",
  catalog_card_url: "",
};

const EMPTY_ADDITIONAL_SERVICE_FORM = {
  name: "",
  price_net: "0",
  unit_label: "szt.",
  allows_quantity: false,
};

function parseDecimal(value: string | number) {
  const normalized = String(value ?? "").replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

export default function AdminPanel({
  adminStatus,
  pricingOverrides,
  updatePricingValue,
  savePricingSettings,
  resetPricingOverrides,
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState("global");
  const [panels, setPanels] = useState<PanelItem[]>([]);
  const [panelsStatus, setPanelsStatus] = useState("");
  const [panelForm, setPanelForm] = useState(EMPTY_PANEL_FORM);
  const [inverters, setInverters] = useState<InverterItem[]>([]);
  const [invertersStatus, setInvertersStatus] = useState("");
  const [inverterForm, setInverterForm] = useState(EMPTY_INVERTER_FORM);
  const [storages, setStorages] = useState<StorageItem[]>([]);
  const [storagesStatus, setStoragesStatus] = useState("");
  const [storageForm, setStorageForm] = useState(EMPTY_STORAGE_FORM);
  const [additionalServices, setAdditionalServices] = useState<AdditionalServiceItem[]>([]);
  const [additionalServicesStatus, setAdditionalServicesStatus] = useState("");
  const [additionalServiceForm, setAdditionalServiceForm] = useState(
    EMPTY_ADDITIONAL_SERVICE_FORM
  );

  async function loadPanels() {
    const { data, error } = await supabase
      .from("panels")
      .select("id, code, manufacturer, model, display_name, name, power_wp, price_net, catalog_card_url, active")
      .eq("active", true)
      .order("power_wp", { ascending: false });

    if (error) {
      setPanelsStatus("Błąd ładowania paneli");
      return;
    }

    setPanels((data || []) as PanelItem[]);
  }

  async function loadInverters() {
    const { data, error } = await supabase
      .from("inverters")
      .select("id, manufacturer, model, display_name, name, type, battery_voltage_type, max_pv_kw, price_net, catalog_card_url, active")
      .eq("active", true)
      .order("max_pv_kw", { ascending: true });

    if (error) {
      console.error("Błąd ładowania falowników", error);
      setInvertersStatus(`Błąd ładowania falowników: ${error.message}`);
      return;
    }

    setInverters((data || []) as InverterItem[]);
  }

  async function loadStorages() {
    const { data, error } = await supabase
      .from("storages")
      .select("id, code, manufacturer, model, display_name, name, capacity_kwh, voltage_type, price_net, installation_net, catalog_card_url, active")
      .eq("active", true)
      .order("voltage_type", { ascending: true })
      .order("capacity_kwh", { ascending: true });

    if (error) {
      console.error("Błąd ładowania magazynów", error);
      setStoragesStatus(`Błąd ładowania magazynów: ${error.message}`);
      return;
    }

    setStorages((data || []) as StorageItem[]);
  }

  async function loadAdditionalServices() {
    const { data, error } = await supabase
      .from("additional_services")
      .select("id, name, price_net, unit_label, allows_quantity, active")
      .eq("active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("Błąd ładowania usług dodatkowych", error);
      setAdditionalServicesStatus(`Błąd ładowania usług dodatkowych: ${error.message}`);
      return;
    }

    setAdditionalServices((data || []) as AdditionalServiceItem[]);
  }

  useEffect(() => {
    loadPanels();
    loadInverters();
    loadStorages();
    loadAdditionalServices();
  }, []);
  async function updateAdditionalService(
    serviceId: number,
    field: keyof AdditionalServiceItem,
    value: string | number | boolean | null
  ) {
    setAdditionalServices((current) =>
      current.map((service) =>
        service.id === serviceId
          ? {
            ...service,
            [field]: value,
          }
          : service
      )
    );

    setAdditionalServicesStatus("Masz niezapisane zmiany w usługach dodatkowych");
  }

  async function saveAdditionalServices() {
    setAdditionalServicesStatus("Zapisywanie usług dodatkowych...");

    for (const service of additionalServices) {
      const { error } = await supabase
        .from("additional_services")
        .update({
          name: service.name,
          price_net: parseDecimal(service.price_net),
          unit_label: service.unit_label?.trim() || "szt.",
          allows_quantity: Boolean(service.allows_quantity),
          active: Boolean(service.active),
        })
        .eq("id", service.id);

      if (error) {
        console.error("Błąd zapisu usług dodatkowych", error);
        setAdditionalServicesStatus(`Błąd zapisu usług dodatkowych: ${error.message}`);
        return;
      }
    }

    setAdditionalServicesStatus("Usługi dodatkowe zapisane do Supabase");
    loadAdditionalServices();
  }

  async function addAdditionalService() {
    setAdditionalServicesStatus("");

    if (!additionalServiceForm.name.trim()) {
      setAdditionalServicesStatus("Uzupełnij nazwę usługi dodatkowej");
      return;
    }

    const { error } = await supabase.from("additional_services").insert({
      name: additionalServiceForm.name.trim(),
      price_net: parseDecimal(additionalServiceForm.price_net),
      unit_label: additionalServiceForm.unit_label.trim() || "szt.",
      allows_quantity: Boolean(additionalServiceForm.allows_quantity),
      active: true,
    });

    if (error) {
      console.error("Błąd dodawania usługi dodatkowej", error);
      setAdditionalServicesStatus(`Błąd dodawania usługi dodatkowej: ${error.message}`);
      return;
    }

    setAdditionalServiceForm(EMPTY_ADDITIONAL_SERVICE_FORM);
    setAdditionalServicesStatus("Dodano usługę dodatkową");
    loadAdditionalServices();
  }

  async function deleteAdditionalService(serviceId: number) {
    if (!confirm("Usunąć tę usługę dodatkową z panelu? Rekord zostanie ukryty, ale zostanie w bazie.")) return;

    const { error } = await supabase
      .from("additional_services")
      .update({ active: false })
      .eq("id", serviceId);

    if (error) {
      setAdditionalServicesStatus(`Błąd ukrywania usługi dodatkowej: ${error.message}`);
      return;
    }

    setAdditionalServicesStatus("Usługa dodatkowa została ukryta w panelu");
    loadAdditionalServices();
  }

  async function updatePanel(panelId: number, field: keyof PanelItem, value: string | number | boolean) {
    setPanels((current) =>
      current.map((panel) =>
        panel.id === panelId
          ? {
            ...panel,
            [field]: value,
          }
          : panel
      )
    );

    setPanelsStatus("Masz niezapisane zmiany w panelach");
  }

  async function savePanels() {
    setPanelsStatus("Zapisywanie paneli...");

    for (const panel of panels) {
      const { error } = await supabase
        .from("panels")
        .update({
          code: panel.code,
          manufacturer: panel.manufacturer,
          model: panel.model,
          display_name: panel.display_name,
          name: panel.display_name || panel.model || panel.code,
          power_wp: Number(panel.power_wp),
          price_net: Number(panel.price_net),
          catalog_card_url: panel.catalog_card_url?.trim() || null,
          active: Boolean(panel.active),
        })
        .eq("id", panel.id);

      if (error) {
        console.error("Błąd zapisu paneli", error);
        setPanelsStatus(`Błąd zapisu paneli: ${error.message}`);
        return;
      }
    }

    setPanelsStatus("Panele zapisane do Supabase");
    loadPanels();
  }

  async function addPanel() {
    setPanelsStatus("");

    if (!panelForm.code || !panelForm.display_name) {
      setPanelsStatus("Uzupełnij kod i nazwę wyświetlaną panelu");
      return;
    }

    const { error } = await supabase.from("panels").insert({
      code: panelForm.code.trim().toUpperCase().replaceAll(" ", "_"),
      manufacturer: panelForm.manufacturer.trim(),
      model: panelForm.model.trim(),
      display_name: panelForm.display_name.trim(),
      name: panelForm.display_name.trim() || panelForm.model.trim() || panelForm.code.trim(),
      power_wp: Number(panelForm.power_wp),
      price_net: Number(panelForm.price_net),
      catalog_card_url: panelForm.catalog_card_url.trim() || null,
      active: true,
    });

    if (error) {
      console.error("Błąd dodawania panelu", error);
      setPanelsStatus(`Błąd dodawania panelu: ${error.message}`);
      return;
    }

    setPanelForm(EMPTY_PANEL_FORM);
    setPanelsStatus("Dodano panel");
    loadPanels();
  }

  async function deletePanel(panelId: number) {
    if (!confirm("Usunąć ten panel z panelu admina? Rekord zostanie ukryty, ale zostanie w bazie.")) return;

    const { error } = await supabase
      .from("panels")
      .update({ active: false })
      .eq("id", panelId);

    if (error) {
      setPanelsStatus(`Błąd ukrywania panelu: ${error.message}`);
      return;
    }

    setPanelsStatus("Panel został ukryty w panelu admina");
    loadPanels();
  }

  async function updateInverter(
    inverterId: number,
    field: keyof InverterItem,
    value: string | number | boolean | null
  ) {
    setInverters((current) =>
      current.map((inverter) =>
        inverter.id === inverterId
          ? {
            ...inverter,
            [field]: value,
          }
          : inverter
      )
    );

    setInvertersStatus("Masz niezapisane zmiany w falownikach");
  }

  async function saveInverters() {
    setInvertersStatus("Zapisywanie falowników...");

    for (const inverter of inverters) {
      const { error } = await supabase
        .from("inverters")
        .update({
          manufacturer: inverter.manufacturer,
          model: inverter.model,
          display_name: inverter.display_name,
          name: inverter.display_name || inverter.model || inverter.manufacturer,
          type: inverter.type,
          battery_voltage_type:
            inverter.type === "hybrid" ? inverter.battery_voltage_type || null : null,
          max_pv_kw: Number(inverter.max_pv_kw),
          price_net: Number(inverter.price_net),
          catalog_card_url: inverter.catalog_card_url?.trim() || null,
          active: Boolean(inverter.active),
        })
        .eq("id", inverter.id);

      if (error) {
        console.error("Błąd zapisu falowników", error);
        setInvertersStatus(`Błąd zapisu falowników: ${error.message}`);
        return;
      }
    }

    setInvertersStatus("Falowniki zapisane do Supabase");
    loadInverters();
  }

  async function addInverter() {
    setInvertersStatus("");

    if (!inverterForm.display_name) {
      setInvertersStatus("Uzupełnij nazwę wyświetlaną falownika");
      return;
    }

    const { error } = await supabase.from("inverters").insert({
      manufacturer: inverterForm.manufacturer.trim(),
      model: inverterForm.model.trim(),
      display_name: inverterForm.display_name.trim(),
      name: inverterForm.display_name.trim() || inverterForm.model.trim() || inverterForm.manufacturer.trim(),
      type: inverterForm.type,
      battery_voltage_type:
        inverterForm.type === "hybrid" ? inverterForm.battery_voltage_type || null : null,
      max_pv_kw: Number(inverterForm.max_pv_kw),
      price_net: Number(inverterForm.price_net),
      catalog_card_url: inverterForm.catalog_card_url.trim() || null,
      active: true,
    });

    if (error) {
      console.error("Błąd dodawania falownika", error);
      setInvertersStatus(`Błąd dodawania falownika: ${error.message}`);
      return;
    }

    setInverterForm(EMPTY_INVERTER_FORM);
    setInvertersStatus("Dodano falownik");
    loadInverters();
  }

  async function deleteInverter(inverterId: number) {
    if (!confirm("Usunąć ten falownik z panelu admina? Rekord zostanie ukryty, ale zostanie w bazie.")) return;

    const { error } = await supabase
      .from("inverters")
      .update({ active: false })
      .eq("id", inverterId);

    if (error) {
      setInvertersStatus(`Błąd ukrywania falownika: ${error.message}`);
      return;
    }

    setInvertersStatus("Falownik został ukryty w panelu admina");
    loadInverters();
  }

  async function updateStorage(
    storageId: number,
    field: keyof StorageItem,
    value: string | number | boolean
  ) {
    setStorages((current) =>
      current.map((storage) =>
        storage.id === storageId
          ? {
            ...storage,
            [field]: value,
          }
          : storage
      )
    );

    setStoragesStatus("Masz niezapisane zmiany w magazynach");
  }

  async function saveStorages() {
    setStoragesStatus("Zapisywanie magazynów...");

    for (const storage of storages) {
      const { error } = await supabase
        .from("storages")
        .update({
          code: storage.code,
          manufacturer: storage.manufacturer,
          model: storage.model,
          display_name: storage.display_name,
          name: storage.display_name || storage.model || storage.code,
          capacity_kwh: parseDecimal(storage.capacity_kwh),
          voltage_type: storage.voltage_type || "low_voltage",
          price_net: parseDecimal(storage.price_net),
          installation_net: parseDecimal(storage.installation_net),
          catalog_card_url: storage.catalog_card_url?.trim() || null,
          active: Boolean(storage.active),
        })
        .eq("id", storage.id);

      if (error) {
        console.error("Błąd zapisu magazynów", error);
        setStoragesStatus(`Błąd zapisu magazynów: ${error.message}`);
        return;
      }
    }

    setStoragesStatus("Magazyny zapisane do Supabase");
    loadStorages();
  }

  async function addStorage() {
    setStoragesStatus("");

    if (!storageForm.code || !storageForm.display_name) {
      setStoragesStatus("Uzupełnij kod i nazwę wyświetlaną magazynu");
      return;
    }

    const { error } = await supabase.from("storages").insert({
      code: storageForm.code.trim().toUpperCase().replaceAll(" ", "_"),
      manufacturer: storageForm.manufacturer.trim(),
      model: storageForm.model.trim(),
      display_name: storageForm.display_name.trim(),
      name: storageForm.display_name.trim() || storageForm.model.trim() || storageForm.code.trim(),
      capacity_kwh: parseDecimal(storageForm.capacity_kwh),
      voltage_type: storageForm.voltage_type,
      price_net: parseDecimal(storageForm.price_net),
      installation_net: parseDecimal(storageForm.installation_net),
      catalog_card_url: storageForm.catalog_card_url.trim() || null,
      active: true,
    });

    if (error) {
      console.error("Błąd dodawania magazynu", error);
      setStoragesStatus(`Błąd dodawania magazynu: ${error.message}`);
      return;
    }

    setStorageForm(EMPTY_STORAGE_FORM);
    setStoragesStatus("Dodano magazyn");
    loadStorages();
  }

  async function deleteStorage(storageId: number) {
    if (!confirm("Usunąć ten magazyn energii z panelu admina? Rekord zostanie ukryty, ale zostanie w bazie.")) return;

    const { error } = await supabase
      .from("storages")
      .update({ active: false })
      .eq("id", storageId);

    if (error) {
      setStoragesStatus(`Błąd ukrywania magazynu: ${error.message}`);
      return;
    }

    setStoragesStatus("Magazyn energii został ukryty w panelu admina");
    loadStorages();
  }

  return (
    <section className="relative mt-8 overflow-hidden rounded-3xl border border-blue-100 bg-white p-6 shadow-lg shadow-slate-200/70 ring-1 ring-blue-50">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-blue-500 via-emerald-400 to-cyan-400" />
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
            Panel administracyjny
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">Panel admina cen</h2>

          <p className="mt-2 text-sm text-slate-500">
            Zmień wartości, a potem kliknij „Zapisz ustawienia”. Zapis trafia globalnie do Supabase.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-slate-500">{adminStatus}</span>

          {activeTab === "global" && (
            <button
              type="button"
              onClick={() => savePricingSettings(pricingOverrides)}
              className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-100 transition hover:from-emerald-500 hover:to-teal-400"
            >
              Zapisz ustawienia
            </button>
          )}

          {activeTab === "panels" && (
            <button
              type="button"
              onClick={savePanels}
              className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-100 transition hover:from-emerald-500 hover:to-teal-400"
            >
              Zapisz panele
            </button>
          )}
          {activeTab === "inverters" && (
            <button
              type="button"
              onClick={saveInverters}
              className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-100 transition hover:from-emerald-500 hover:to-teal-400"
            >
              Zapisz falowniki
            </button>
          )}

          {activeTab === "storages" && (
            <button
              type="button"
              onClick={saveStorages}
              className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-100 transition hover:from-emerald-500 hover:to-teal-400"
            >
              Zapisz magazyny
            </button>
          )}

          {activeTab === "additionalServices" && (
            <button
              type="button"
              onClick={saveAdditionalServices}
              className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-100 transition hover:from-emerald-500 hover:to-teal-400"
            >
              Zapisz usługi dodatkowe
            </button>
          )}

          {activeTab === "global" && (
            <button
              type="button"
              onClick={resetPricingOverrides}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-800"
            >
              Przywróć domyślne
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab("global")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${activeTab === "global"
            ? "bg-emerald-600 text-white shadow-md shadow-emerald-100"
            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
        >
          Koszty globalne
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("panels")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${activeTab === "panels"
            ? "bg-emerald-600 text-white shadow-md shadow-emerald-100"
            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
        >
          Panele
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("inverters")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${activeTab === "inverters"
            ? "bg-emerald-600 text-white shadow-md shadow-emerald-100"
            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
        >
          Falowniki
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("storages")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${activeTab === "storages"
            ? "bg-emerald-600 text-white shadow-md shadow-emerald-100"
            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
        >
          Magazyny energii
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("additionalServices")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${activeTab === "additionalServices"
            ? "bg-emerald-600 text-white shadow-md shadow-emerald-100"
            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
        >
          Usługi dodatkowe
        </button>
      </div>

      {activeTab === "global" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Montaż PV netto / kWp</span>
            <input
              type="number"
              value={pricingOverrides.installation.pvPerKwNet}
              onChange={(e) =>
                updatePricingValue(["installation", "pvPerKwNet"], e.target.value)
              }
              className="w-full mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Zabezpieczenia</span>
            <input
              type="number"
              value={pricingOverrides.placeholders.protections}
              onChange={(e) =>
                updatePricingValue(["placeholders", "protections"], e.target.value)
              }
              className="w-full mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Okablowanie</span>
            <input
              type="number"
              value={pricingOverrides.placeholders.wiring}
              onChange={(e) =>
                updatePricingValue(["placeholders", "wiring"], e.target.value)
              }
              className="w-full mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Transport</span>
            <input
              type="number"
              value={pricingOverrides.placeholders.transport}
              onChange={(e) =>
                updatePricingValue(["placeholders", "transport"], e.target.value)
              }
              className="w-full mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Dokumentacja</span>
            <input
              type="number"
              value={pricingOverrides.placeholders.documentation}
              onChange={(e) =>
                updatePricingValue(["placeholders", "documentation"], e.target.value)
              }
              className="w-full mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Marketing</span>
            <input
              type="number"
              value={pricingOverrides.margins.marketing}
              onChange={(e) =>
                updatePricingValue(["margins", "marketing"], e.target.value)
              }
              className="w-full mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Rękojmia operatora %</span>
            <input
              type="number"
              value={pricingOverrides.operator.percent}
              onChange={(e) =>
                updatePricingValue(["operator", "percent"], e.target.value)
              }
              className="w-full mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <div className="md:col-span-2 xl:col-span-3 mt-2">
            <div className="rounded-3xl border border-blue-100 bg-blue-50/40 p-5">
              <h3 className="text-lg font-semibold text-slate-900">
                Marże ownerów i managerów
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Globalne ustawienia marż ownerów oraz nadprowizji managerów sprzedaży.
              </p>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    Liczba ownerów
                  </span>

                  <input
                    type="number"
                    value={pricingOverrides.margins.ownersCount}
                    onChange={(e) =>
                      updatePricingValue(
                        ["margins", "ownersCount"],
                        e.target.value
                      )
                    }
                    className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    PV &lt; 5 kWp — stawka za kWp
                  </span>

                  <input
                    type="number"
                    value={pricingOverrides.margins.pvSmallPerKw}
                    onChange={(e) =>
                      updatePricingValue(
                        ["margins", "pvSmallPerKw"],
                        e.target.value
                      )
                    }
                    className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    PV &lt; 5 kWp — stawka stała
                  </span>

                  <input
                    type="number"
                    value={pricingOverrides.margins.pvSmallFixed}
                    onChange={(e) =>
                      updatePricingValue(
                        ["margins", "pvSmallFixed"],
                        e.target.value
                      )
                    }
                    className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    PV &gt; 5 kWp — stawka za kWp
                  </span>

                  <input
                    type="number"
                    value={pricingOverrides.margins.pvLargePerKw}
                    onChange={(e) =>
                      updatePricingValue(
                        ["margins", "pvLargePerKw"],
                        e.target.value
                      )
                    }
                    className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    PV &gt; 5 kWp — stawka stała
                  </span>

                  <input
                    type="number"
                    value={pricingOverrides.margins.pvLargeFixed}
                    onChange={(e) =>
                      updatePricingValue(
                        ["margins", "pvLargeFixed"],
                        e.target.value
                      )
                    }
                    className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    Magazyn energii — stawka per owner
                  </span>

                  <input
                    type="number"
                    value={pricingOverrides.margins.storagePerOwner}
                    onChange={(e) =>
                      updatePricingValue(
                        ["margins", "storagePerOwner"],
                        e.target.value
                      )
                    }
                    className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    Manager Fee (kwota)
                  </span>

                  <input
                    type="number"
                    value={pricingOverrides.margins.managerFeeNet}
                    onChange={(e) =>
                      updatePricingValue(
                        ["margins", "managerFeeNet"],
                        e.target.value
                      )
                    }
                    className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === "panels" ? (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-sm">
            <h3 className="mb-4 text-xl font-bold text-slate-950">Dodaj panel</h3>

            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                placeholder="Kod, np. JA_SOLAR_455"
                value={panelForm.code}
                onChange={(e) => setPanelForm({ ...panelForm, code: e.target.value })}
              />

              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                placeholder="Producent"
                value={panelForm.manufacturer}
                onChange={(e) => setPanelForm({ ...panelForm, manufacturer: e.target.value })}
              />

              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                placeholder="Model"
                value={panelForm.model}
                onChange={(e) => setPanelForm({ ...panelForm, model: e.target.value })}
              />

              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                placeholder="Nazwa wyświetlana"
                value={panelForm.display_name}
                onChange={(e) => setPanelForm({ ...panelForm, display_name: e.target.value })}
              />


              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                type="number"
                placeholder="Moc Wp"
                value={panelForm.power_wp}
                onChange={(e) => setPanelForm({ ...panelForm, power_wp: e.target.value })}
              />

              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                type="number"
                placeholder="Cena netto"
                value={panelForm.price_net}
                onChange={(e) => setPanelForm({ ...panelForm, price_net: e.target.value })}
              />

              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 md:col-span-7"
                placeholder="Link do karty katalogowej SharePoint"
                value={panelForm.catalog_card_url}
                onChange={(e) => setPanelForm({ ...panelForm, catalog_card_url: e.target.value })}
              />
            </div>

            <button
              type="button"
              onClick={addPanel}
              className="mt-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-100 transition hover:from-emerald-500 hover:to-teal-400"
            >
              Dodaj panel
            </button>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 className="text-xl font-bold text-slate-950">Panele w bazie</h3>
              <span className="text-sm text-slate-500">{panelsStatus}</span>
            </div>

            <div className="space-y-3">
              {panels.map((panel) => (
                <div
                  key={panel.id}
                  className="grid grid-cols-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-10"
                >
                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={panel.code}
                    onChange={(e) => updatePanel(panel.id, "code", e.target.value)}
                  />

                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={panel.manufacturer || ""}
                    onChange={(e) => updatePanel(panel.id, "manufacturer", e.target.value)}
                  />

                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={panel.model || ""}
                    onChange={(e) => updatePanel(panel.id, "model", e.target.value)}
                  />

                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={panel.display_name || ""}
                    onChange={(e) => updatePanel(panel.id, "display_name", e.target.value)}
                  />



                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    type="number"
                    value={panel.power_wp}
                    onChange={(e) => updatePanel(panel.id, "power_wp", Number(e.target.value))}
                  />

                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    type="number"
                    value={panel.price_net}
                    onChange={(e) => updatePanel(panel.id, "price_net", Number(e.target.value))}
                  />

                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 lg:col-span-2"
                    placeholder="Link do karty katalogowej"
                    value={panel.catalog_card_url || ""}
                    onChange={(e) => updatePanel(panel.id, "catalog_card_url", e.target.value)}
                  />

                  <button
                    type="button"
                    onClick={() => updatePanel(panel.id, "active", !panel.active)}
                    className={`px-3 py-2 rounded-xl text-sm font-bold ${panel.active
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}
                  >
                    {panel.active ? "Aktywny" : "Nieaktywny"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePanel(panel.id)}
                    className="h-7 w-7 flex items-center justify-center rounded-lg text-xs font-bold bg-red-50 text-red-700 border border-red-100 hover:bg-red-100"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : activeTab === "inverters" ? (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-sm">
            <h3 className="mb-4 text-xl font-bold text-slate-950">Dodaj falownik</h3>

            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                placeholder="Producent"
                value={inverterForm.manufacturer}
                onChange={(e) =>
                  setInverterForm({ ...inverterForm, manufacturer: e.target.value })
                }
              />

              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                placeholder="Model"
                value={inverterForm.model}
                onChange={(e) =>
                  setInverterForm({ ...inverterForm, model: e.target.value })
                }
              />

              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                placeholder="Nazwa wyświetlana"
                value={inverterForm.display_name}
                onChange={(e) =>
                  setInverterForm({ ...inverterForm, display_name: e.target.value })
                }
              />

              <select
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                value={inverterForm.type}
                onChange={(e) =>
                  setInverterForm({ ...inverterForm, type: e.target.value })
                }
              >
                <option value="ongrid">Sieciowy</option>
                <option value="hybrid">Hybrydowy</option>
              </select>

              <select
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                value={inverterForm.battery_voltage_type}
                onChange={(e) =>
                  setInverterForm({ ...inverterForm, battery_voltage_type: e.target.value })
                }
              >
                <option value="">Nie dotyczy</option>
                <option value="low_voltage">LV - niskonapięciowy</option>
                <option value="high_voltage">HV - wysokonapięciowy</option>
              </select>

              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                type="number"
                placeholder="Max PV kWp"
                value={inverterForm.max_pv_kw}
                onChange={(e) =>
                  setInverterForm({ ...inverterForm, max_pv_kw: e.target.value })
                }
              />

              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                type="number"
                placeholder="Cena netto"
                value={inverterForm.price_net}
                onChange={(e) =>
                  setInverterForm({ ...inverterForm, price_net: e.target.value })
                }
              />

              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 md:col-span-7"
                placeholder="Link do karty katalogowej SharePoint"
                value={inverterForm.catalog_card_url}
                onChange={(e) =>
                  setInverterForm({ ...inverterForm, catalog_card_url: e.target.value })
                }
              />
            </div>

            <button
              type="button"
              onClick={addInverter}
              className="mt-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-100 transition hover:from-emerald-500 hover:to-teal-400"
            >
              Dodaj falownik
            </button>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 className="text-xl font-bold text-slate-950">Falowniki w bazie</h3>
              <span className="text-sm text-slate-500">{invertersStatus}</span>
            </div>

            <div className="space-y-3">
              {inverters.map((inverter) => (
                <div
                  key={inverter.id}
                  className="grid grid-cols-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-9"
                >
                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={inverter.manufacturer || ""}
                    onChange={(e) =>
                      updateInverter(inverter.id, "manufacturer", e.target.value)
                    }
                  />

                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={inverter.model || ""}
                    onChange={(e) =>
                      updateInverter(inverter.id, "model", e.target.value)
                    }
                  />

                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={inverter.display_name || ""}
                    onChange={(e) =>
                      updateInverter(inverter.id, "display_name", e.target.value)
                    }
                  />

                  <select
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={inverter.type}
                    onChange={(e) =>
                      updateInverter(inverter.id, "type", e.target.value)
                    }
                  >

                    <option value="ongrid">Sieciowy</option>
                    <option value="hybrid">Hybrydowy</option>
                  </select>

                  <select
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={inverter.battery_voltage_type || ""}
                    onChange={(e) =>
                      updateInverter(
                        inverter.id,
                        "battery_voltage_type",
                        e.target.value ? e.target.value : null
                      )
                    }
                  >
                    <option value="">Nie dotyczy</option>
                    <option value="low_voltage">LV</option>
                    <option value="high_voltage">HV</option>
                  </select>



                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    type="number"
                    value={inverter.max_pv_kw}
                    onChange={(e) =>
                      updateInverter(
                        inverter.id,
                        "max_pv_kw",
                        Number(e.target.value)
                      )
                    }
                  />

                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    type="number"
                    value={inverter.price_net}
                    onChange={(e) =>
                      updateInverter(
                        inverter.id,
                        "price_net",
                        Number(e.target.value)
                      )
                    }
                  />

                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 lg:col-span-2"
                    placeholder="Link do karty katalogowej"
                    value={inverter.catalog_card_url || ""}
                    onChange={(e) =>
                      updateInverter(inverter.id, "catalog_card_url", e.target.value)
                    }
                  />

                  <button
                    type="button"
                    onClick={() =>
                      updateInverter(inverter.id, "active", !inverter.active)
                    }
                    className={`px-3 py-2 rounded-xl text-sm font-bold ${inverter.active
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}
                  >
                    {inverter.active ? "Aktywny" : "Nieaktywny"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteInverter(inverter.id)}
                    className="h-7 w-7 flex items-center justify-center rounded-lg text-xs font-bold bg-red-50 text-red-700 border border-red-100 hover:bg-red-100"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : activeTab === "storages" ? (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-sm">
            <h3 className="mb-4 text-xl font-bold text-slate-950">Dodaj magazyn energii</h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                placeholder="Kod, np. ZBPOWER_10"
                value={storageForm.code}
                onChange={(e) =>
                  setStorageForm({ ...storageForm, code: e.target.value })
                }
              />

              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                placeholder="Producent"
                value={storageForm.manufacturer}
                onChange={(e) =>
                  setStorageForm({ ...storageForm, manufacturer: e.target.value })
                }
              />

              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                placeholder="Model"
                value={storageForm.model}
                onChange={(e) =>
                  setStorageForm({ ...storageForm, model: e.target.value })
                }
              />

              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                placeholder="Nazwa wyświetlana"
                value={storageForm.display_name}
                onChange={(e) =>
                  setStorageForm({ ...storageForm, display_name: e.target.value })
                }
              />


              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                type="number"
                step="0.01"
                min="0"
                placeholder="Pojemność kWh"

                value={storageForm.capacity_kwh}
                onChange={(e) =>
                  setStorageForm({ ...storageForm, capacity_kwh: e.target.value })
                }
              />
              <select
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                value={storageForm.voltage_type}
                onChange={(e) =>
                  setStorageForm({ ...storageForm, voltage_type: e.target.value })
                }
              >
                <option value="low_voltage">LV - niskonapięciowy</option>
                <option value="high_voltage">HV - wysokonapięciowy</option>
              </select>
              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                type="number"
                step="0.01"
                min="0"
                placeholder="Cena netto"
                value={storageForm.price_net}
                onChange={(e) =>
                  setStorageForm({ ...storageForm, price_net: e.target.value })
                }
              />

              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                type="number"
                step="0.01"
                min="0"
                placeholder="Montaż netto"
                value={storageForm.installation_net}
                onChange={(e) =>
                  setStorageForm({ ...storageForm, installation_net: e.target.value })
                }
              />

              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 md:col-span-4"
                placeholder="Link do karty katalogowej SharePoint"
                value={storageForm.catalog_card_url}
                onChange={(e) =>
                  setStorageForm({ ...storageForm, catalog_card_url: e.target.value })
                }
              />
            </div>

            <button
              type="button"
              onClick={addStorage}
              className="mt-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-100 transition hover:from-emerald-500 hover:to-teal-400"
            >
              Dodaj magazyn
            </button>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 className="text-xl font-bold text-slate-950">Magazyny w bazie</h3>
              <span className="text-sm text-slate-500">{storagesStatus}</span>
            </div>

            <div className="space-y-3">
              {storages.map((storage) => (
                <div
                  key={storage.id}
                  className="grid grid-cols-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-10"
                >
                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={storage.code}
                    onChange={(e) =>
                      updateStorage(storage.id, "code", e.target.value)
                    }
                  />

                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={storage.manufacturer || ""}
                    onChange={(e) =>
                      updateStorage(storage.id, "manufacturer", e.target.value)
                    }
                  />

                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={storage.model || ""}
                    onChange={(e) =>
                      updateStorage(storage.id, "model", e.target.value)
                    }
                  />

                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={storage.display_name || ""}
                    onChange={(e) =>
                      updateStorage(storage.id, "display_name", e.target.value)
                    }
                  />



                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    type="number"
                    step="0.01"
                    min="0"
                    value={storage.capacity_kwh}
                    onChange={(e) =>
                      updateStorage(
                        storage.id,
                        "capacity_kwh",
                        parseDecimal(e.target.value)
                      )
                    }
                  />
                  <select
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={storage.voltage_type || "low_voltage"}
                    onChange={(e) =>
                      updateStorage(
                        storage.id,
                        "voltage_type",
                        e.target.value as "low_voltage" | "high_voltage"
                      )
                    }
                  >
                    <option value="low_voltage">LV</option>
                    <option value="high_voltage">HV</option>
                  </select>
                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    type="number"
                    step="0.01"
                    min="0"
                    value={storage.price_net}
                    onChange={(e) =>
                      updateStorage(
                        storage.id,
                        "price_net",
                        parseDecimal(e.target.value)
                      )
                    }
                  />

                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    type="number"
                    step="0.01"
                    min="0"
                    value={storage.installation_net}
                    onChange={(e) =>
                      updateStorage(
                        storage.id,
                        "installation_net",
                        parseDecimal(e.target.value)
                      )
                    }
                  />

                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 lg:col-span-2"
                    placeholder="Link do karty katalogowej"
                    value={storage.catalog_card_url || ""}
                    onChange={(e) =>
                      updateStorage(storage.id, "catalog_card_url", e.target.value)
                    }
                  />

                  <button
                    type="button"
                    onClick={() =>
                      updateStorage(storage.id, "active", !storage.active)
                    }
                    className={`px-3 py-2 rounded-xl text-sm font-bold ${storage.active
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}
                  >
                    {storage.active ? "Aktywny" : "Nieaktywny"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteStorage(storage.id)}
                    className="h-7 w-7 flex items-center justify-center rounded-lg text-xs font-bold bg-red-50 text-red-700 border border-red-100 hover:bg-red-100"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-sm">
            <h3 className="mb-4 text-xl font-bold text-slate-950">Dodaj usługę dodatkową</h3>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 md:col-span-2"
                placeholder="Nazwa, np. Optymalizator mocy"
                value={additionalServiceForm.name}
                onChange={(e) =>
                  setAdditionalServiceForm({
                    ...additionalServiceForm,
                    name: e.target.value,
                  })
                }
              />

              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                type="number"
                step="0.01"
                min="0"
                placeholder="Cena netto"
                value={additionalServiceForm.price_net}
                onChange={(e) =>
                  setAdditionalServiceForm({
                    ...additionalServiceForm,
                    price_net: e.target.value,
                  })
                }
              />
              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                placeholder="Jednostka, np. szt., mb, m²"
                value={additionalServiceForm.unit_label}
                onChange={(e) =>
                  setAdditionalServiceForm({
                    ...additionalServiceForm,
                    unit_label: e.target.value,
                  })
                }
              />

              <button
                type="button"
                onClick={() =>
                  setAdditionalServiceForm({
                    ...additionalServiceForm,
                    allows_quantity: !additionalServiceForm.allows_quantity,
                  })
                }
                className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${additionalServiceForm.allows_quantity
                  ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                  : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
              >
                {additionalServiceForm.allows_quantity
                  ? `Ilość ${additionalServiceForm.unit_label || "szt."}: tak`
                  : "Ilość: nie"}
              </button>
            </div>

            <button
              type="button"
              onClick={addAdditionalService}
              className="mt-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-100 transition hover:from-emerald-500 hover:to-teal-400"
            >
              Dodaj usługę
            </button>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="text-xl font-bold text-slate-950">Usługi dodatkowe w bazie</h3>
              <span className="text-sm text-slate-500">{additionalServicesStatus}</span>
            </div>

            <div className="space-y-3">
              {additionalServices.map((service) => (
                <div
                  key={service.id}
                  className="grid grid-cols-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-7"
                >
                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 lg:col-span-2"
                    value={service.name}
                    onChange={(e) =>
                      updateAdditionalService(service.id, "name", e.target.value)
                    }
                  />

                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    type="number"
                    step="0.01"
                    min="0"
                    value={service.price_net}
                    onChange={(e) =>
                      updateAdditionalService(
                        service.id,
                        "price_net",
                        parseDecimal(e.target.value)
                      )
                    }
                  />
                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={service.unit_label || "szt."}
                    onChange={(e) =>
                      updateAdditionalService(service.id, "unit_label", e.target.value)
                    }
                  />

                  <button
                    type="button"
                    onClick={() =>
                      updateAdditionalService(
                        service.id,
                        "allows_quantity",
                        !service.allows_quantity
                      )
                    }
                    className={`px-3 py-2 rounded-xl text-sm font-bold ${service.allows_quantity
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}
                  >
                    {service.allows_quantity ? `Ilość ${service.unit_label || "szt."}` : "Bez ilości"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      updateAdditionalService(service.id, "active", !service.active)
                    }
                    className={`px-3 py-2 rounded-xl text-sm font-bold ${service.active
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}
                  >
                    {service.active ? "Aktywna" : "Nieaktywna"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteAdditionalService(service.id)}
                    className="h-7 w-7 flex items-center justify-center rounded-lg text-xs font-bold bg-red-50 text-red-700 border border-red-100 hover:bg-red-100"
                  >
                    ×
                  </button>

                  <div className="text-xs font-medium text-slate-400">
                    ID: {service.id}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}