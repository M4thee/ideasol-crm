"use client";

import { useMemo, useState } from "react";

type SubsidyOptimizerProps = {
  storageCapacity: number;
  storageGrossPrice: number;
  inverterGrossPrice?: number;
  isNetBilling: boolean;
  isEuStorage: boolean;
  isEuHybridInverter: boolean;
};

function formatMoney(value: number) {
  return value.toLocaleString("pl-PL", {
    maximumFractionDigits: 0,
  });
}

export default function SubsidyOptimizer({
  storageCapacity,
  storageGrossPrice,
  inverterGrossPrice,
  isNetBilling,
  isEuStorage,
  isEuHybridInverter,
}: SubsidyOptimizerProps) {
  const [showDetails, setShowDetails] = useState(false);

  const calculations = useMemo(() => {
    const totalNetPrice = Math.max(storageGrossPrice, 0);

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
    const eligibleDeviceNet = canApplyEuBonus
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
  // storageGrossPrice is currently used as the total offer NET price from OfferResult.
  }, [
    storageCapacity,
    storageGrossPrice,
    isNetBilling,
    isEuStorage,
    isEuHybridInverter,
  ]);

  const statusLabel = !calculations.hasStorage
    ? "Magazyn < 10 kWh"
    : calculations.totalSubsidy <= 0
      ? "Brak dotacji"
      : calculations.hasEnoughNetForFullStorageSubsidy
        ? "Optymalnie"
        : "Częściowo";

  const statusClass = calculations.hasStorage && calculations.totalSubsidy > 0
    ? "border-emerald-100 bg-emerald-50 text-emerald-700"
    : "border-amber-100 bg-amber-50 text-amber-700";

  return (
    <section className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="h-1.5 bg-gradient-to-r from-blue-500 via-emerald-400 to-cyan-400" />

      <div className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              Dotacja PME
            </p>
            <h2 className="mt-1 text-lg font-black text-slate-950">
              Optymalna rozpiska ceny
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Moduł rozpisuje cenę sprzedażową netto całej oferty tak, aby w pierwszej
              kolejności maksymalizować możliwą dotację klienta.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="w-fit rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            {showDetails ? "Ukryj" : "Szczegóły"}
          </button>
        </div>

        <div className="mt-5 grid gap-3 grid-cols-1 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
              Maksymalna dotacja
            </p>
            <div className="mt-2 text-3xl font-black text-emerald-700">
              {formatMoney(calculations.totalSubsidy)} zł
            </div>
            <p className="mt-1 text-xs text-emerald-700/80">
              Netto po dotacji: {formatMoney(calculations.priceAfterSubsidy)} zł
            </p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
              Dotacja ME
            </p>
            <div className="mt-2 text-3xl font-black text-blue-700">
              {formatMoney(calculations.storageSubsidy)} zł
            </div>
            <p className="mt-1 text-xs text-blue-700/80">
              Limit: {formatMoney(calculations.maxStorageSubsidy)} zł
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700">
              Bonus EMS
            </p>
            <div className="mt-2 text-3xl font-black text-cyan-700">
              {formatMoney(calculations.inverterBonus)} zł
            </div>
            <p className="mt-1 text-xs text-cyan-700/80">
              EMS: {formatMoney(calculations.targetInverterNet)} zł netto
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Rozpiska ceny netto do umowy / faktury
              </p>
              <h3 className="mt-1 text-lg font-black text-slate-950">
                Proponowany podział wartości
              </h3>
            </div>

            <div className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${statusClass}`}>
              {statusLabel}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-900">Magazyn energii</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {storageCapacity > 0
                      ? `${storageCapacity} kWh • ${formatMoney(calculations.storageNetPerKwh)} zł/kWh`
                      : "Brak pojemności"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-blue-700">
                    {formatMoney(calculations.targetStorageNet)} zł
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    dotacja: {formatMoney(calculations.storageSubsidy)} zł
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-900">EMS / HEMS</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Wartość optymalizowana pod bonus 50%, maks. 2 000 zł.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-cyan-700">
                    {formatMoney(calculations.targetInverterNet)} zł
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    bonus: {formatMoney(calculations.inverterBonus)} zł
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-900">PV + montaż + pozostałe elementy</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Pozostała część ceny netto oferty.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-slate-950">
                    {formatMoney(calculations.remainingNet)} zł
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <p>
              Optymalizator najpierw rezerwuje wartość EMS dla bonusu, potem ustawia wartość magazynu energii na poziomie potrzebnym do maksymalnej możliwej dotacji, a resztę zostawia jako PV, montaż i pozostałe elementy.
            </p>
          </div>
        </div>

        {!calculations.hasStorage && (
          <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Program wymaga magazynu energii o pojemności minimum 10 kWh.
          </div>
        )}

        {showDetails && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-3 text-sm grid-cols-1 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="font-black text-slate-950">Mechanika wyliczenia</h3>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Cena oferty netto</span>
                    <strong className="text-slate-950">
                      {formatMoney(calculations.totalNetPrice)} zł
                    </strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">System rozliczeń</span>
                    <strong className="text-slate-950">
                      {isNetBilling ? "Net-billing" : "Net-metering"}
                    </strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Limit 800 zł/kWh</span>
                    <strong className="text-slate-950">
                      {formatMoney(calculations.storageCapByKwh)} zł
                    </strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Limit programu</span>
                    <strong className="text-slate-950">
                      {formatMoney(calculations.programCap)} zł
                    </strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Bonus EMS</span>
                    <strong className="text-slate-950">
                      {formatMoney(calculations.inverterBonus)} zł
                    </strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Cena ME dla maks. dotacji</span>
                    <strong className="text-slate-950">
                      {formatMoney(calculations.idealStorageNet)} zł
                    </strong>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <h3 className="font-black text-slate-950">Rekomendacja</h3>
                <div className="mt-3 space-y-2 text-slate-700">
                  <p>
                    Żeby uzyskać maksymalną dotację do magazynu, jego wartość
                    na fakturze powinna wynieść minimum:
                  </p>
                  <div className="rounded-xl bg-white px-4 py-3 text-center font-black text-blue-700 ring-1 ring-blue-100">
                    {formatMoney(calculations.minStorageNetForMaxSubsidy)} zł netto
                  </div>
                  <p className="text-xs leading-5 text-slate-500">
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