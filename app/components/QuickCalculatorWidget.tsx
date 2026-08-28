"use client";

import { useEffect, useMemo, useState } from "react";

import {
  rankInvertersForStorage,
  type CompatibleInverter,
  type CompatibleStorage,
} from "@/lib/calculator/equipmentCompatibility";
import DashboardWidgetIcon from "@/app/components/DashboardWidgetIcon";

type CatalogPanel = {
  name: string;
  displayName: string;
  powerWp: number;
};

type CatalogStorage = CompatibleStorage & {
  name: string;
  displayName: string;
  capacityKwh: number;
};

type CatalogInverter = CompatibleInverter & {
  name: string;
  displayName: string;
  type: string;
  maxPvKw: number;
};

type CalculatorCatalog = {
  panels: Record<string, CatalogPanel>;
  storages: Record<string, CatalogStorage>;
  inverters: CatalogInverter[];
};

type QuickCalculationResult = {
  finalGross: number;
  finalNet: number;
  pvPowerKw: number;
  inverter: string;
  energyStorage: string;
};

type QuickCalculatorWidgetProps = {
  currentUserId: string;
  currentUserEmail?: string;
  currentUserName?: string;
  currentUserRole: string;
};

const DEFAULT_POWER_KW = "6";
const DEFAULT_SELLER_MARKUP_NET = 3000;

function formatMoney(value: number) {
  return value.toLocaleString("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getPanelCount(powerKwText: string, panel?: CatalogPanel) {
  const powerKw = Number(powerKwText.replace(",", "."));

  if (!panel || !Number.isFinite(powerKw) || powerKw <= 0) return 0;

  return Math.max(1, Math.round((powerKw * 1000) / panel.powerWp));
}

export default function QuickCalculatorWidget({
  currentUserId,
  currentUserEmail,
  currentUserName,
  currentUserRole,
}: QuickCalculatorWidgetProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [catalog, setCatalog] = useState<CalculatorCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState("");
  const [powerKw, setPowerKw] = useState(DEFAULT_POWER_KW);
  const [panelModel, setPanelModel] = useState("");
  const [storageCode, setStorageCode] = useState("none");
  const [inverterName, setInverterName] = useState("auto");
  const [sellerMarkup, setSellerMarkup] = useState(DEFAULT_SELLER_MARKUP_NET);
  const [result, setResult] = useState<QuickCalculationResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setCatalogLoading(true);
      setError("");

      try {
        const response = await fetch("/api/calculate", {
          method: "GET",
          cache: "no-store",
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.catalog) {
          throw new Error(payload?.error || "Nie udało się pobrać aktualnej bazy sprzętu.");
        }

        if (cancelled) return;

        const loadedCatalog = payload.catalog as CalculatorCatalog;
        const firstPanelCode = Object.keys(loadedCatalog.panels || {})[0] || "";

        setCatalog(loadedCatalog);
        setPanelModel((current) => current || firstPanelCode);
      } catch (catalogError) {
        if (!cancelled) {
          setError(
            catalogError instanceof Error
              ? catalogError.message
              : "Nie udało się pobrać aktualnej bazy sprzętu."
          );
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }

    void loadCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  const panelEntries = useMemo(
    () => Object.entries(catalog?.panels || {}),
    [catalog?.panels]
  );
  const storageEntries = useMemo(
    () =>
      Object.entries(catalog?.storages || {}).filter(
        ([code, storage]) => code === "none" || storage.capacityKwh > 0
      ),
    [catalog?.storages]
  );
  const selectedPanel = panelModel ? catalog?.panels?.[panelModel] : undefined;
  const selectedStorage = storageCode ? catalog?.storages?.[storageCode] : undefined;
  const panelCount = getPanelCount(powerKw, selectedPanel);
  const actualPowerKw = selectedPanel
    ? Number(((panelCount * selectedPanel.powerWp) / 1000).toFixed(2))
    : 0;

  const inverterOptions = useMemo(() => {
    if (!catalog) return [];
    const uniqueInverters = catalog.inverters.filter(
      (inverter, index, inverters) =>
        inverters.findIndex((candidate) => candidate.name === inverter.name) === index
    );

    if (!selectedStorage || storageCode === "none") return uniqueInverters;

    return rankInvertersForStorage(uniqueInverters, selectedStorage);
  }, [catalog, selectedStorage, storageCode]);

  function invalidateResult() {
    setResult(null);
    setError("");
  }

  async function calculatePrice() {
    if (!catalog || !selectedPanel || panelCount <= 0) {
      setError("Wpisz prawidłową moc instalacji i wybierz panel.");
      return;
    }

    setCalculating(true);
    setError("");

    try {
      const response = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customMode: false,
          offerType: storageCode === "none" ? "pv" : "pv_storage",
          panelModel,
          panelCount,
          roofType: "blacha",
          storage: storageCode,
          includeSubsidy: false,
          isUpsell: false,
          existingPvPowerKw: 0,
          billingSystem: "net_billing",
          selectedInverterName: inverterName,
          clientHasOwnHybridInverter: false,
          sellerMarkup,
          vatRate: 8,
          additionalServices: [],
          advisor: {
            id: currentUserId,
            name: currentUserName || currentUserEmail || "Użytkownik CRM",
            email: currentUserEmail || null,
            role: currentUserRole,
          },
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Nie udało się obliczyć ceny instalacji.");
      }

      setResult(payload as QuickCalculationResult);
    } catch (calculationError) {
      setResult(null);
      setError(
        calculationError instanceof Error
          ? calculationError.message
          : "Nie udało się obliczyć ceny instalacji."
      );
    } finally {
      setCalculating(false);
    }
  }

  return (
    <section className="relative rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div
        data-dashboard-tour-target="quick-calculator"
        className="dashboard-quick-header flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 items-center gap-3">
          <DashboardWidgetIcon name="calculator" />
          <h2 className="min-w-0 text-xl font-bold text-slate-900 dark:text-slate-100">
            Szybki kalkulator
          </h2>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {!collapsed && (
            <button
              type="button"
              onClick={() => setSettingsOpen((current) => !current)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-base text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              aria-label="Ustaw marżę handlowca"
              aria-expanded={settingsOpen}
            >
              ⚙
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setCollapsed((current) => !current);
              setSettingsOpen(false);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {collapsed ? "Rozwiń" : "Zwiń"}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="border-t border-slate-200 p-5 dark:border-slate-700">
          {settingsOpen && (
            <div className="absolute right-5 top-[76px] z-30 w-[calc(100%-2.5rem)] max-w-xs rounded-2xl border border-blue-100 bg-white p-4 shadow-xl shadow-slate-950/15 dark:border-slate-700 dark:bg-slate-900">
              <label className="dashboard-quick-power block min-w-0">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Marża handlowca netto
                </span>
                <div className="relative mt-2">
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={sellerMarkup}
                    onChange={(event) => {
                      setSellerMarkup(Math.max(0, Number(event.target.value) || 0));
                      invalidateResult();
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pr-10 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-blue-500/20"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">
                    zł
                  </span>
                </div>
              </label>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="mt-3 w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                Gotowe
              </button>
            </div>
          )}

          {catalogLoading ? (
            <p className="text-sm text-slate-400">Ładowanie aktualnej bazy sprzętu...</p>
          ) : (
            <div className="dashboard-quick-controls grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_auto] xl:items-end">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Moc instalacji
                </span>
                <div className="mt-1.5 flex min-w-0">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={powerKw}
                    onChange={(event) => {
                      setPowerKw(event.target.value);
                      invalidateResult();
                    }}
                    className="min-w-0 flex-1 rounded-l-xl border border-r-0 border-slate-300 bg-white px-3 py-2.5 text-base font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-emerald-500/20"
                    aria-label="Moc instalacji w kilowatopikach"
                  />
                  <span className="flex w-14 shrink-0 items-center justify-center rounded-r-xl border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    kWp
                  </span>
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Panel</span>
                <select
                  value={panelModel}
                  onChange={(event) => {
                    setPanelModel(event.target.value);
                    invalidateResult();
                  }}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-emerald-500/20"
                >
                  {panelEntries.map(([code, panel]) => (
                    <option key={code} value={code}>
                      {panel.displayName} · {panel.powerWp} W
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Magazyn</span>
                <select
                  value={storageCode}
                  onChange={(event) => {
                    setStorageCode(event.target.value);
                    setInverterName("auto");
                    invalidateResult();
                  }}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-emerald-500/20"
                >
                  {storageEntries.map(([code, storage]) => (
                    <option key={code} value={code}>
                      {code === "none" ? "Bez magazynu" : storage.displayName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Falownik</span>
                <select
                  value={inverterName}
                  onChange={(event) => {
                    setInverterName(event.target.value);
                    invalidateResult();
                  }}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-emerald-500/20"
                >
                  <option value="auto">Dobierz automatycznie</option>
                  {inverterOptions.map((inverter) => (
                    <option key={inverter.name} value={inverter.name}>
                      {inverter.displayName}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={calculatePrice}
                disabled={calculating || catalogLoading || panelCount <= 0}
                className="h-[42px] rounded-xl bg-emerald-500 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {calculating ? "Liczenie..." : "Przelicz"}
              </button>
            </div>
          )}

          {selectedPanel && panelCount > 0 && (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Dobór: {panelCount} × {selectedPanel.powerWp} W = {actualPowerKw.toLocaleString("pl-PL")} kWp
            </p>
          )}

          {error && (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}

          {result && (
            <div className="mt-5 grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/60 dark:bg-emerald-950/30 sm:grid-cols-[1.2fr_1fr_1fr] sm:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Cena instalacji brutto
                </p>
                <p className="mt-1 text-2xl font-black text-emerald-950 dark:text-emerald-100">
                  {formatMoney(result.finalGross)}
                </p>
                <p className="mt-0.5 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                  netto {formatMoney(result.finalNet)}
                </p>
              </div>
              <div className="min-w-0 border-t border-emerald-200 pt-3 dark:border-emerald-800/60 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Falownik</p>
                <p className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-slate-100" title={result.inverter}>
                  {result.inverter}
                </p>
              </div>
              <div className="min-w-0 border-t border-emerald-200 pt-3 dark:border-emerald-800/60 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Magazyn</p>
                <p className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-slate-100" title={result.energyStorage}>
                  {result.energyStorage || "Brak"}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
