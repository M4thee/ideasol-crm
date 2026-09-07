import type { Arimr2026CalculationResult } from "@/lib/calculator/arimr2026";

function formatMoney(value: number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat("pl-PL", {
    maximumFractionDigits: digits,
  }).format(value);
}

function Row({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-0 dark:border-slate-800">
      <div>
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</p>
        {detail ? <p className="mt-0.5 text-[11px] leading-4 text-slate-400">{detail}</p> : null}
      </div>
      <p className="shrink-0 text-right text-sm font-black text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

export default function Arimr2026GrantSummary({
  result,
}: {
  result: Arimr2026CalculationResult;
}) {
  return (
    <div className="space-y-3 p-2">
      <div className="rounded-2xl bg-[#102a43] p-4 text-white dark:border dark:border-[#345779] dark:bg-[#081a2c]">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-400">ARiMR 2026 · obszar B</p>
        <p className="mt-2 text-2xl font-black">{formatMoney(result.grantAfterLimit)}</p>
        <p className="mt-1 text-xs text-slate-400">Dotacja po zastosowaniu limitu programu</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-900">
        <Row label="Cena instalacji netto / brutto" value={`${formatMoney(result.salePriceNet)} / ${formatMoney(result.salePriceGross)}`} detail={`VAT ${formatNumber(result.vatRate)}%`} />
        <Row label="Dotacja PV" value={formatMoney(result.pvGrant)} />
        <Row label="Dotacja magazynu" value={formatMoney(result.storageGrant)} />
        <Row label="Suma dotacji" value={formatMoney(result.grantAfterLimit)} detail={`Efektywne pokrycie ceny netto: ${formatNumber(result.effectiveCoveragePercent, 1)}%`} />
        <Row label="Wkład własny netto / brutto" value={`${formatMoney(result.customerPaymentNet)} / ${formatMoney(result.customerPaymentGross)}`} />
      </div>

      <div className={`rounded-2xl border p-4 text-xs leading-5 ${result.meetsStorageRequirement ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100" : "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"}`}>
        <p className="font-black">
          {result.meetsStorageRequirement ? "Warunek pojemności magazynu spełniony" : "Magazyn nie spełnia warunku programu"}
        </p>
        <p className="mt-1">
          Minimalna wymagana pojemność: {formatNumber(result.requiredStorageCapacityKwh)} kWh.
        </p>
      </div>

      {result.grantLimitReduction > 0 ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs leading-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          Limit obszaru B obniżył wyliczoną dotację o <strong>{formatMoney(result.grantLimitReduction)}</strong>.
        </div>
      ) : null}

      {result.grantExceedsNetSalePrice ? (
        <div className="rounded-2xl border border-cyan-300 bg-cyan-50 p-4 text-xs leading-5 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100">
          <p className="font-black">Dotacja przekracza cenę sprzedaży netto.</p>
          <p className="mt-1">Kalkulator stosuje stawkę jednostkową ARiMR i nie ogranicza dotacji do wartości faktury. Wynik wymaga potwierdzenia z finalnym regulaminem naboru 2026.</p>
        </div>
      ) : null}
    </div>
  );
}
