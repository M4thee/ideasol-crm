"use client";

import { useMemo, useState } from "react";

type SubsidyOptimizerProps = {
  storageCapacity: number;
  totalOfferNetPrice: number;
  inverterGrossPrice?: number;
  isNetBilling: boolean;
  isEuStorage: boolean;
  isEuHybridInverter: boolean;
  subsidyEnabled?: boolean;
  withEms?: boolean;
  requiredStorageCapacityKwh?: number;
  totalPvPowerForSubsidyKw?: number;
};

function formatMoney(value: number) {
  return value.toLocaleString("pl-PL", {
    maximumFractionDigits: 0,
  });
}

export default function SubsidyOptimizer({
  storageCapacity,
  totalOfferNetPrice,
  inverterGrossPrice,
  isNetBilling,
  isEuStorage,
  isEuHybridInverter,
  subsidyEnabled = false,
  withEms = false,
  requiredStorageCapacityKwh = 0,
  totalPvPowerForSubsidyKw = 0,
}: SubsidyOptimizerProps) {
  const [showDetails, setShowDetails] = useState(false);

  const isStorageBelowProgramMinimum =
    storageCapacity > 0 && storageCapacity < 10;

  const calculations = useMemo(() => {
    const totalNetPrice = Math.max(totalOfferNetPrice, 0);

    if (!subsidyEnabled) {
      return {
        totalNetPrice,
        symbolicPvNet: 0,
        priceAvailableForStorageNet: 0,
        hasStorage: false,
        storageCapByKwh: 0,
        programCap: isNetBilling ? 16000 : 8000,
        maxStorageSubsidy: 0,
        minStorageNetForMaxSubsidy: 0,
        maxStorageNetByProgramLimit: 0,
        idealStorageNet: 0,
        targetStorageNet: 0,
        eligibleDeviceNet: 0,
        targetInverterNet: 0,
        remainingNet: totalNetPrice,
        storageSubsidy: 0,
        inverterBonus: 0,
        totalSubsidy: 0,
        priceAfterSubsidy: totalNetPrice,
        storageNetPerKwh: 0,
        canApplyEuBonus: false,
        hasEnoughNetForFullStorageSubsidy: false,
        storageLimitValid: false,
      };
    }

    // Symboliczna wartość pozostaje tylko informacyjnie.
    const symbolicPvNet = 0;

    const hasStorage = storageCapacity >= 10;
    const storageCapByKwh = storageCapacity * 800;
    const programCap = isNetBilling ? 16000 : 8000;
    const maxStorageSubsidy = hasStorage
      ? Math.min(storageCapByKwh, programCap)
      : 0;

    const minStorageNetForMaxSubsidy = maxStorageSubsidy / 0.3;
    const maxStorageNetByProgramLimit = storageCapacity * 3000;

    const canApplyEuBonus = Boolean(isEuStorage && isEuHybridInverter);

    // EMS w optymalizacji dotacyjnej nie oznacza kosztu zakupu EMS.
    // To wartość EMS możliwa do rozpisania na umowie/fakturze, aby uzyskać bonus 50% max 2000 zł.
    const eligibleDeviceNet = canApplyEuBonus && withEms
      ? Math.min(4000, totalNetPrice)
      : 0;

    // Żeby uzyskać pełne 2000 zł bonusu, EMS powinien mieć wartość 4000 zł netto,
    // o ile całkowita cena netto oferty na to pozwala.
    const targetInverterNet = eligibleDeviceNet;

    const inverterBonus = canApplyEuBonus
      ? Math.min(targetInverterNet * 0.5, 2000)
      : 0;

    const priceAvailableForStorageNet = Math.max(
      totalNetPrice - targetInverterNet,
      0
    );

    const idealStorageNet = minStorageNetForMaxSubsidy;

    const targetStorageNet = hasStorage
      ? Math.min(
          idealStorageNet,
          priceAvailableForStorageNet,
          maxStorageNetByProgramLimit
        )
      : 0;

    const storageSubsidy = hasStorage
      ? Math.min(
          targetStorageNet * 0.3,
          storageCapByKwh,
          programCap
        )
      : 0;

    const remainingNet = Math.max(
      totalNetPrice - targetStorageNet - targetInverterNet,
      0
    );

    const totalSubsidy = storageSubsidy + inverterBonus;
    const priceAfterSubsidy = Math.max(totalNetPrice - totalSubsidy, 0);
    const storageNetPerKwh = storageCapacity > 0
      ? targetStorageNet / storageCapacity
      : 0;

    const hasEnoughNetForFullStorageSubsidy =
      priceAvailableForStorageNet >= minStorageNetForMaxSubsidy;
    const storageLimitValid = storageNetPerKwh <= 3000;

    return {
      totalNetPrice,
      symbolicPvNet,
      priceAvailableForStorageNet,
      hasStorage,
      storageCapByKwh,
      programCap,
      maxStorageSubsidy,
      minStorageNetForMaxSubsidy,
      maxStorageNetByProgramLimit,
      idealStorageNet,
      targetStorageNet,
      eligibleDeviceNet,
      targetInverterNet,
      remainingNet,
      storageSubsidy,
      inverterBonus,
      totalSubsidy,
      priceAfterSubsidy,
      storageNetPerKwh,
      canApplyEuBonus,
      hasEnoughNetForFullStorageSubsidy,
      storageLimitValid,
    };
  }, [
    storageCapacity,
    totalOfferNetPrice,
    isNetBilling,
    isEuStorage,
    isEuHybridInverter,
    subsidyEnabled,
    withEms,
  ]);

  const statusLabel = isStorageBelowProgramMinimum
    ? "Magazyn < 10 kWh"
    : calculations.totalSubsidy <= 0
      ? "Brak dotacji"
      : calculations.hasEnoughNetForFullStorageSubsidy
        ? "Optymalnie"
        : "Częściowo";

  const statusClass = calculations.hasStorage && calculations.totalSubsidy > 0
    ? "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-300"
    : "border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-300";

  return (
    <section className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="h-1.5 bg-gradient-to-r from-blue-500 via-emerald-400 to-cyan-400" />

      <div className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
              Dotacja Przydomowe Magazyny Energii
            </p>
            <h2 className="mt-1 text-lg font-black text-slate-950 dark:text-slate-100">
              Optymalizator Dotacji
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          
            </p>
          </div>

        </div>

        {!subsidyEnabled && (
          <div className="mb-4 mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200">
            <p className="text-sm font-black uppercase tracking-[0.14em] text-red-700 dark:text-red-300">
              Dotacja PME nie przysługuje w tej konfiguracji.
            </p>

            <p className="mt-2 text-sm leading-6 text-red-900 dark:text-red-200">
              Pojemność magazynu energii musi być minimum dwukrotnością mocy szczytowej PV.
              Obecnie wybrany magazyn ma {Number(storageCapacity).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} kWh,
              a moc fotowoltaiki to {Number(totalPvPowerForSubsidyKw).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} kWp.
              Minimalny magazyn dla takiej mocy PV to {Number(requiredStorageCapacityKwh).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} kWh.
            </p>
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/30">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
              Maksymalna dotacja
            </p>
            <div className="mt-2 text-3xl font-black text-emerald-700 dark:text-emerald-300">
              {formatMoney(calculations.totalSubsidy)} zł
            </div>
            <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">
              Netto po dotacji: {formatMoney(calculations.priceAfterSubsidy)} zł
            </p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-950/30">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">
              Dotacja ME
            </p>
            <div className="mt-2 text-3xl font-black text-blue-700 dark:text-blue-300">
              {formatMoney(calculations.storageSubsidy)} zł
            </div>
            <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-300/80">
              Limit: {formatMoney(calculations.maxStorageSubsidy)} zł
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4 dark:border-cyan-500/30 dark:bg-cyan-950/30">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300">
              Bonus EMS / HEMS
            </p>
            <div className="mt-2 text-3xl font-black text-cyan-700 dark:text-cyan-300">
              {formatMoney(calculations.inverterBonus)} zł
            </div>
            <p className="mt-1 text-xs text-cyan-700/80 dark:text-cyan-300/80">
              {withEms
                ? `EMS: ${formatMoney(calculations.targetInverterNet)} zł netto`
                : "EMS / HEMS nie wybrany"}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Rozpiska ceny netto do umowy / faktury
              </p>
              <h3 className="mt-1 text-lg font-black text-slate-950 dark:text-slate-100">
                Proponowany podział wartości
              </h3>
            </div>

            <div className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${statusClass}`}>
              {statusLabel}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-white bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Magazyn energii</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {storageCapacity > 0
                      ? `${storageCapacity} kWh • ${formatMoney(calculations.storageNetPerKwh)} zł/kWh` 
                      : "Brak pojemności"}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                    Limit programu: maks. 3 000 zł netto / kWh
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-blue-700 dark:text-blue-300">
                    {formatMoney(calculations.targetStorageNet)} zł
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    dotacja: {formatMoney(calculations.storageSubsidy)} zł
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">EMS / HEMS</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Wartość optymalizowana pod bonus 50%, maks. 2 000 zł.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-cyan-700 dark:text-cyan-300">
                    {formatMoney(calculations.targetInverterNet)} zł
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    bonus: {formatMoney(calculations.inverterBonus)} zł
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">PV + montaż + pozostałe elementy</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Pozostała część ceny netto oferty.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-slate-950 dark:text-slate-100">
                    {formatMoney(calculations.remainingNet)} zł
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
            <p>
              Optymalizator najpierw rezerwuje wartość EMS dla bonusu, potem ustawia wartość magazynu energii na poziomie potrzebnym do maksymalnej możliwej dotacji, a resztę zostawia jako PV, montaż i pozostałe elementy.
            </p>
            <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
              Wartość magazynu energii w rozpisce nie przekracza limitu programu: 3 000 zł netto za 1 kWh pojemności nominalnej.
            </p>

            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              className="mt-4 w-fit rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              {showDetails ? "Mniej" : "Więcej"}
            </button>
          </div>
        </div>

        {isStorageBelowProgramMinimum && (
          <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-300">
            Program wymaga magazynu energii o pojemności minimum 10 kWh.
          </div>
        )}

        {showDetails && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="grid grid-cols-1 gap-3 text-sm xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
                <h3 className="font-black text-slate-950 dark:text-slate-100">Mechanika wyliczenia</h3>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500 dark:text-slate-400">Cena oferty netto</span>
                    <strong className="text-slate-950 dark:text-slate-100">
                      {formatMoney(calculations.totalNetPrice)} zł
                    </strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500 dark:text-slate-400">System rozliczeń</span>
                    <strong className="text-slate-950 dark:text-slate-100">
                      {isNetBilling ? "Net-billing" : "Net-metering"}
                    </strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500 dark:text-slate-400">Limit 800 zł/kWh</span>
                    <strong className="text-slate-950 dark:text-slate-100">
                      {formatMoney(calculations.storageCapByKwh)} zł
                    </strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500 dark:text-slate-400">Limit programu</span>
                    <strong className="text-slate-950 dark:text-slate-100">
                      {formatMoney(calculations.programCap)} zł
                    </strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500 dark:text-slate-400">Bonus EMS</span>
                    <strong className="text-slate-950 dark:text-slate-100">
                      {formatMoney(calculations.inverterBonus)} zł
                    </strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500 dark:text-slate-400">Cena ME dla maks. dotacji</span>
                    <strong className="text-slate-950 dark:text-slate-100">
                      {formatMoney(calculations.idealStorageNet)} zł
                    </strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500 dark:text-slate-400">Maks. wartość ME wg 3 000 zł/kWh</span>
                    <strong className="text-slate-950 dark:text-slate-100">
                      {formatMoney(calculations.maxStorageNetByProgramLimit)} zł
                    </strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500 dark:text-slate-400">Limit 3 000 zł/kWh</span>
                    <strong className={calculations.storageLimitValid ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}>
                      {calculations.storageLimitValid ? "Spełniony" : "Przekroczony"}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-950/30">
                <h3 className="font-black text-slate-950 dark:text-slate-100">Rekomendacja</h3>
                <div className="mt-3 space-y-2 text-slate-700 dark:text-slate-300">
                  <p>
                    Żeby uzyskać maksymalną dotację do magazynu, jego wartość
                    na fakturze powinna wynieść minimum:
                  </p>
                  <div className="rounded-xl bg-white px-4 py-3 text-center font-black text-blue-700 ring-1 ring-blue-100 dark:bg-slate-950 dark:text-blue-300 dark:ring-blue-500/30">
                    {formatMoney(calculations.minStorageNetForMaxSubsidy)} zł netto
                  </div>
                  <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Wartość ME pokazana powyżej jest minimalną wartością potrzebną do osiągnięcia maksymalnej możliwej dotacji dla magazynu. Jeżeli klient nie chce optymalizacji na umowie/fakturze, przy sprzedaży będzie można wybrać standardową rozpiskę.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}