"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";


type PanelItem = {
  id: number;
  code: string;
  name: string;
  power_wp: number;
  price_net: number;
  active: boolean;
};

type InverterItem = {
  id: number;
  name: string;
  type: string;
  max_pv_kw: number;
  price_net: number;
  active: boolean;
};

type StorageItem = {
  id: number;
  code: string;
  name: string;
  capacity_kwh: number;
  price_net: number;
  installation_net: number;
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
  name: "",
  power_wp: "450",
  price_net: "0",
};

const EMPTY_INVERTER_FORM = {
  name: "",
  type: "ongrid",
  max_pv_kw: "10",
  price_net: "0",
};

const EMPTY_STORAGE_FORM = {
  code: "",
  name: "",
  capacity_kwh: "10",
  price_net: "0",
  installation_net: "1500",
};

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

  async function loadPanels() {
    const { data, error } = await supabase
      .from("panels")
      .select("id, code, name, power_wp, price_net, active")
      .order("active", { ascending: false })
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
      .select("id, name, type, max_pv_kw, price_net, active")
      .order("active", { ascending: false })
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
      .select("id, code, name, capacity_kwh, price_net, installation_net, active")
      .order("active", { ascending: false })
      .order("capacity_kwh", { ascending: true });

    if (error) {
      console.error("Błąd ładowania magazynów", error);
      setStoragesStatus(`Błąd ładowania magazynów: ${error.message}`);
      return;
    }

    setStorages((data || []) as StorageItem[]);
  }

  useEffect(() => {
    loadPanels();
    loadInverters();
    loadStorages();
  }, []);

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
          name: panel.name,
          power_wp: Number(panel.power_wp),
          price_net: Number(panel.price_net),
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

    if (!panelForm.code || !panelForm.name) {
      setPanelsStatus("Uzupełnij kod i nazwę panelu");
      return;
    }

    const { error } = await supabase.from("panels").insert({
      code: panelForm.code.trim().toUpperCase().replaceAll(" ", "_"),
      name: panelForm.name.trim(),
      power_wp: Number(panelForm.power_wp),
      price_net: Number(panelForm.price_net),
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

  async function updateInverter(
    inverterId: number,
    field: keyof InverterItem,
    value: string | number | boolean
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
          name: inverter.name,
          type: inverter.type,
          max_pv_kw: Number(inverter.max_pv_kw),
          price_net: Number(inverter.price_net),
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

    if (!inverterForm.name) {
      setInvertersStatus("Uzupełnij nazwę falownika");
      return;
    }

    const { error } = await supabase.from("inverters").insert({
      name: inverterForm.name.trim(),
      type: inverterForm.type,
      max_pv_kw: Number(inverterForm.max_pv_kw),
      price_net: Number(inverterForm.price_net),
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
          name: storage.name,
          capacity_kwh: Number(storage.capacity_kwh),
          price_net: Number(storage.price_net),
          installation_net: Number(storage.installation_net),
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

    if (!storageForm.code || !storageForm.name) {
      setStoragesStatus("Uzupełnij kod i nazwę magazynu");
      return;
    }

    const { error } = await supabase.from("storages").insert({
      code: storageForm.code.trim().toUpperCase().replaceAll(" ", "_"),
      name: storageForm.name.trim(),
      capacity_kwh: Number(storageForm.capacity_kwh),
      price_net: Number(storageForm.price_net),
      installation_net: Number(storageForm.installation_net),
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
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "global"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-100"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Koszty globalne
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("panels")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "panels"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-100"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Panele
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("inverters")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "inverters"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-100"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Falowniki
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("storages")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "storages"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-100"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Magazyny energii
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
        </div>
      ) : activeTab === "panels" ? (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-sm">
            <h3 className="mb-4 text-xl font-bold text-slate-950">Dodaj panel</h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                placeholder="Kod, np. JA_SOLAR_455"
                value={panelForm.code}
                onChange={(e) => setPanelForm({ ...panelForm, code: e.target.value })}
              />

              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                placeholder="Nazwa panelu"
                value={panelForm.name}
                onChange={(e) => setPanelForm({ ...panelForm, name: e.target.value })}
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
                  className="grid grid-cols-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-6"
                >
                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={panel.code}
                    onChange={(e) => updatePanel(panel.id, "code", e.target.value)}
                  />

                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 lg:col-span-2"
                    value={panel.name}
                    onChange={(e) => updatePanel(panel.id, "name", e.target.value)}
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

                  <button
                    type="button"
                    onClick={() => updatePanel(panel.id, "active", !panel.active)}
                    className={`px-3 py-2 rounded-xl text-sm font-bold ${
                      panel.active
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-500 border border-slate-200"
                    }`}
                  >
                    {panel.active ? "Aktywny" : "Nieaktywny"}
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

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                placeholder="Nazwa falownika"
                value={inverterForm.name}
                onChange={(e) =>
                  setInverterForm({ ...inverterForm, name: e.target.value })
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
                  className="grid grid-cols-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-6"
                >
                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 lg:col-span-2"
                    value={inverter.name}
                    onChange={(e) =>
                      updateInverter(inverter.id, "name", e.target.value)
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

                  <button
                    type="button"
                    onClick={() =>
                      updateInverter(inverter.id, "active", !inverter.active)
                    }
                    className={`px-3 py-2 rounded-xl text-sm font-bold ${
                      inverter.active
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-500 border border-slate-200"
                    }`}
                  >
                    {inverter.active ? "Aktywny" : "Nieaktywny"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-sm">
            <h3 className="mb-4 text-xl font-bold text-slate-950">Dodaj magazyn energii</h3>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
                placeholder="Nazwa magazynu"
                value={storageForm.name}
                onChange={(e) =>
                  setStorageForm({ ...storageForm, name: e.target.value })
                }
              />

              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                type="number"
                placeholder="Pojemność kWh"
                value={storageForm.capacity_kwh}
                onChange={(e) =>
                  setStorageForm({ ...storageForm, capacity_kwh: e.target.value })
                }
              />

              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                type="number"
                placeholder="Cena netto"
                value={storageForm.price_net}
                onChange={(e) =>
                  setStorageForm({ ...storageForm, price_net: e.target.value })
                }
              />

              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                type="number"
                placeholder="Montaż netto"
                value={storageForm.installation_net}
                onChange={(e) =>
                  setStorageForm({ ...storageForm, installation_net: e.target.value })
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
                  className="grid grid-cols-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-7"
                >
                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={storage.code}
                    onChange={(e) =>
                      updateStorage(storage.id, "code", e.target.value)
                    }
                  />

                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 lg:col-span-2"
                    value={storage.name}
                    onChange={(e) =>
                      updateStorage(storage.id, "name", e.target.value)
                    }
                  />

                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    type="number"
                    value={storage.capacity_kwh}
                    onChange={(e) =>
                      updateStorage(
                        storage.id,
                        "capacity_kwh",
                        Number(e.target.value)
                      )
                    }
                  />

                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    type="number"
                    value={storage.price_net}
                    onChange={(e) =>
                      updateStorage(
                        storage.id,
                        "price_net",
                        Number(e.target.value)
                      )
                    }
                  />

                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    type="number"
                    value={storage.installation_net}
                    onChange={(e) =>
                      updateStorage(
                        storage.id,
                        "installation_net",
                        Number(e.target.value)
                      )
                    }
                  />

                  <button
                    type="button"
                    onClick={() =>
                      updateStorage(storage.id, "active", !storage.active)
                    }
                    className={`px-3 py-2 rounded-xl text-sm font-bold ${
                      storage.active
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-500 border border-slate-200"
                    }`}
                  >
                    {storage.active ? "Aktywny" : "Nieaktywny"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
