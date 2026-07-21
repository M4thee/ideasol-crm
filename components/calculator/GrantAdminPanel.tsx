"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import GrantEquipmentAdmin from "@/components/calculator/GrantEquipmentAdmin";

type GrantSettings = {
  id: number;
  program_name: string;
  fixed_margin_gross: number;
  min_pv_kw: number;
  max_pv_kw: number;
  annual_yield_kwh_per_kwp: number;
  heat_pump_extra_pv_kw: number;
  pv_eligible_limit_gross: number;
  extra_pv_eligible_limit_gross: number;
  pv_limit_gross_per_kwp: number;
  heat_pump_eligible_limit_gross: number;
  combined_grant_limit_gross: number;
  pv_installation_net_per_kwp: number;
  roof_sheet_net: number;
  roof_tile_net: number;
  roof_felt_net: number;
  roof_ground_net: number;
  protections_net: number;
  wiring_net: number;
  transport_net: number;
  documentation_net: number;
  monitoring_net: number;
  heat_pump_installation_net: number;
  marketing_net: number;
  owners_count: number;
  pv_small_per_kw_net: number;
  pv_small_fixed_net: number;
  pv_large_per_kw_net: number;
  pv_large_fixed_net: number;
  heat_pump_per_owner_net: number;
  operator_percent: number;
  enable_pv: boolean;
  enable_heat_pump: boolean;
  enable_combined: boolean;
  vat_rate: number;
  active: boolean;
};

const DEFAULT_SETTINGS: GrantSettings = {
  id: 1,
  program_name: "Grant OZE — Radzionków",
  fixed_margin_gross: 3000,
  min_pv_kw: 2,
  max_pv_kw: 10,
  annual_yield_kwh_per_kwp: 1000,
  heat_pump_extra_pv_kw: 4,
  pv_eligible_limit_gross: 20000,
  extra_pv_eligible_limit_gross: 20000,
  pv_limit_gross_per_kwp: 5000,
  heat_pump_eligible_limit_gross: 35000,
  combined_grant_limit_gross: 55000,
  pv_installation_net_per_kwp: 500,
  roof_sheet_net: 1500,
  roof_tile_net: 2000,
  roof_felt_net: 2200,
  roof_ground_net: 4500,
  protections_net: 1500,
  wiring_net: 800,
  transport_net: 500,
  documentation_net: 700,
  monitoring_net: 1200,
  heat_pump_installation_net: 0,
  marketing_net: 500,
  owners_count: 3,
  pv_small_per_kw_net: 250,
  pv_small_fixed_net: 500,
  pv_large_per_kw_net: 150,
  pv_large_fixed_net: 700,
  heat_pump_per_owner_net: 500,
  operator_percent: 15,
  enable_pv: true,
  enable_heat_pump: true,
  enable_combined: true,
  vat_rate: 8,
  active: true,
};

type NumericSettingKey = Exclude<
  keyof GrantSettings,
  "id" | "program_name" | "active" | "enable_pv" | "enable_heat_pump" | "enable_combined"
>;

const NUMERIC_FIELDS: Array<{
  key: NumericSettingKey;
  label: string;
  unit: string;
  step?: string;
}> = [
  { key: "fixed_margin_gross", label: "Sztywny narzut handlowca", unit: "zł netto" },
  { key: "min_pv_kw", label: "Minimalna moc PV", unit: "kWp", step: "0.001" },
  { key: "max_pv_kw", label: "Maksymalna moc PV", unit: "kWp", step: "0.001" },
  { key: "annual_yield_kwh_per_kwp", label: "Roczna produkcja z 1 kWp", unit: "kWh" },
  { key: "heat_pump_extra_pv_kw", label: "Dodatkowa moc PV przy pompie", unit: "kWp", step: "0.001" },
  { key: "pv_eligible_limit_gross", label: "Limit kosztów PV", unit: "zł brutto" },
  { key: "extra_pv_eligible_limit_gross", label: "Dodatkowy limit PV przy pompie", unit: "zł brutto" },
  { key: "pv_limit_gross_per_kwp", label: "Limit kosztu za 1 kWp", unit: "zł brutto" },
  { key: "heat_pump_eligible_limit_gross", label: "Limit kosztów pompy ciepła", unit: "zł brutto" },
  { key: "combined_grant_limit_gross", label: "Łączny limit grantu PV + pompa", unit: "zł" },
  { key: "pv_installation_net_per_kwp", label: "Montaż PV", unit: "zł netto / kWp" },
  { key: "roof_sheet_net", label: "Konstrukcja — blacha", unit: "zł netto" },
  { key: "roof_tile_net", label: "Konstrukcja — dachówka", unit: "zł netto" },
  { key: "roof_felt_net", label: "Konstrukcja — papa", unit: "zł netto" },
  { key: "roof_ground_net", label: "Konstrukcja — grunt", unit: "zł netto" },
  { key: "protections_net", label: "Zabezpieczenia", unit: "zł netto" },
  { key: "wiring_net", label: "Okablowanie", unit: "zł netto" },
  { key: "transport_net", label: "Transport", unit: "zł netto" },
  { key: "documentation_net", label: "Dokumentacja", unit: "zł netto" },
  { key: "monitoring_net", label: "Monitoring / EMS", unit: "zł netto" },
  { key: "heat_pump_installation_net", label: "Montaż pompy ciepła", unit: "zł netto" },
  { key: "marketing_net", label: "Marketing", unit: "zł netto" },
  { key: "owners_count", label: "Liczba właścicieli", unit: "os." },
  { key: "pv_small_per_kw_net", label: "Marża PV ≤ 5 kWp / właściciel", unit: "zł netto / kWp" },
  { key: "pv_small_fixed_net", label: "Stała marża PV ≤ 5 kWp / właściciel", unit: "zł netto" },
  { key: "pv_large_per_kw_net", label: "Marża PV > 5 kWp / właściciel", unit: "zł netto / kWp" },
  { key: "pv_large_fixed_net", label: "Stała marża PV > 5 kWp / właściciel", unit: "zł netto" },
  { key: "heat_pump_per_owner_net", label: "Marża pompy / właściciel", unit: "zł netto" },
  { key: "operator_percent", label: "Operator / gwarancja", unit: "%", step: "0.01" },
  { key: "vat_rate", label: "Stawka VAT", unit: "%", step: "0.01" },
];

export default function GrantAdminPanel() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [status, setStatus] = useState("Ładowanie ustawień grantu...");
  const [saving, setSaving] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      const initialResult = await supabase
        .from("grant_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      const data = initialResult.data ? { ...DEFAULT_SETTINGS, ...initialResult.data } : null;
      const error = initialResult.error;

      if (error) {
        console.warn("Nie udało się pobrać ustawień grantu", error);
        setTableMissing(error.code === "42P01" || error.code === "PGRST205");
        setStatus("Nie udało się pobrać ustawień grantu");
        return;
      }

      if (data) {
        setSettings(data as GrantSettings);
      }
      setStatus("");
    }

    void loadSettings();
  }, []);

  function updateNumber(key: NumericSettingKey, value: string) {
    const parsed = Number(value.replace(",", "."));
    setSettings((current) => ({
      ...current,
      [key]: Number.isFinite(parsed) ? parsed : 0,
    }));
    setStatus("Masz niezapisane zmiany");
  }

  async function saveSettings() {
    if (settings.min_pv_kw > settings.max_pv_kw) {
      setStatus("Minimalna moc PV nie może być większa od maksymalnej");
      return;
    }

    setSaving(true);
    setStatus("Zapisywanie ustawień grantu...");

    const { error } = await supabase.from("grant_settings").upsert({
      ...settings,
      id: 1,
      updated_at: new Date().toISOString(),
      updated_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    });

    setSaving(false);

    if (error) {
      console.error("Błąd zapisu ustawień grantu", error);
      setStatus(`Błąd zapisu: ${error.message}`);
      return;
    }

    setTableMissing(false);
    setStatus("Ustawienia grantu zostały zapisane");
  }

  return (
    <section className="rounded-3xl border border-blue-200 bg-blue-50/60 p-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
        Grant OZE
      </p>
      <h2 className="mt-2 text-2xl font-bold text-slate-900">
        Radzionków
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
        Ustawienia tego programu są całkowicie niezależne od standardowego
        kalkulatora.
      </p>

      {tableMissing && (
        <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Brakuje tabel grantowych w Supabase. Uruchom migrację
          <strong> 20260720_create_grant_calculator.sql</strong>, a następnie
          odśwież stronę.
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full max-w-xl">
            <label className="text-sm font-semibold text-slate-700" htmlFor="grant-program-name">
              Nazwa programu
            </label>
            <input
              id="grant-program-name"
              value={settings.program_name}
              onChange={(event) => {
                setSettings((current) => ({ ...current, program_name: event.target.value }));
                setStatus("Masz niezapisane zmiany");
              }}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400"
            />
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={settings.active}
              onChange={(event) => {
                setSettings((current) => ({ ...current, active: event.target.checked }));
                setStatus("Masz niezapisane zmiany");
              }}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Program aktywny
          </label>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {NUMERIC_FIELDS.map((field) => (
            <label key={field.key} className="block">
              <span className="text-sm font-semibold text-slate-700">{field.label}</span>
              <div className="mt-2 flex overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-blue-400">
                <input
                  type="number"
                  min="0"
                  step={field.step ?? "1"}
                  value={settings[field.key]}
                  onChange={(event) => updateNumber(field.key, event.target.value)}
                  className="min-w-0 flex-1 px-4 py-3 text-sm text-slate-900 outline-none"
                />
                <span className="flex items-center border-l border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-500">
                  {field.unit}
                </span>
              </div>
            </label>
          ))}
        </div>

        <div className="mt-6 border-t border-slate-200 pt-5">
          <p className="text-sm font-bold text-slate-900">Dostępne warianty kalkulatora</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {([
              ["enable_pv", "Fotowoltaika"],
              ["enable_heat_pump", "Pompa ciepła"],
              ["enable_combined", "Fotowoltaika + pompa"],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                <span>{label}</span>
                <span className="relative inline-flex">
                  <input
                    type="checkbox"
                    checked={settings[key]}
                    onChange={(event) => {
                      setSettings((current) => ({ ...current, [key]: event.target.checked }));
                      setStatus("Masz niezapisane zmiany");
                    }}
                    className="peer sr-only"
                  />
                  <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-[#5300EB]" />
                  <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={saveSettings}
            disabled={saving || tableMissing}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Zapisywanie..." : "Zapisz parametry programu"}
          </button>
          {status && <p className="text-sm font-medium text-slate-600">{status}</p>}
        </div>
      </div>

      <GrantEquipmentAdmin />
    </section>
  );
}
