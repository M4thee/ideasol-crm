"use client";

import Image from "next/image";
import type { CSSProperties, DragEvent } from "react";

import type {
  CommandCenterMetrics,
  CommandCenterPage,
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
    today: 0,
    week: 0,
    month: 0,
    contactedMonth: 0,
    contactRateMonth: 0,
    averageFirstActivityMinutes: null,
    sources: [],
    statuses: [],
  },
  sales: { today: 0, week: 0, month: 0, valueToday: 0, valueWeek: 0, valueMonth: 0 },
  funnel: { leads: 0, contacted: 0, meetings: 0, offers: 0, sales: 0 },
  meetings: { today: 0, upcomingToday: 0 },
  ranking: [],
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
  if (period === "today") return "dzisiaj";
  if (period === "week") return "w tym tygodniu";
  return "w tym miesiącu";
}

function periodValue(
  values: { today: number; week: number; month: number },
  period: CommandCenterWidget["config"]["period"]
) {
  return values[period || "month"];
}

function Bars({ rows, total }: { rows: Array<{ label: string; value: number }>; total: number }) {
  const visible = rows.slice(0, 6);
  if (!visible.length) return <p className="cc-empty">Brak danych w bieżącym miesiącu</p>;
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

function WidgetBody({ widget, metrics }: { widget: CommandCenterWidget; metrics: CommandCenterMetrics }) {
  if (widget.kind === "leads-kpi") {
    const value = periodValue(metrics.leads, widget.config.period);
    return <div className="cc-kpi"><strong>{value}</strong><span>leadów {periodLabel(widget.config.period)}</span></div>;
  }
  if (widget.kind === "sales-kpi") {
    const value = periodValue(metrics.sales, widget.config.period);
    return <div className="cc-kpi"><strong>{value}</strong><span>sprzedaży {periodLabel(widget.config.period)}</span></div>;
  }
  if (widget.kind === "sales-value") {
    const value = periodValue(
      { today: metrics.sales.valueToday, week: metrics.sales.valueWeek, month: metrics.sales.valueMonth },
      widget.config.period
    );
    return <div className="cc-kpi cc-kpi-currency"><strong>{formatCurrency(value)}</strong><span>{periodLabel(widget.config.period)}</span></div>;
  }
  if (widget.kind === "meetings-today") {
    return (
      <div className="cc-kpi"><strong>{metrics.meetings.today}</strong><span>{metrics.meetings.upcomingToday} jeszcze przed nami</span></div>
    );
  }
  if (widget.kind === "lead-sources") return <Bars rows={metrics.leads.sources} total={metrics.leads.month} />;
  if (widget.kind === "lead-statuses") return <Bars rows={metrics.leads.statuses} total={metrics.leads.month} />;
  if (widget.kind === "lead-funnel") {
    const stages = [
      ["Leady", metrics.funnel.leads],
      ["Z aktywnością", metrics.funnel.contacted],
      ["Spotkania", metrics.funnel.meetings],
      ["Oferty", metrics.funnel.offers],
      ["Sprzedaże", metrics.funnel.sales],
    ] as const;
    return (
      <div className="cc-funnel">
        {stages.map(([label, value], index) => {
          const ratio = metrics.funnel.leads ? Math.round((value / metrics.funnel.leads) * 100) : 0;
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
    const rows = [...metrics.ranking]
      .sort((a, b) => Number(b[metric]) - Number(a[metric]) || b.salesValue - a.salesValue)
      .slice(0, widget.config.limit || 6);
    const max = Math.max(...rows.map((row) => Number(row[metric])), 1);
    if (!rows.length) return <p className="cc-empty">Brak aktywności doradców w bieżącym miesiącu</p>;
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
    if (!target) return <p className="cc-empty">Ustaw miesięczny cel w konfiguracji widżetu</p>;
    const ratio = Math.min(100, Math.round((metrics.sales.valueMonth / target) * 100));
    return (
      <div className="cc-target">
        <div><strong>{ratio}%</strong><span>{formatCurrency(metrics.sales.valueMonth)} / {formatCurrency(target)}</span></div>
        <div className="cc-target-track"><span style={{ width: `${ratio}%` }} /></div>
      </div>
    );
  }
  return (
    <div className="cc-ticker">
      <span>Leady: <b>{metrics.leads.month}</b></span>
      <span>Leady z aktywnością: <b>{metrics.leads.contactRateMonth}%</b></span>
      <span>Spotkania dziś: <b>{metrics.meetings.today}</b></span>
      <span>Sprzedaż MTD: <b>{formatCurrency(metrics.sales.valueMonth)}</b></span>
      {metrics.leads.averageFirstActivityMinutes !== null && (
        <span>Śr. czas do pierwszej aktywności: <b>{metrics.leads.averageFirstActivityMinutes} min</b></span>
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
