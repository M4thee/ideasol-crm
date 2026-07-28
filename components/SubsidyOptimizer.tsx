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
  allocation?: SubsidyAllocation;
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
  allocation,
}: SubsidyOptimizerProps) {
  const [showDetails, setShowDetails] = useState(false);
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

  return (
    <section className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="h-1.5 bg-gradient-to-r from-blue-500 via-emerald-400 to-cyan-400" />
      <div className="p-5">
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

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/30">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
              Łączna dotacja
            </p>
            <div className="mt-2 text-3xl font-black text-emerald-700 dark:text-emerald-300">
              {formatMoney(totalSubsidy)} zł
            </div>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-950/30">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">
              Dotacja do magazynu
            </p>
            <div className="mt-2 text-3xl font-black text-blue-700 dark:text-blue-300">
              {formatMoney(storageSubsidy)} zł
            </div>
            <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-300/80">
              30% kosztu, maks. {formatMoney(allocation?.maxStorageSubsidy || 0)} zł
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4 dark:border-cyan-500/30 dark:bg-cyan-950/30">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300">
              Bonus za produkt UE
            </p>
            <div className="mt-2 text-3xl font-black text-cyan-700 dark:text-cyan-300">
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
