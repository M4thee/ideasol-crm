"use client";

import { useState } from "react";

type SubsidyAllocation = {
  enabled: boolean;
  storageNet: number;
  storageSubsidy: number;
  euBonus?: number;
  total: number;
  maxStorageSubsidy: number;
  qualifyingStorageCost?: number;
  qualifyingVat?: number;
  qualifyVat?: boolean;
  euBonusEligible?: boolean;
  storageIsEu?: boolean;
  inverterIsEu?: boolean;
  storageCapacityKwh?: number;
  requiredStorageCapacityKwh?: number;
  totalPvPowerForSubsidyKw?: number;
  hasStorageMinimumCapacity?: boolean;
  hasRequiredStorageToPvRatio?: boolean;
};

type SubsidyOptimizerProps = {
  totalOfferNetPrice: number;
  totalOfferGrossPrice?: number;
  allocation?: SubsidyAllocation;
  compact?: boolean;
  expanded?: boolean;
};

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("pl-PL", {
    maximumFractionDigits: 0,
  });
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("pl-PL", {
    maximumFractionDigits: 2,
  });
}

export default function SubsidyOptimizer({
  totalOfferNetPrice,
  totalOfferGrossPrice,
  allocation,
  compact = false,
  expanded = false,
}: SubsidyOptimizerProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [pitRate, setPitRate] = useState<12 | 19 | 32>(12);
  const [pitTaxpayers, setPitTaxpayers] = useState<1 | 2>(1);
  const enabled = Boolean(allocation?.enabled);
  const totalSubsidy = enabled ? Number(allocation?.total || 0) : 0;
  const storageSubsidy = enabled ? Number(allocation?.storageSubsidy || 0) : 0;
  const euBonus = enabled ? Number(allocation?.euBonus || 0) : 0;
  const remainingPvAndInverterNet = Math.max(
    Number(totalOfferNetPrice || 0) - Number(allocation?.storageNet || 0),
    0
  );
  const storageCapacity = Number(allocation?.storageCapacityKwh || 0);
  const requiredStorageCapacity = Number(allocation?.requiredStorageCapacityKwh || 0);
  const totalPvPower = Number(allocation?.totalPvPowerForSubsidyKw || 0);
  const storageNetPerKwh = storageCapacity > 0
    ? Number(allocation?.storageNet || 0) / storageCapacity
    : 0;
  const pitDeductionLimit = 53_000 * pitTaxpayers;
  const pitDeductionBase = Math.min(
    Math.max(Number(totalOfferGrossPrice ?? totalOfferNetPrice) - totalSubsidy, 0),
    pitDeductionLimit
  );
  const estimatedPitBenefit = pitDeductionBase * (pitRate / 100);

  if (compact) {
    const eligibilityChecks = [
      {
        label: "Pojemność min. 10 kWh",
        value: `${formatNumber(storageCapacity)} kWh`,
        passed: Boolean(allocation?.hasStorageMinimumCapacity),
      },
      {
        label: "Relacja magazynu do PV",
        value: `${formatNumber(storageCapacity)} / ${formatNumber(requiredStorageCapacity)} kWh`,
        passed: Boolean(allocation?.hasRequiredStorageToPvRatio),
      },
      {
        label: "Premia za urządzenia UE",
        value: allocation?.euBonusEligible ? `+${formatMoney(euBonus)} zł` : "Brak premii",
        passed: Boolean(allocation?.euBonusEligible),
      },
    ];

    return (
      <section className={expanded ? "grid gap-5 lg:grid-cols-2" : "space-y-3"}>
        <div className={`${expanded ? "p-6" : "p-4"} rounded-[20px] border ${enabled ? "border-emerald-400/30 bg-slate-950 text-white" : "border-amber-300 bg-amber-50 text-slate-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-white"}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={`${expanded ? "text-xs" : "text-[9px]"} font-black uppercase tracking-[0.2em] ${enabled ? "text-emerald-400" : "text-amber-600 dark:text-amber-300"}`}>
                Program PME
              </p>
              <p className={`${expanded ? "mt-2 text-sm" : "mt-1 text-xs"} opacity-60`}>Szacowana dotacja</p>
              <p className={`${expanded ? "mt-2 text-4xl" : "mt-1 text-3xl"} font-black tracking-tight`}>
                {enabled ? `${formatMoney(totalSubsidy)} zł` : "Brak kwalifikacji"}
              </p>
            </div>
            <span className={`${expanded ? "px-3 py-1.5 text-[11px]" : "px-2.5 py-1 text-[9px]"} rounded-full border font-black uppercase tracking-wide ${enabled ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-200"}`}>
              {enabled ? "Spełnia warunki" : "Do poprawy"}
            </span>
          </div>

          {enabled && (
            <div className={`${expanded ? "mt-6 gap-5 pt-5" : "mt-4 gap-3 pt-3"} grid grid-cols-2 border-t border-white/10`}>
              <div>
                <p className={`${expanded ? "text-xs" : "text-[9px]"} uppercase tracking-wide text-white/40`}>Do magazynu</p>
                <p className={`${expanded ? "mt-2 text-xl" : "mt-1 text-sm"} font-bold`}>{formatMoney(storageSubsidy)} zł</p>
              </div>
              <div>
                <p className={`${expanded ? "text-xs" : "text-[9px]"} uppercase tracking-wide text-white/40`}>Premia UE</p>
                <p className={`${expanded ? "mt-2 text-xl" : "mt-1 text-sm"} font-bold`}>{formatMoney(euBonus)} zł</p>
              </div>
            </div>
          )}
        </div>

        <div className={`${expanded ? "p-6" : "p-3"} rounded-[18px] border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={`${expanded ? "text-xs" : "text-[9px]"} font-black uppercase tracking-[0.18em] text-slate-400`}>Ulga PIT</p>
              <p className={`${expanded ? "mt-2 text-sm" : "mt-1 text-xs"} text-slate-500`}>Szacowana korzyść podatkowa</p>
              <p className={`${expanded ? "mt-2 text-4xl" : "mt-1 text-2xl"} font-black tracking-tight text-slate-950 dark:text-white`}>{formatMoney(estimatedPitBenefit)} zł</p>
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-950" aria-label="Stawka podatku PIT">
              {([12, 19, 32] as const).map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setPitRate(rate)}
                  aria-pressed={pitRate === rate}
                  className={`${expanded ? "px-3 py-2 text-xs" : "px-2 py-1.5 text-[10px]"} rounded-lg font-black transition ${pitRate === rate ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
                >
                  {rate}%
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-2.5 dark:border-slate-800">
            <span className="text-[10px] text-slate-400">Rozliczenie</span>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-950" aria-label="Liczba podatników korzystających z ulgi">
              {([
                { value: 1 as const, label: "1 podatnik" },
                { value: 2 as const, label: "Małżeństwo" },
              ]).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPitTaxpayers(option.value)}
                  aria-pressed={pitTaxpayers === option.value}
                  className={`rounded-md px-2 py-1 text-[9px] font-bold transition ${pitTaxpayers === option.value ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white" : "text-slate-400 hover:text-slate-700 dark:hover:text-white"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-[10px]">
            <span className="text-slate-400">Podstawa odliczenia po dotacji</span>
            <strong className="text-slate-700 dark:text-slate-200">{formatMoney(pitDeductionBase)} zł</strong>
          </div>
          <p className="mt-2 text-[9px] leading-4 text-slate-400">
            Limit: {formatMoney(pitDeductionLimit)} zł ({formatMoney(53_000)} zł na podatnika). Małżonkowie muszą być uprawnieni do ulgi i wspólnie ponieść wydatek; ostateczna kwota zależy od kwalifikowanych wydatków, dochodu i rozliczenia PIT.
          </p>
        </div>

        <div className={`${expanded ? "p-5" : "p-3"} rounded-[18px] border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900`}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Warunki programu</p>
            <p className="text-[10px] font-semibold text-slate-500">PV: {formatNumber(totalPvPower)} kWp</p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {eligibilityChecks.map((check) => (
              <div key={check.label} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${check.passed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-slate-100 text-slate-400 dark:bg-slate-800"}`}>
                    {check.passed ? "✓" : "—"}
                  </span>
                  <span className={`${expanded ? "text-sm" : "text-xs"} font-semibold text-slate-700 dark:text-slate-200`}>{check.label}</span>
                </div>
                <span className={`${expanded ? "text-xs" : "text-[10px]"} shrink-0 font-bold text-slate-500 dark:text-slate-400`}>{check.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`${expanded ? "p-5" : "p-3"} rounded-[18px] border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Podział do dokumentów</p>
              <p className="mt-1 text-xs text-slate-500">Wartości netto</p>
            </div>
            <button
              type="button"
              onClick={() => setShowDetails((current) => !current)}
              className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
            >
              {showDetails ? "Mniej" : "Szczegóły"}
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-950">
              <p className="text-[9px] text-slate-400">Magazyn energii</p>
              <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">{formatMoney(allocation?.storageNet || 0)} zł</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-950">
              <p className="text-[9px] text-slate-400">PV + falownik</p>
              <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">{formatMoney(remainingPvAndInverterNet)} zł</p>
            </div>
          </div>
          {showDetails && (
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 pt-3 text-[10px] dark:border-slate-800">
              <div><dt className="text-slate-400">Koszt kwalifikowany</dt><dd className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">{formatMoney(allocation?.qualifyingStorageCost || 0)} zł</dd></div>
              <div><dt className="text-slate-400">Podstawa</dt><dd className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">{allocation?.qualifyVat ? "brutto" : "netto"}</dd></div>
              <div><dt className="text-slate-400">Cena magazynu / kWh</dt><dd className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">{formatMoney(storageNetPerKwh)} zł</dd></div>
              <div><dt className="text-slate-400">Maks. dotacja</dt><dd className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">{formatMoney(allocation?.maxStorageSubsidy || 0)} zł</dd></div>
            </dl>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className={`${compact ? "" : "mt-5"} overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900`}>
      <div className="h-1.5 bg-gradient-to-r from-blue-500 via-emerald-400 to-cyan-400" />
      <div className={compact ? "p-4" : "p-5"}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
          Dotacja Przydomowe Magazyny Energii
        </p>
        <h2 className="mt-1 text-lg font-black text-slate-950 dark:text-slate-100">
          Wyliczenie dotacji
        </h2>

        {!enabled && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200">
            <p className="font-black">Dotacja PME nie przysługuje w tej konfiguracji.</p>
            <p className="mt-2 leading-6">
              Magazyn musi mieć co najmniej 10 kWh i pojemność minimum dwukrotnie większą od łącznej mocy PV.
              Wybrano {formatNumber(storageCapacity)} kWh przy {formatNumber(totalPvPower)} kWp PV;
              wymagane minimum to {formatNumber(requiredStorageCapacity)} kWh.
            </p>
          </div>
        )}

        <div className={`mt-5 grid gap-2 ${compact ? "grid-cols-3" : "grid-cols-1 md:grid-cols-3"}`}>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-950/30">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
              Łączna dotacja
            </p>
            <div className={`${compact ? "text-xl" : "text-3xl"} mt-2 font-black text-emerald-700 dark:text-emerald-300`}>
              {formatMoney(totalSubsidy)} zł
            </div>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 dark:border-blue-500/30 dark:bg-blue-950/30">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">
              Dotacja do magazynu
            </p>
            <div className={`${compact ? "text-xl" : "text-3xl"} mt-2 font-black text-blue-700 dark:text-blue-300`}>
              {formatMoney(storageSubsidy)} zł
            </div>
            <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-300/80">
              30% kosztu, maks. {formatMoney(allocation?.maxStorageSubsidy || 0)} zł
            </p>
          </div>

          <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-3 dark:border-cyan-500/30 dark:bg-cyan-950/30">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300">
              Bonus za produkt UE
            </p>
            <div className={`${compact ? "text-xl" : "text-3xl"} mt-2 font-black text-cyan-700 dark:text-cyan-300`}>
              {formatMoney(euBonus)} zł
            </div>
            <p className="mt-1 text-xs text-cyan-700/80 dark:text-cyan-300/80">
              {allocation?.euBonusEligible
                ? "50% kosztu kwalifikowanego, maks. 2 000 zł"
                : "Falownik i magazyn bez oznaczenia EU?"}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Podział ceny do umowy i faktury
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-white p-3 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Magazyn energii</p>
              <p className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">
                {formatMoney(allocation?.storageNet || 0)} zł netto
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {formatMoney(storageNetPerKwh)} zł netto/kWh
              </p>
            </div>
            <div className="rounded-xl bg-white p-3 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Pozostała cena: falownik + PV</p>
              <p className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">
                {formatMoney(remainingPvAndInverterNet)} zł netto
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Najpierw maksymalizowana jest kwalifikowana wartość magazynu.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowDetails((current) => !current)}
          className="mt-4 text-sm font-bold text-blue-700 hover:text-blue-600 dark:text-blue-300"
        >
          {showDetails ? "Ukryj szczegóły" : "Pokaż szczegóły"}
        </button>

        {showDetails && (
          <div className="mt-3 grid gap-2 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-300 sm:grid-cols-2">
            <p>Koszt kwalifikowany: <strong>{formatMoney(allocation?.qualifyingStorageCost || 0)} zł</strong></p>
            <p>Podstawa: <strong>{allocation?.qualifyVat ? "brutto (VAT kwalifikowany)" : "netto"}</strong></p>
            <p>VAT w koszcie kwalifikowanym: <strong>{formatMoney(allocation?.qualifyingVat || 0)} zł</strong></p>
            <p>Magazyn UE: <strong>{allocation?.storageIsEu ? "tak" : "nie"}</strong></p>
            <p>Falownik UE: <strong>{allocation?.inverterIsEu ? "tak" : "nie"}</strong></p>
          </div>
        )}
      </div>
    </section>
  );
}
