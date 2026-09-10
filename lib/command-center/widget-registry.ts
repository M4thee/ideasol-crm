import type {
  CommandCenterSnapshot,
  CommandCenterWidget,
  CommandCenterWidgetKind,
} from "./types";

export type CommandCenterWidgetDefinition = {
  kind: CommandCenterWidgetKind;
  name: string;
  description: string;
  defaultSize: { w: number; h: number };
};

export const COMMAND_CENTER_WIDGETS: CommandCenterWidgetDefinition[] = [
  { kind: "leads-kpi", name: "Leady", description: "Liczba nowych leadów w wybranym okresie.", defaultSize: { w: 3, h: 2 } },
  { kind: "sales-kpi", name: "Sprzedaże", description: "Liczba nieanulowanych sprzedaży.", defaultSize: { w: 3, h: 2 } },
  { kind: "sales-value", name: "Wartość sprzedaży", description: "Suma potwierdzonego pola contract_value.", defaultSize: { w: 3, h: 2 } },
  { kind: "meetings-today", name: "Spotkania dziś", description: "Spotkania z kalendarza CRM zaplanowane na dziś.", defaultSize: { w: 3, h: 2 } },
  { kind: "lead-funnel", name: "Lejek leadów", description: "Kohorta leadów miesiąca: aktywność, spotkanie, oferta, sprzedaż.", defaultSize: { w: 5, h: 5 } },
  { kind: "lead-sources", name: "Źródła leadów", description: "Rozkład pola lead_source dla nowych leadów.", defaultSize: { w: 4, h: 4 } },
  { kind: "lead-statuses", name: "Statusy leadów", description: "Rozkład bieżącego statusu klientów-leadów.", defaultSize: { w: 4, h: 4 } },
  { kind: "advisor-ranking", name: "Ranking doradców", description: "Informacyjne zestawienie sprzedaży, konwersji i podejmowalności.", defaultSize: { w: 7, h: 5 } },
  { kind: "monthly-target", name: "Cel miesięczny", description: "Realizacja celu ustawionego w konfiguracji widżetu.", defaultSize: { w: 4, h: 3 } },
  { kind: "status-ticker", name: "Pasek informacyjny", description: "Subtelne podsumowanie zagregowanych danych.", defaultSize: { w: 12, h: 1 } },
];

function widget(
  id: string,
  kind: CommandCenterWidgetKind,
  title: string,
  x: number,
  y: number,
  w: number,
  h: number,
  config: CommandCenterWidget["config"] = {}
): CommandCenterWidget {
  return { id, kind, title, x, y, w, h, config };
}

export function createDefaultCommandCenterSnapshot(): CommandCenterSnapshot {
  return {
    schemaVersion: 1,
    pages: [
      {
        id: "overview",
        name: "Sytuacja firmy",
        enabled: true,
        order: 0,
        rotationSeconds: 30,
        widgets: [
          widget("leads-month", "leads-kpi", "Nowe leady", 0, 0, 3, 2, { period: "month" }),
          widget("sales-month", "sales-kpi", "Sprzedaże", 3, 0, 3, 2, { period: "month" }),
          widget("sales-value-month", "sales-value", "Wartość sprzedaży", 6, 0, 3, 2, { period: "month" }),
          widget("meetings-today", "meetings-today", "Spotkania dziś", 9, 0, 3, 2),
          widget("funnel", "lead-funnel", "Lejek — bieżący miesiąc", 0, 2, 5, 5),
          widget("ranking", "advisor-ranking", "Wyniki doradców", 5, 2, 7, 5, { rankingMetric: "salesValue", limit: 6 }),
          widget("ticker", "status-ticker", "Stan firmy", 0, 7, 12, 1),
        ],
      },
      {
        id: "lead-quality",
        name: "Leady i kontakt",
        enabled: true,
        order: 1,
        rotationSeconds: 30,
        widgets: [
          widget("leads-today", "leads-kpi", "Leady dzisiaj", 0, 0, 4, 2, { period: "today" }),
          widget("leads-week", "leads-kpi", "Leady w tym tygodniu", 4, 0, 4, 2, { period: "week" }),
          widget("leads-month-2", "leads-kpi", "Leady w tym miesiącu", 8, 0, 4, 2, { period: "month" }),
          widget("sources", "lead-sources", "Źródła leadów", 0, 2, 6, 5),
          widget("statuses", "lead-statuses", "Statusy leadów", 6, 2, 6, 5),
          widget("ticker-2", "status-ticker", "Stan firmy", 0, 7, 12, 1),
        ],
      },
    ],
  };
}

export function createWidget(kind: CommandCenterWidgetKind): CommandCenterWidget {
  const definition = COMMAND_CENTER_WIDGETS.find((item) => item.kind === kind)!;
  return {
    id: `${kind}-${crypto.randomUUID()}`,
    kind,
    title: definition.name,
    x: 0,
    y: 99,
    w: definition.defaultSize.w,
    h: definition.defaultSize.h,
    config: kind === "leads-kpi" || kind === "sales-kpi" || kind === "sales-value"
      ? { period: "month" }
      : kind === "advisor-ranking"
        ? { rankingMetric: "salesValue", limit: 6 }
        : {},
  };
}

