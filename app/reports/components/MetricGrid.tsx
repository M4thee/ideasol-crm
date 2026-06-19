import type { MetricCard, MetricDetailType } from "../types";

type MetricGridProps = {
  metrics: MetricCard[];
  onMetricClick?: (detailType: MetricDetailType) => void;
};

export function MetricGrid({ metrics, onMetricClick }: MetricGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {metrics.map((metric) => {
        const isClickable = Boolean(metric.detailType && onMetricClick);

        return (
          <button
            key={metric.label}
            type="button"
            onClick={() => {
              if (metric.detailType && onMetricClick) {
                onMetricClick(metric.detailType);
              }
            }}
            disabled={!isClickable}
            className={`rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left shadow-sm transition ${
              isClickable ? "cursor-pointer hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50" : "cursor-default"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{metric.value}</p>
              </div>

              {metric.change ? (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    metric.changeTone === "positive"
                      ? "bg-emerald-100 text-emerald-700"
                      : metric.changeTone === "negative"
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {metric.change}
                </span>
              ) : null}
            </div>

            {metric.hint ? <p className="mt-3 text-xs leading-relaxed text-slate-500">{metric.hint}</p> : null}
          </button>
        );
      })}
    </div>
  );
}