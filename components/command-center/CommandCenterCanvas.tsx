"use client";

import Image from "next/image";
import type { CSSProperties, DragEvent } from "react";

import type {
  CommandCenterMetrics,
  CommandCenterPage,
  CommandCenterPeriod,
  CommandCenterPeriodValues,
  CommandCenterTheme,
  CommandCenterWidget,
} from "@/lib/command-center/types";

type CommandCenterCanvasProps = {
  page: CommandCenterPage;
  metrics: CommandCenterMetrics;
  dashboardName: string;
  theme: Exclude<CommandCenterTheme, "auto">;
  now?: Date;
  editing?: boolean;
  selectedWidgetId?: string | null;
  onSelectWidget?: (widgetId: string) => void;
  onWidgetDrop?: (sourceWidgetId: string, targetWidgetId: string) => void;
  onLibraryDrop?: (kind: string) => void;
  footer?: React.ReactNode;
};

export const EMPTY_COMMAND_CENTER_METRICS: CommandCenterMetrics = {
  generatedAt: new Date(0).toISOString(),
  leads: {
    yesterday: 0,
    today: 0,
    week: 0,
    month: 0,
    quarter: 0,
    contactedMonth: 0,
    contactRateMonth: 0,
    averageFirstActivityMinutes: null,
    sources: [],
    statuses: [],
    contactRateByPeriod: { yesterday: 0, today: 0, week: 0, month: 0, quarter: 0 },
    averageFirstActivityMinutesByPeriod: { yesterday: null, today: null, week: null, month: null, quarter: null },
    sourcesByPeriod: { yesterday: [], today: [], week: [], month: [], quarter: [] },
    statusesByPeriod: { yesterday: [], today: [], week: [], month: [], quarter: [] },
  },
  sales: {
    yesterday: 0, today: 0, week: 0, month: 0, quarter: 0,
    valueYesterday: 0, valueToday: 0, valueWeek: 0, valueMonth: 0, valueQuarter: 0,
    valueByPeriod: { yesterday: 0, today: 0, week: 0, month: 0, quarter: 0 },
  },
  funnel: {
    leads: 0, contacted: 0, meetings: 0, offers: 0, sales: 0,
    byPeriod: {
      yesterday: { leads: 0, contacted: 0, meetings: 0, offers: 0, sales: 0 },
      today: { leads: 0, contacted: 0, meetings: 0, offers: 0, sales: 0 },
      week: { leads: 0, contacted: 0, meetings: 0, offers: 0, sales: 0 },
      month: { leads: 0, contacted: 0, meetings: 0, offers: 0, sales: 0 },
      quarter: { leads: 0, contacted: 0, meetings: 0, offers: 0, sales: 0 },
    },
  },
  meetings: { yesterday: 0, today: 0, week: 0, month: 0, quarter: 0, scheduledToday: 0, upcomingToday: 0 },
  calls: { yesterday: 0, today: 0, week: 0, month: 0, quarter: 0 },
  leadMap: { points: [], validPostalCodes: 0, locatedLeads: 0 },
  ranking: [],
  rankingByPeriod: { yesterday: [], today: [], week: [], month: [], quarter: [] },
  reliability: [],
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(value);
}

function periodLabel(period: CommandCenterWidget["config"]["period"]) {
  if (period === "yesterday") return "wczoraj";
  if (period === "today") return "dzisiaj";
  if (period === "week") return "w tym tygodniu";
  if (period === "quarter") return "w tym kwartale";
  return "w tym miesiącu";
}

function periodValue(
  values: CommandCenterPeriodValues<number>,
  period: CommandCenterWidget["config"]["period"]
) {
  return values[period || "month"];
}

function Bars({ rows, total, period }: { rows: Array<{ label: string; value: number }>; total: number; period: CommandCenterPeriod }) {
  const visible = rows.slice(0, 6);
  if (!visible.length) return <p className="cc-empty">Brak danych {periodLabel(period)}</p>;
  return (
    <div className="cc-bars">
      {visible.map((row, index) => {
        const percentage = total ? Math.max(4, Math.round((row.value / total) * 100)) : 0;
        return (
          <div className="cc-bar-row" key={row.label}>
            <div className="cc-bar-label"><span>{row.label}</span><strong>{row.value}</strong></div>
            <div className="cc-bar-track"><span style={{ width: `${percentage}%`, opacity: 1 - index * 0.08 }} /></div>
          </div>
        );
      })}
    </div>
  );
}

const POLAND_OUTLINE_POINTS = "579.9,295.4 584.4,305.9 583.5,313.2 609.4,350.8 602.3,358.3 609.3,372.8 609.0,380.2 602.0,390.6 586.3,393.4 525.8,459.7 522.4,465.5 527.4,486.4 525.8,497.1 534.3,504.8 532.1,510.0 484.6,493.8 476.8,482.3 461.7,476.4 428.0,475.8 423.3,482.6 415.3,484.7 400.1,478.1 384.9,478.7 372.9,484.6 366.6,496.2 348.5,494.2 349.5,479.8 340.9,476.8 329.5,460.4 318.0,467.8 311.9,477.4 301.0,477.7 299.2,469.0 292.9,467.9 291.3,459.0 278.6,446.7 276.6,436.2 261.2,433.2 244.5,422.8 232.7,427.3 220.4,415.8 218.1,412.3 226.9,406.0 224.9,399.4 207.6,403.9 191.8,393.3 175.5,389.1 182.1,405.5 161.0,417.1 135.2,389.4 147.8,376.5 139.5,369.5 123.0,373.3 106.3,362.3 83.7,356.1 78.0,343.4 62.0,338.7 61.4,349.6 50.9,352.0 63.4,318.2 56.7,300.1 45.8,294.9 45.9,283.0 38.4,268.3 47.5,246.9 43.2,232.5 35.6,223.0 39.5,208.5 10.0,178.5 27.0,150.9 17.8,105.3 37.4,113.0 35.8,97.2 15.1,93.1 14.2,89.0 133.7,57.1 156.2,34.4 175.8,30.8 198.4,19.3 248.0,10.2 262.3,10.0 288.5,23.2 290.9,27.6 269.0,18.0 283.1,45.0 301.5,52.1 327.4,48.9 339.3,42.6 493.5,51.1 537.1,48.5 570.8,69.7 579.5,116.5 596.9,165.6 597.7,193.5 568.2,209.6 554.0,229.3 582.7,250.5 581.1,270.3 576.3,278.8 579.9,295.4";
const POLAND_BOUNDS = { minLongitude: 14.128613, maxLongitude: 24.105762, minLatitude: 49.020752, maxLatitude: 54.838184 };
const CAMPAIGN_COLORS = ["#1398ef", "#ff991f", "#a855f7", "#24d18b", "#f43f5e", "#14b8a6", "#eab308", "#6366f1", "#ec4899", "#84cc16"];

function campaignColor(campaign: string) {
  if (campaign === "Brak kampanii") return "#94a3b8";
  let hash = 0;
  for (let index = 0; index < campaign.length; index += 1) hash = ((hash << 5) - hash + campaign.charCodeAt(index)) | 0;
  return CAMPAIGN_COLORS[Math.abs(hash) % CAMPAIGN_COLORS.length];
}

function LeadMap({ widget, metrics }: { widget: CommandCenterWidget; metrics: CommandCenterMetrics }) {
  const period = widget.config.period || "month";
  const points = metrics.leadMap.points
    .map((point) => ({ ...point, value: point[period] }))
    .filter((point) => point.value > 0);
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const max = Math.max(...points.map((point) => point.value), 1);
  const campaignRows = Array.from(points.reduce((rows, point) => {
    rows.set(point.campaign, (rows.get(point.campaign) || 0) + point.value);
    return rows;
  }, new Map<string, number>()), ([campaign, value]) => ({ campaign, value }))
    .sort((a, b) => b.value - a.value || a.campaign.localeCompare(b.campaign, "pl"));
  const pointsByPostalCode = points.reduce((rows, point) => {
    rows.set(point.postalCode, [...(rows.get(point.postalCode) || []), point]);
    return rows;
  }, new Map<string, typeof points>());

  return (
    <div className="cc-lead-map">
      <svg aria-label={`Mapa Polski: ${total} leadów ${periodLabel(period)}`} role="img" viewBox="0 0 620 520">
        <polygon className="cc-lead-map-outline" points={POLAND_OUTLINE_POINTS} />
        {points.map((point) => {
          const siblings = pointsByPostalCode.get(point.postalCode) || [point];
          const siblingIndex = siblings.indexOf(point);
          const angle = -Math.PI / 2 + (Math.PI * 2 * siblingIndex) / siblings.length;
          const offset = siblings.length > 1 ? 10 : 0;
          const baseX = 10 + ((point.longitude - POLAND_BOUNDS.minLongitude) / (POLAND_BOUNDS.maxLongitude - POLAND_BOUNDS.minLongitude)) * 600;
          const baseY = 10 + ((POLAND_BOUNDS.maxLatitude - point.latitude) / (POLAND_BOUNDS.maxLatitude - POLAND_BOUNDS.minLatitude)) * 500;
          const x = baseX + Math.cos(angle) * offset;
          const y = baseY + Math.sin(angle) * offset;
          const radius = 4 + Math.sqrt(point.value / max) * 11;
          const color = campaignColor(point.campaign);
          return (
            <circle className="cc-lead-map-dot" cx={x} cy={y} fill={color} key={`${point.postalCode}:${point.campaign}`} r={radius} stroke={color}>
              <title>{`${point.campaign} · ${point.postalCode}: ${point.value}`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="cc-lead-map-summary">
        <strong>{total}</strong>
        <span>leadów {periodLabel(period)}</span>
        <small>{points.length ? `${points.length} punktów kampanii` : "Brak rozpoznanych kodów"}</small>
        {campaignRows.length > 0 && (
          <div className="cc-lead-map-legend" aria-label="Legenda kampanii">
            {campaignRows.slice(0, 8).map((row) => (
              <div className="cc-lead-map-legend-row" key={row.campaign}>
                <i aria-hidden="true" style={{ background: campaignColor(row.campaign) }} />
                <span title={row.campaign}>{row.campaign}</span>
                <b>{row.value}</b>
              </div>
            ))}
            {campaignRows.length > 8 && <em>+{campaignRows.length - 8} pozostałych</em>}
          </div>
        )}
      </div>
    </div>
  );
}

function WidgetBody({ widget, metrics }: { widget: CommandCenterWidget; metrics: CommandCenterMetrics }) {
  const period = widget.config.period || "month";
  if (widget.kind === "leads-kpi") {
    const value = periodValue(metrics.leads, period);
    return <div className="cc-kpi"><strong>{value}</strong><span>leadów {periodLabel(period)}</span></div>;
  }
  if (widget.kind === "sales-kpi") {
    const value = periodValue(metrics.sales, period);
    return <div className="cc-kpi"><strong>{value}</strong><span>sprzedaży {periodLabel(period)}</span></div>;
  }
  if (widget.kind === "sales-value") {
    const value = periodValue(metrics.sales.valueByPeriod, period);
    return <div className="cc-kpi cc-kpi-currency"><strong>{formatCurrency(value)}</strong><span>{periodLabel(period)}</span></div>;
  }
  if (widget.kind === "meetings-kpi") {
    const value = periodValue(metrics.meetings, period);
    return <div className="cc-kpi"><strong>{value}</strong><span>umówionych spotkań {periodLabel(period)}</span></div>;
  }
  if (widget.kind === "meetings-today") {
    return (
      <div className="cc-kpi"><strong>{metrics.meetings.scheduledToday}</strong><span>{metrics.meetings.upcomingToday} jeszcze przed nami</span></div>
    );
  }
  if (widget.kind === "calls-kpi") {
    const value = periodValue(metrics.calls, period);
    return <div className="cc-kpi"><strong>{value}</strong><span>telefonów {periodLabel(period)}</span></div>;
  }
  if (widget.kind === "lead-map") return <LeadMap widget={widget} metrics={metrics} />;
  if (widget.kind === "lead-sources") return <Bars rows={metrics.leads.sourcesByPeriod[period]} total={periodValue(metrics.leads, period)} period={period} />;
  if (widget.kind === "lead-statuses") return <Bars rows={metrics.leads.statusesByPeriod[period]} total={periodValue(metrics.leads, period)} period={period} />;
  if (widget.kind === "lead-funnel") {
    const funnel = metrics.funnel.byPeriod[period];
    const stages = [
      ["Leady", funnel.leads],
      ["Z aktywnością", funnel.contacted],
      ["Spotkania", funnel.meetings],
      ["Oferty", funnel.offers],
      ["Sprzedaże", funnel.sales],
    ] as const;
    return (
      <div className="cc-funnel">
        {stages.map(([label, value], index) => {
          const ratio = funnel.leads ? Math.round((value / funnel.leads) * 100) : 0;
          return (
            <div className="cc-funnel-row" key={label} style={{ width: `${100 - index * 9}%` }}>
              <span>{label}</span><strong>{value}</strong><em>{ratio}%</em>
            </div>
          );
        })}
      </div>
    );
  }
  if (widget.kind === "advisor-ranking") {
    const metric = widget.config.rankingMetric || "salesValue";
    const rows = [...metrics.rankingByPeriod[period]]
      .sort((a, b) => Number(b[metric]) - Number(a[metric]) || b.salesValue - a.salesValue)
      .slice(0, widget.config.limit || 6);
    const max = Math.max(...rows.map((row) => Number(row[metric])), 1);
    if (!rows.length) return <p className="cc-empty">Brak aktywności doradców {periodLabel(period)}</p>;
    return (
      <div className="cc-ranking">
        {rows.map((row, index) => (
          <div className="cc-ranking-row" key={row.advisorId}>
            <b>{index + 1}</b>
            <span>{row.advisorName}</span>
            <div><i style={{ width: `${Math.max(5, (Number(row[metric]) / max) * 100)}%` }} /></div>
            <strong>{metric === "salesValue" ? formatCurrency(row.salesValue) : metric === "sales" ? row.sales : `${row[metric]}%`}</strong>
          </div>
        ))}
      </div>
    );
  }
  if (widget.kind === "monthly-target") {
    const target = Number(widget.config.targetAmount || 0);
    if (!target) return <p className="cc-empty">Ustaw cel dla wybranego okresu w konfiguracji widżetu</p>;
    const salesValue = periodValue(metrics.sales.valueByPeriod, period);
    const ratio = Math.min(100, Math.round((salesValue / target) * 100));
    return (
      <div className="cc-target">
        <div><strong>{ratio}%</strong><span>{formatCurrency(salesValue)} / {formatCurrency(target)} · {periodLabel(period)}</span></div>
        <div className="cc-target-track"><span style={{ width: `${ratio}%` }} /></div>
      </div>
    );
  }
  return (
    <div className="cc-ticker">
      <span>Okres: <b>{periodLabel(period)}</b></span>
      <span>Leady: <b>{periodValue(metrics.leads, period)}</b></span>
      <span>Leady z aktywnością: <b>{metrics.leads.contactRateByPeriod[period]}%</b></span>
      <span>Spotkania umówione: <b>{periodValue(metrics.meetings, period)}</b></span>
      <span>Telefony: <b>{periodValue(metrics.calls, period)}</b></span>
      <span>Sprzedaż: <b>{formatCurrency(periodValue(metrics.sales.valueByPeriod, period))}</b></span>
      {metrics.leads.averageFirstActivityMinutesByPeriod[period] !== null && (
        <span>Śr. czas do pierwszej aktywności: <b>{metrics.leads.averageFirstActivityMinutesByPeriod[period]} min</b></span>
      )}
    </div>
  );
}

export default function CommandCenterCanvas({
  page,
  metrics,
  dashboardName,
  theme,
  now = new Date(),
  editing = false,
  selectedWidgetId,
  onSelectWidget,
  onWidgetDrop,
  onLibraryDrop,
  footer,
}: CommandCenterCanvasProps) {
  const sortedWidgets = [...page.widgets].sort((a, b) => a.y - b.y || a.x - b.x);
  return (
    <section className={`cc-canvas cc-${theme} ${footer ? "cc-canvas-has-footer" : ""}`} data-theme={theme}>
      <header className="cc-header">
        <div className="cc-brand">
          <Image src="/logo.png" alt="IdeaSol" width={190} height={120} priority />
          <div><strong>Command Center</strong><span>{dashboardName} · {page.name}</span></div>
        </div>
        <time>
          <span>{new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now)}</span>
          <strong>{new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" }).format(now)}</strong>
        </time>
      </header>

      <div
        className={`cc-grid ${editing ? "cc-grid-editing" : ""}`}
        onDragOver={(event) => {
          if (!editing || !onLibraryDrop) return;
          event.preventDefault();
        }}
        onDrop={(event) => {
          if (!editing || !onLibraryDrop) return;
          const kind = event.dataTransfer.getData("application/x-cc-widget-kind");
          if (kind) onLibraryDrop(kind);
        }}
      >
        {sortedWidgets.map((widget) => {
          const style = {
            gridColumn: `${widget.x + 1} / span ${widget.w}`,
            gridRow: `${widget.y + 1} / span ${widget.h}`,
          } as CSSProperties;
          return (
            <article
              aria-label={editing ? `Edytuj widżet ${widget.title}` : undefined}
              className={`cc-widget ${selectedWidgetId === widget.id ? "cc-widget-selected" : ""}`}
              draggable={editing}
              key={widget.id}
              role={editing ? "button" : undefined}
              style={style}
              tabIndex={editing ? 0 : undefined}
              onClick={() => onSelectWidget?.(widget.id)}
              onKeyDown={(event) => {
                if (editing && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  onSelectWidget?.(widget.id);
                }
              }}
              onDragStart={(event: DragEvent<HTMLElement>) => {
                event.dataTransfer.setData("application/x-cc-widget-id", widget.id);
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(event) => {
                if (!editing) return;
                event.preventDefault();
                event.stopPropagation();
              }}
              onDrop={(event) => {
                if (!editing || !onWidgetDrop) return;
                event.preventDefault();
                event.stopPropagation();
                const sourceId = event.dataTransfer.getData("application/x-cc-widget-id");
                if (sourceId) onWidgetDrop(sourceId, widget.id);
              }}
            >
              <div className="cc-widget-title"><span>{widget.title}</span>{editing && <b aria-hidden="true">⠿</b>}</div>
              <WidgetBody widget={widget} metrics={metrics} />
            </article>
          );
        })}
      </div>
      {footer && <footer className="cc-footer">{footer}</footer>}
    </section>
  );
}
