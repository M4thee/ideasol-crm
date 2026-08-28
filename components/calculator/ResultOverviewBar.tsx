type ResultOverviewBarProps = {
  priceGross: number;
  pvPowerKw?: number;
  storageCapacityKwh?: number;
  expanded?: boolean;
};

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("pl-PL", { maximumFractionDigits: 2 });
}

export default function ResultOverviewBar({
  priceGross,
  pvPowerKw,
  storageCapacityKwh,
  expanded = false,
}: ResultOverviewBarProps) {
  return (
    <div className={`${expanded ? "mb-5 gap-5 py-5" : "mb-3 gap-2 py-3"} grid grid-cols-[1.35fr_1fr_1fr] border-y border-white/10`}>
      <div>
        <p className={`${expanded ? "text-xs" : "text-[8px]"} font-bold uppercase tracking-[0.16em] text-white/40`}>Cena brutto</p>
        <p className={`${expanded ? "mt-2 text-4xl" : "mt-1 text-lg"} font-black tracking-tight text-white`}>{formatNumber(priceGross)} zł</p>
      </div>
      <div className={`${expanded ? "pl-6" : "pl-3"} border-l border-white/10`}>
        <p className={`${expanded ? "text-xs" : "text-[8px]"} font-bold uppercase tracking-[0.16em] text-white/40`}>Moc PV</p>
        <p className={`${expanded ? "mt-2 text-2xl" : "mt-1 text-sm"} font-black text-white`}>
          {Number(pvPowerKw || 0) > 0 ? `${formatNumber(Number(pvPowerKw))} kWp` : "—"}
        </p>
      </div>
      <div className={`${expanded ? "pl-6" : "pl-3"} border-l border-white/10`}>
        <p className={`${expanded ? "text-xs" : "text-[8px]"} font-bold uppercase tracking-[0.16em] text-white/40`}>Magazyn</p>
        <p className={`${expanded ? "mt-2 text-2xl" : "mt-1 text-sm"} font-black text-white`}>
          {Number(storageCapacityKwh || 0) > 0 ? `${formatNumber(Number(storageCapacityKwh))} kWh` : "—"}
        </p>
      </div>
    </div>
  );
}
