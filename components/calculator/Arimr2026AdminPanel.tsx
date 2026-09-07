"use client";

import type { Arimr2026Settings } from "@/lib/calculator/arimr2026";

type SettingsKey = keyof Arimr2026Settings;

type SettingField = {
  key: SettingsKey;
  label: string;
  suffix: string;
  helper: string;
  step?: string;
  min?: string;
  max?: string;
};

const SALE_PRICE_FIELDS: SettingField[] = [
  {
    key: "pvSaleRateNetPerKwp",
    label: "Cena PV",
    suffix: "zł netto/kWp",
    helper: "Sztywna cena sprzedaży za każdy 1 kWp instalacji PV.",
  },
  {
    key: "storageSaleRateNetPerKwh",
    label: "Cena magazynu energii",
    suffix: "zł netto/kWh",
    helper: "Sztywna cena sprzedaży za każdą 1 kWh magazynu energii.",
  },
];

const PROGRAM_FIELDS: SettingField[] = [
  {
    key: "pvReferenceRateNetPerKwp",
    label: "Stawka referencyjna PV",
    suffix: "zł netto/kWp",
    helper: "Podstawa ryczałtowa ARiMR dla fotowoltaiki.",
  },
  {
    key: "storageReferenceRateNetPerKwh",
    label: "Stawka referencyjna magazynu",
    suffix: "zł netto/kWh",
    helper: "Podstawa ryczałtowa ARiMR dla magazynu energii.",
  },
  {
    key: "supportPercent",
    label: "Poziom wsparcia",
    suffix: "%",
    helper: "Procent naliczany od obu podstaw ryczałtowych.",
    step: "0.1",
    max: "100",
  },
  {
    key: "areaBGrantLimit",
    label: "Limit pomocy obszaru B",
    suffix: "zł",
    helper: "Maksymalna łączna kwota dotacji PV + magazyn.",
  },
  {
    key: "minimumStorageKwhPerPvKwp",
    label: "Minimalna relacja magazynu do PV",
    suffix: "kWh/kWp",
    helper: "Warunek walidowany dla nowej instalacji PV.",
    step: "0.1",
  },
  {
    key: "defaultVatRate",
    label: "VAT",
    suffix: "%",
    helper: "Stała stawka używana do wyliczenia ceny brutto.",
    step: "0.1",
    max: "100",
  },
];

const COMPENSATION_FIELDS: SettingField[] = [
  {
    key: "sellerMonthlyPlanKw",
    label: "Plan handlowca na cały program",
    suffix: "kW",
    helper: "Łączny poziom realizacji ARiMR 2026, przy którym obowiązuje 100% stawek. Plan nie resetuje się co miesiąc.",
    step: "0.1",
    min: "0.1",
  },
  {
    key: "sellerPvCompensationNetPerKwp",
    label: "Wynagrodzenie handlowca za PV",
    suffix: "zł / kWp",
    helper: "Stawka bazowa za każdy sprzedany kWp PV.",
  },
  {
    key: "sellerStorageCompensationNetPerKwh",
    label: "Wynagrodzenie handlowca za magazyn",
    suffix: "zł / kWh",
    helper: "Stawka bazowa za każdą sprzedaną kWh magazynu.",
  },
];

const INTERNAL_COST_FIELDS: SettingField[] = [
  {
    key: "pvInstallationCostNetPerKwp",
    label: "Montaż PV",
    suffix: "zł netto/kWp",
    helper: "Koszt montażu PV jest liczony jako moc instalacji × ta stawka.",
  },
  {
    key: "storageInstallationCostNet",
    label: "Montaż magazynu energii z PV",
    suffix: "zł netto",
    helper: "Stały koszt montażu magazynu w zestawie z nową instalacją PV.",
  },
  {
    key: "flatRoofCostNetPerKwp",
    label: "Konstrukcja — dach płaski",
    suffix: "zł netto/kWp",
    helper: "Koszt konstrukcji jest liczony jako moc instalacji PV × ta stawka.",
  },
  {
    key: "pitchedSheetCostNetPerKwp",
    label: "Konstrukcja — blacha",
    suffix: "zł netto/kWp",
    helper: "Koszt konstrukcji jest liczony jako moc instalacji PV × ta stawka.",
  },
  {
    key: "pitchedTileCostNetPerKwp",
    label: "Konstrukcja — dachówka",
    suffix: "zł netto/kWp",
    helper: "Koszt konstrukcji jest liczony jako moc instalacji PV × ta stawka.",
  },
  {
    key: "groundCostNetPerKwp",
    label: "Konstrukcja — grunt",
    suffix: "zł netto/kWp",
    helper: "Koszt konstrukcji jest liczony jako moc instalacji PV × ta stawka.",
  },
  {
    key: "protectionsCostNet",
    label: "Zabezpieczenia",
    suffix: "zł netto",
    helper: "Globalny koszt zabezpieczeń dla zestawu ARiMR.",
  },
  {
    key: "wiringCostNet",
    label: "Okablowanie",
    suffix: "zł netto",
    helper: "Globalny koszt okablowania dla zestawu ARiMR.",
  },
  {
    key: "transportElectronicsCostNet",
    label: "Transport elektroniki",
    suffix: "zł netto",
    helper: "Koszt dostawy falownika i magazynu.",
  },
  {
    key: "transportPanelsCostNet",
    label: "Transport paneli",
    suffix: "zł netto",
    helper: "Koszt dostawy paneli fotowoltaicznych.",
  },
  {
    key: "documentationCostNet",
    label: "Dokumentacja",
    suffix: "zł netto",
    helper: "Koszt przygotowania dokumentacji zestawu.",
  },
];

const COMPANY_PROFIT_FIELDS: SettingField[] = [
  {
    key: "warrantyFundPercent",
    label: "Fundusz gwarancyjny",
    suffix: "% ceny netto",
    helper: "Część zysku firmy wydzielana z ceny netto. Nie jest zaliczana do kosztów.",
    step: "0.1",
    max: "100",
  },
];

function SettingsSection({
  title,
  description,
  fields,
  settings,
  onChange,
}: {
  title: string;
  description: string;
  fields: SettingField[];
  settings: Arimr2026Settings;
  onChange: (key: SettingsKey, value: string) => void;
}) {
  return (
    <section>
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          {title}
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {fields.map((field) => (
          <label
            key={field.key}
            htmlFor={`arimr-admin-${field.key}`}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/50"
          >
            <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">
              {field.label}
            </span>
            <span className="relative mt-3 block">
              <input
                id={`arimr-admin-${field.key}`}
                type="number"
                min={field.min || "0"}
                max={field.max}
                step={field.step || "1"}
                value={settings[field.key]}
                onChange={(event) => onChange(field.key, event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pr-28 font-semibold text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-emerald-950"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex max-w-24 items-center text-right text-[11px] font-semibold leading-tight text-slate-400">
                {field.suffix}
              </span>
            </span>
            <span className="mt-2 block text-xs leading-5 text-slate-500 dark:text-slate-400">
              {field.helper}
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}

export default function Arimr2026AdminPanel({
  settings,
  status,
  onChange,
  onSave,
  onReset,
}: {
  settings: Arimr2026Settings;
  status: string;
  onChange: (key: SettingsKey, value: string) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-slate-900 sm:p-6">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400" />
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 dark:border-slate-800 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
            Panel administracyjny · ARiMR 2026
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">
            Cennik, koszty i wynagrodzenie handlowca
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            Ustawienia są globalne i obowiązują wszystkich użytkowników kalkulatora ARiMR. Nie wpływają na kalkulator standardowy.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status ? (
            <span
              role="status"
              className="mr-1 text-sm font-medium text-slate-500 dark:text-slate-400"
            >
              {status}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onReset}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Przywróć domyślne
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 dark:focus-visible:ring-emerald-950"
          >
            Zapisz globalnie
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-8">
        <SettingsSection
          title="Cennik sprzedaży"
          description="Sztywne ceny netto za 1 kWp PV i 1 kWh magazynu energii. Handlowiec nie może ich zmieniać w kalkulatorze."
          fields={SALE_PRICE_FIELDS}
          settings={settings}
          onChange={onChange}
        />
        <SettingsSection
          title="Parametry programu ARiMR"
          description="Stawki ryczałtowe, poziom wsparcia, limit, minimalna pojemność magazynu i VAT."
          fields={PROGRAM_FIELDS}
          settings={settings}
          onChange={onChange}
        />
        <SettingsSection
          title="Koszty wewnętrzne ARiMR"
          description="Do kosztu wchodzą: panele, falownik, magazyn, montaż PV i ME, konstrukcja, transport, zabezpieczenia, okablowanie, dokumentacja i wynagrodzenie handlowca. Ceny sprzętu są pobierane z katalogu."
          fields={INTERNAL_COST_FIELDS}
          settings={settings}
          onChange={onChange}
        />
        <SettingsSection
          title="Zysk firmy"
          description="Fundusz gwarancyjny pozostaje częścią zysku firmy i nie jest zaliczany do kosztów."
          fields={COMPANY_PROFIT_FIELDS}
          settings={settings}
          onChange={onChange}
        />
        <SettingsSection
          title="Plan i wynagrodzenie handlowca"
          description="Admin ustala plan na cały program oraz stawki za kWp PV i kWh magazynu. Do planu 1 kWp PV = 1 kW, a 1 magazyn = 5 kW; wypłata jest rozliczana łącznie z wszystkich sprzedaży ARiMR i rośnie proporcjonalnie maksymalnie do 150%."
          fields={COMPENSATION_FIELDS}
          settings={settings}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
