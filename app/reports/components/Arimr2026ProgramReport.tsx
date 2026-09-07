import type { Arimr2026ProgramSummary } from "@/lib/calculator/arimr2026Sales";

function formatNumber(value: number, maximumFractionDigits = 2) {
  return value.toLocaleString("pl-PL", { maximumFractionDigits });
}

function formatMoney(value: number) {
  return `${value.toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} zł`;
}

function ProgressBar({ value }: { value: number }) {
  const displayedValue = Math.max(0, value);
  const barWidth = Math.min(displayedValue, 100);

  return (
    <div className="min-w-40">
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold text-slate-950">{formatNumber(displayedValue, 1)}%</span>
        <span className="text-xs text-slate-500">cel 100%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full ${displayedValue >= 100 ? "bg-emerald-500" : "bg-amber-400"}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}

export function Arimr2026ProgramReport({
  summary,
  loading,
  error,
}: {
  summary: Arimr2026ProgramSummary;
  loading: boolean;
  error: string;
}) {
  const metrics = [
    { label: "Sprzedaże ARiMR", value: String(summary.salesCount) },
    { label: "Łączna moc PV", value: `${formatNumber(summary.pvPowerKwp)} kWp` },
    {
      label: "Magazyny energii",
      value: `${formatNumber(summary.storageCapacityKwh)} kWh`,
      hint: `${summary.storageUnits} szt. do realizacji planu`,
    },
    { label: "Prowizje do rozliczenia", value: formatMoney(summary.compensationNet) },
  ];

  return (
    <>
      {loading ? (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm">
          Ładowanie raportu ARiMR 2026...
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-emerald-800">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{metric.value}</p>
            {metric.hint ? <p className="mt-2 text-xs text-slate-500">{metric.hint}</p> : null}
          </div>
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="font-semibold text-slate-950">Realizacja programu per doradca</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Raport obejmuje cały program ARiMR 2026 i nie resetuje się po zmianie miesiąca.
            Anulowane oraz utracone sprzedaże są pomijane. Prowizja jest liczona od łącznego
            wyniku doradcy, maksymalnie ze współczynnikiem 150%.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1280px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Doradca</th>
                <th className="px-5 py-3 text-right">Sprzedaże</th>
                <th className="px-5 py-3 text-right">PV</th>
                <th className="px-5 py-3 text-right">ME</th>
                <th className="px-5 py-3 text-right">Plan</th>
                <th className="px-5 py-3">Realizacja</th>
                <th className="px-5 py-3 text-right">Mnożnik</th>
                <th className="px-5 py-3 text-right">Prowizja PV</th>
                <th className="px-5 py-3 text-right">Prowizja ME</th>
                <th className="px-5 py-3 text-right">Do rozliczenia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {summary.advisors.length > 0 ? (
                summary.advisors.map((advisor) => (
                  <tr key={advisor.advisorId} className="transition hover:bg-slate-50">
                    <td className="px-5 py-4 font-semibold text-slate-950">{advisor.advisorName}</td>
                    <td className="px-5 py-4 text-right text-slate-700">{advisor.salesCount}</td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-900">
                      {formatNumber(advisor.pvPowerKwp)} kWp
                    </td>
                    <td className="px-5 py-4 text-right text-slate-700">
                      <span className="font-semibold text-slate-900">
                        {formatNumber(advisor.storageCapacityKwh)} kWh
                      </span>
                      <span className="ml-1 text-xs text-slate-500">({advisor.storageUnits} szt.)</span>
                    </td>
                    <td className="px-5 py-4 text-right text-slate-700">
                      <span className="font-semibold text-slate-950">
                        {formatNumber(advisor.planContributionKw)} kW
                      </span>
                      <span className="block text-xs text-slate-500">
                        z {formatNumber(advisor.planKw)} kW
                      </span>
                    </td>
                    <td className="px-5 py-4"><ProgressBar value={advisor.planCompletionPercent} /></td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-900">
                      {formatNumber(advisor.payoutMultiplierPercent, 1)}%
                    </td>
                    <td className="px-5 py-4 text-right text-slate-700">
                      {formatMoney(advisor.pvCompensationNet)}
                    </td>
                    <td className="px-5 py-4 text-right text-slate-700">
                      {formatMoney(advisor.storageCompensationNet)}
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-emerald-700">
                      {formatMoney(advisor.compensationNet)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-5 py-6 text-slate-500" colSpan={10}>
                    Brak doradców dostępnych w tym widoku.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
