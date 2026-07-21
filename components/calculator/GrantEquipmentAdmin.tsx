"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Tab = "panels" | "inverters" | "heatPumps";

type GrantPanel = {
  id: number;
  manufacturer: string;
  model: string;
  power_wp: number;
  price_net: number;
  installation_scope: "roof" | "ground" | "both";
  catalog_card_url: string | null;
  active: boolean;
};

type GrantInverter = {
  id: number;
  manufacturer: string;
  model: string;
  power_kw: number;
  phase_count: number;
  price_net: number;
  catalog_card_url: string | null;
  program_compliant: boolean;
  active: boolean;
};

type GrantHeatPump = {
  id: number;
  manufacturer: string;
  model: string;
  power_kw: number;
  pump_type: "monoblock" | "split";
  price_net: number;
  cop: number | null;
  zum_compliant: boolean;
  zum_url: string | null;
  catalog_card_url: string | null;
  active: boolean;
};

const EMPTY_PANEL = {
  manufacturer: "",
  model: "",
  power_wp: "450",
  price_net: "0",
  installation_scope: "roof" as "roof" | "ground" | "both",
  catalog_card_url: "",
};

const EMPTY_INVERTER = {
  manufacturer: "",
  model: "",
  power_kw: "10",
  phase_count: "3",
  price_net: "0",
  catalog_card_url: "",
  program_compliant: true,
};

const EMPTY_HEAT_PUMP = {
  manufacturer: "",
  model: "",
  power_kw: "8",
  pump_type: "monoblock" as "monoblock" | "split",
  price_net: "0",
  cop: "",
  zum_compliant: false,
  zum_url: "",
  catalog_card_url: "",
};

function numberValue(value: string | number) {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400";

export default function GrantEquipmentAdmin() {
  const [tab, setTab] = useState<Tab>("panels");
  const [panels, setPanels] = useState<GrantPanel[]>([]);
  const [inverters, setInverters] = useState<GrantInverter[]>([]);
  const [heatPumps, setHeatPumps] = useState<GrantHeatPump[]>([]);
  const [panelForm, setPanelForm] = useState(EMPTY_PANEL);
  const [inverterForm, setInverterForm] = useState(EMPTY_INVERTER);
  const [heatPumpForm, setHeatPumpForm] = useState(EMPTY_HEAT_PUMP);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadCatalogs() {
    const [panelResult, inverterResult, heatPumpResult] = await Promise.all([
      supabase.from("grant_panels").select("id, manufacturer, model, power_wp, price_net, installation_scope, catalog_card_url, active").order("active", { ascending: false }).order("manufacturer"),
      supabase.from("grant_inverters").select("id, manufacturer, model, power_kw, phase_count, price_net, catalog_card_url, program_compliant, active").order("active", { ascending: false }).order("power_kw"),
      supabase.from("grant_heat_pumps").select("id, manufacturer, model, power_kw, pump_type, price_net, cop, zum_compliant, zum_url, catalog_card_url, active").order("active", { ascending: false }).order("power_kw"),
    ]);

    const error = panelResult.error || inverterResult.error || heatPumpResult.error;
    if (error) {
      console.error("Błąd ładowania katalogów grantowych", error);
      setStatus(`Błąd ładowania urządzeń: ${error.message}`);
      return;
    }

    setPanels((panelResult.data || []) as GrantPanel[]);
    setInverters((inverterResult.data || []) as GrantInverter[]);
    setHeatPumps((heatPumpResult.data || []) as GrantHeatPump[]);
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCatalogs();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  async function addPanel() {
    if (!panelForm.manufacturer.trim() || !panelForm.model.trim()) {
      setStatus("Uzupełnij producenta i model panelu");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("grant_panels").insert({
      manufacturer: panelForm.manufacturer.trim(),
      model: panelForm.model.trim(),
      power_wp: numberValue(panelForm.power_wp),
      price_net: numberValue(panelForm.price_net),
      installation_scope: panelForm.installation_scope,
      catalog_card_url: panelForm.catalog_card_url.trim() || null,
    });
    setBusy(false);
    if (error) return setStatus(`Błąd dodawania panelu: ${error.message}`);
    setPanelForm(EMPTY_PANEL);
    setStatus("Panel został dodany");
    await loadCatalogs();
  }

  async function addInverter() {
    if (!inverterForm.manufacturer.trim() || !inverterForm.model.trim()) {
      setStatus("Uzupełnij producenta i model falownika");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("grant_inverters").insert({
      manufacturer: inverterForm.manufacturer.trim(),
      model: inverterForm.model.trim(),
      power_kw: numberValue(inverterForm.power_kw),
      phase_count: numberValue(inverterForm.phase_count),
      price_net: numberValue(inverterForm.price_net),
      catalog_card_url: inverterForm.catalog_card_url.trim() || null,
      program_compliant: inverterForm.program_compliant,
    });
    setBusy(false);
    if (error) return setStatus(`Błąd dodawania falownika: ${error.message}`);
    setInverterForm(EMPTY_INVERTER);
    setStatus("Falownik został dodany");
    await loadCatalogs();
  }

  async function addHeatPump() {
    if (!heatPumpForm.manufacturer.trim() || !heatPumpForm.model.trim()) {
      setStatus("Uzupełnij producenta i model pompy ciepła");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("grant_heat_pumps").insert({
      manufacturer: heatPumpForm.manufacturer.trim(),
      model: heatPumpForm.model.trim(),
      power_kw: numberValue(heatPumpForm.power_kw),
      pump_type: heatPumpForm.pump_type,
      price_net: numberValue(heatPumpForm.price_net),
      cop: heatPumpForm.cop ? numberValue(heatPumpForm.cop) : null,
      zum_compliant: heatPumpForm.zum_compliant,
      zum_url: heatPumpForm.zum_url.trim() || null,
      catalog_card_url: heatPumpForm.catalog_card_url.trim() || null,
    });
    setBusy(false);
    if (error) return setStatus(`Błąd dodawania pompy: ${error.message}`);
    setHeatPumpForm(EMPTY_HEAT_PUMP);
    setStatus("Pompa ciepła została dodana");
    await loadCatalogs();
  }

  async function savePanels() {
    setBusy(true);
    for (const panel of panels) {
      const { error } = await supabase.from("grant_panels").update({
        manufacturer: panel.manufacturer.trim(), model: panel.model.trim(),
        power_wp: numberValue(panel.power_wp), price_net: numberValue(panel.price_net), installation_scope: panel.installation_scope,
        catalog_card_url: panel.catalog_card_url?.trim() || null, active: panel.active,
        updated_at: new Date().toISOString(),
      }).eq("id", panel.id);
      if (error) { setBusy(false); return setStatus(`Błąd zapisu paneli: ${error.message}`); }
    }
    setBusy(false); setStatus("Panele zostały zapisane"); await loadCatalogs();
  }

  async function saveInverters() {
    setBusy(true);
    for (const inverter of inverters) {
      const { error } = await supabase.from("grant_inverters").update({
        manufacturer: inverter.manufacturer.trim(), model: inverter.model.trim(),
        power_kw: numberValue(inverter.power_kw), phase_count: numberValue(inverter.phase_count),
        price_net: numberValue(inverter.price_net), catalog_card_url: inverter.catalog_card_url?.trim() || null,
        program_compliant: inverter.program_compliant, active: inverter.active, updated_at: new Date().toISOString(),
      }).eq("id", inverter.id);
      if (error) { setBusy(false); return setStatus(`Błąd zapisu falowników: ${error.message}`); }
    }
    setBusy(false); setStatus("Falowniki zostały zapisane"); await loadCatalogs();
  }

  async function saveHeatPumps() {
    setBusy(true);
    for (const pump of heatPumps) {
      const { error } = await supabase.from("grant_heat_pumps").update({
        manufacturer: pump.manufacturer.trim(), model: pump.model.trim(), power_kw: numberValue(pump.power_kw),
        pump_type: pump.pump_type, price_net: numberValue(pump.price_net), cop: pump.cop ? numberValue(pump.cop) : null,
        zum_compliant: pump.zum_compliant, zum_url: pump.zum_url?.trim() || null,
        catalog_card_url: pump.catalog_card_url?.trim() || null, active: pump.active, updated_at: new Date().toISOString(),
      }).eq("id", pump.id);
      if (error) { setBusy(false); return setStatus(`Błąd zapisu pomp: ${error.message}`); }
    }
    setBusy(false); setStatus("Pompy ciepła zostały zapisane"); await loadCatalogs();
  }

  function markChanged() { setStatus("Masz niezapisane zmiany w katalogu"); }

  return (
    <div className="mt-6 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-4">
        {([
          ["panels", "Panele"], ["inverters", "Falowniki hybrydowe"], ["heatPumps", "Pompy ciepła"],
        ] as Array<[Tab, string]>).map(([value, label]) => (
          <button key={value} type="button" onClick={() => { setTab(value); setStatus(""); }}
            className={tab === value ? "rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white" : "rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200"}>
            {label}
          </button>
        ))}
      </div>

      {tab === "panels" && <>
        <h3 className="mt-5 text-lg font-bold text-slate-900">Dodaj panel</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <input className={inputClass} placeholder="Producent" value={panelForm.manufacturer} onChange={(e) => setPanelForm({ ...panelForm, manufacturer: e.target.value })} />
          <input className={inputClass} placeholder="Model" value={panelForm.model} onChange={(e) => setPanelForm({ ...panelForm, model: e.target.value })} />
          <input className={inputClass} type="number" placeholder="Moc Wp" value={panelForm.power_wp} onChange={(e) => setPanelForm({ ...panelForm, power_wp: e.target.value })} />
          <input className={inputClass} type="number" placeholder="Cena netto" value={panelForm.price_net} onChange={(e) => setPanelForm({ ...panelForm, price_net: e.target.value })} />
          <select className={inputClass} value={panelForm.installation_scope} onChange={(e) => setPanelForm({ ...panelForm, installation_scope: e.target.value as "roof" | "ground" | "both" })}><option value="roof">Dach</option><option value="ground">Grunt</option><option value="both">Dach i grunt</option></select>
          <input className={inputClass} placeholder="Karta katalogowa — URL" value={panelForm.catalog_card_url} onChange={(e) => setPanelForm({ ...panelForm, catalog_card_url: e.target.value })} />
        </div>
        <button type="button" disabled={busy} onClick={addPanel} className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Dodaj panel</button>
        <div className="mt-6 space-y-3">{panels.map((item) => <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_110px_140px_140px_1fr_100px]">
          <input className={inputClass} value={item.manufacturer} onChange={(e) => { setPanels(panels.map((x) => x.id === item.id ? { ...x, manufacturer: e.target.value } : x)); markChanged(); }} />
          <input className={inputClass} value={item.model} onChange={(e) => { setPanels(panels.map((x) => x.id === item.id ? { ...x, model: e.target.value } : x)); markChanged(); }} />
          <input className={inputClass} type="number" value={item.power_wp} onChange={(e) => { setPanels(panels.map((x) => x.id === item.id ? { ...x, power_wp: numberValue(e.target.value) } : x)); markChanged(); }} />
          <input className={inputClass} type="number" aria-label={`Cena netto panelu ${item.manufacturer} ${item.model}`} value={item.price_net} onChange={(e) => { setPanels(panels.map((x) => x.id === item.id ? { ...x, price_net: numberValue(e.target.value) } : x)); markChanged(); }} />
          <select className={inputClass} aria-label={`Przeznaczenie panelu ${item.manufacturer} ${item.model}`} value={item.installation_scope} onChange={(e) => { setPanels(panels.map((x) => x.id === item.id ? { ...x, installation_scope: e.target.value as "roof" | "ground" | "both" } : x)); markChanged(); }}><option value="roof">Dach</option><option value="ground">Grunt</option><option value="both">Dach i grunt</option></select>
          <input className={inputClass} placeholder="Karta katalogowa" value={item.catalog_card_url ?? ""} onChange={(e) => { setPanels(panels.map((x) => x.id === item.id ? { ...x, catalog_card_url: e.target.value } : x)); markChanged(); }} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.active} onChange={(e) => { setPanels(panels.map((x) => x.id === item.id ? { ...x, active: e.target.checked } : x)); markChanged(); }} /> Aktywny</label>
        </div>)}</div>
        {panels.length > 0 && <button type="button" disabled={busy} onClick={savePanels} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Zapisz panele</button>}
      </>}

      {tab === "inverters" && <>
        <h3 className="mt-5 text-lg font-bold text-slate-900">Dodaj falownik hybrydowy</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <input className={inputClass} placeholder="Producent" value={inverterForm.manufacturer} onChange={(e) => setInverterForm({ ...inverterForm, manufacturer: e.target.value })} />
          <input className={inputClass} placeholder="Model" value={inverterForm.model} onChange={(e) => setInverterForm({ ...inverterForm, model: e.target.value })} />
          <input className={inputClass} type="number" placeholder="Moc kW" value={inverterForm.power_kw} onChange={(e) => setInverterForm({ ...inverterForm, power_kw: e.target.value })} />
          <select className={inputClass} value={inverterForm.phase_count} onChange={(e) => setInverterForm({ ...inverterForm, phase_count: e.target.value })}><option value="1">1 faza</option><option value="3">3 fazy</option></select>
          <input className={inputClass} type="number" placeholder="Cena netto" value={inverterForm.price_net} onChange={(e) => setInverterForm({ ...inverterForm, price_net: e.target.value })} />
          <input className={inputClass} placeholder="Karta katalogowa — URL" value={inverterForm.catalog_card_url} onChange={(e) => setInverterForm({ ...inverterForm, catalog_card_url: e.target.value })} />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={inverterForm.program_compliant} onChange={(e) => setInverterForm({ ...inverterForm, program_compliant: e.target.checked })} /> Spełnia wymagania programu</label>
        <button type="button" disabled={busy} onClick={addInverter} className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Dodaj falownik</button>
        <div className="mt-6 space-y-3">{inverters.map((item) => <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-2 xl:grid-cols-4">
          <input className={inputClass} value={item.manufacturer} onChange={(e) => { setInverters(inverters.map((x) => x.id === item.id ? { ...x, manufacturer: e.target.value } : x)); markChanged(); }} />
          <input className={inputClass} value={item.model} onChange={(e) => { setInverters(inverters.map((x) => x.id === item.id ? { ...x, model: e.target.value } : x)); markChanged(); }} />
          <input className={inputClass} type="number" value={item.power_kw} onChange={(e) => { setInverters(inverters.map((x) => x.id === item.id ? { ...x, power_kw: numberValue(e.target.value) } : x)); markChanged(); }} />
          <input className={inputClass} type="number" aria-label={`Cena netto falownika ${item.manufacturer} ${item.model}`} value={item.price_net} onChange={(e) => { setInverters(inverters.map((x) => x.id === item.id ? { ...x, price_net: numberValue(e.target.value) } : x)); markChanged(); }} />
          <select className={inputClass} value={item.phase_count} onChange={(e) => { setInverters(inverters.map((x) => x.id === item.id ? { ...x, phase_count: numberValue(e.target.value) } : x)); markChanged(); }}><option value="1">1 faza</option><option value="3">3 fazy</option></select>
          <input className={inputClass} placeholder="Karta katalogowa" value={item.catalog_card_url ?? ""} onChange={(e) => { setInverters(inverters.map((x) => x.id === item.id ? { ...x, catalog_card_url: e.target.value } : x)); markChanged(); }} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.program_compliant} onChange={(e) => { setInverters(inverters.map((x) => x.id === item.id ? { ...x, program_compliant: e.target.checked } : x)); markChanged(); }} /> Zgodny</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.active} onChange={(e) => { setInverters(inverters.map((x) => x.id === item.id ? { ...x, active: e.target.checked } : x)); markChanged(); }} /> Aktywny</label>
        </div>)}</div>
        {inverters.length > 0 && <button type="button" disabled={busy} onClick={saveInverters} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Zapisz falowniki</button>}
      </>}

      {tab === "heatPumps" && <>
        <h3 className="mt-5 text-lg font-bold text-slate-900">Dodaj pompę ciepła</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input className={inputClass} placeholder="Producent" value={heatPumpForm.manufacturer} onChange={(e) => setHeatPumpForm({ ...heatPumpForm, manufacturer: e.target.value })} />
          <input className={inputClass} placeholder="Model" value={heatPumpForm.model} onChange={(e) => setHeatPumpForm({ ...heatPumpForm, model: e.target.value })} />
          <input className={inputClass} type="number" placeholder="Moc kW" value={heatPumpForm.power_kw} onChange={(e) => setHeatPumpForm({ ...heatPumpForm, power_kw: e.target.value })} />
          <select className={inputClass} value={heatPumpForm.pump_type} onChange={(e) => setHeatPumpForm({ ...heatPumpForm, pump_type: e.target.value as "monoblock" | "split" })}><option value="monoblock">Monoblok</option><option value="split">Split</option></select>
          <input className={inputClass} type="number" placeholder="Cena netto" value={heatPumpForm.price_net} onChange={(e) => setHeatPumpForm({ ...heatPumpForm, price_net: e.target.value })} />
          <input className={inputClass} type="number" step="0.01" placeholder="COP" value={heatPumpForm.cop} onChange={(e) => setHeatPumpForm({ ...heatPumpForm, cop: e.target.value })} />
          <input className={inputClass} placeholder="Link ZUM" value={heatPumpForm.zum_url} onChange={(e) => setHeatPumpForm({ ...heatPumpForm, zum_url: e.target.value })} />
          <input className={inputClass} placeholder="Karta katalogowa — URL" value={heatPumpForm.catalog_card_url} onChange={(e) => setHeatPumpForm({ ...heatPumpForm, catalog_card_url: e.target.value })} />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={heatPumpForm.zum_compliant} onChange={(e) => setHeatPumpForm({ ...heatPumpForm, zum_compliant: e.target.checked })} /> Pompa znajduje się na liście ZUM</label>
        <button type="button" disabled={busy} onClick={addHeatPump} className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Dodaj pompę</button>
        <div className="mt-6 space-y-3">{heatPumps.map((item) => <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-2 xl:grid-cols-4">
          <input className={inputClass} value={item.manufacturer} onChange={(e) => { setHeatPumps(heatPumps.map((x) => x.id === item.id ? { ...x, manufacturer: e.target.value } : x)); markChanged(); }} />
          <input className={inputClass} value={item.model} onChange={(e) => { setHeatPumps(heatPumps.map((x) => x.id === item.id ? { ...x, model: e.target.value } : x)); markChanged(); }} />
          <input className={inputClass} type="number" value={item.power_kw} onChange={(e) => { setHeatPumps(heatPumps.map((x) => x.id === item.id ? { ...x, power_kw: numberValue(e.target.value) } : x)); markChanged(); }} />
          <input className={inputClass} type="number" aria-label={`Cena netto pompy ${item.manufacturer} ${item.model}`} value={item.price_net} onChange={(e) => { setHeatPumps(heatPumps.map((x) => x.id === item.id ? { ...x, price_net: numberValue(e.target.value) } : x)); markChanged(); }} />
          <select className={inputClass} value={item.pump_type} onChange={(e) => { setHeatPumps(heatPumps.map((x) => x.id === item.id ? { ...x, pump_type: e.target.value as "monoblock" | "split" } : x)); markChanged(); }}><option value="monoblock">Monoblok</option><option value="split">Split</option></select>
          <input className={inputClass} type="number" step="0.01" placeholder="COP" value={item.cop ?? ""} onChange={(e) => { setHeatPumps(heatPumps.map((x) => x.id === item.id ? { ...x, cop: e.target.value ? numberValue(e.target.value) : null } : x)); markChanged(); }} />
          <input className={inputClass} placeholder="Link ZUM" value={item.zum_url ?? ""} onChange={(e) => { setHeatPumps(heatPumps.map((x) => x.id === item.id ? { ...x, zum_url: e.target.value } : x)); markChanged(); }} />
          <input className={inputClass} placeholder="Karta katalogowa" value={item.catalog_card_url ?? ""} onChange={(e) => { setHeatPumps(heatPumps.map((x) => x.id === item.id ? { ...x, catalog_card_url: e.target.value } : x)); markChanged(); }} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.zum_compliant} onChange={(e) => { setHeatPumps(heatPumps.map((x) => x.id === item.id ? { ...x, zum_compliant: e.target.checked } : x)); markChanged(); }} /> ZUM</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.active} onChange={(e) => { setHeatPumps(heatPumps.map((x) => x.id === item.id ? { ...x, active: e.target.checked } : x)); markChanged(); }} /> Aktywna</label>
        </div>)}</div>
        {heatPumps.length > 0 && <button type="button" disabled={busy} onClick={saveHeatPumps} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Zapisz pompy</button>}
      </>}

      {status && <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">{status}</p>}
    </div>
  );
}
