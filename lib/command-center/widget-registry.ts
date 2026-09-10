import type {
  CommandCenterPeriod,
  CommandCenterSnapshot,
  CommandCenterWidget,
  CommandCenterWidgetKind,
} from "./types";

export type CommandCenterWidgetDefinition = {
  id: string;
  kind: CommandCenterWidgetKind;
  name: string;
  description: string;
  defaultSize: { w: number; h: number };
  defaultPeriod?: CommandCenterPeriod;
  hidden?: boolean;
};

const periods: Array<{ value: CommandCenterPeriod; label: string }> = [
  { value: "today", label: "dzień" },
  { value: "week", label: "tydzień" },
  { value: "month", label: "miesiąc" },
  { value: "quarter", label: "kwartał" },
];

function periodPresets(
  kind: CommandCenterWidgetKind,
  name: string,
  description: string
): CommandCenterWidgetDefinition[] {
  return periods.map((period) => ({
    id: `${kind}-${period.value}`,
    kind,
    name: `${name} — ${period.label}`,
    description: `${description} (${period.label}).`,
    defaultSize: { w: 3, h: 2 },
    defaultPeriod: period.value,
  }));
}

export const COMMAND_CENTER_WIDGETS: CommandCenterWidgetDefinition[] = [
  ...periodPresets("sales-kpi", "Sprzedaż", "Liczba nieanulowanych sprzedaży w bieżącym okresie"),
  ...periodPresets("meetings-kpi", "Spotkania umówione", "Nowe spotkania zapisane w kalendarzu CRM w bieżącym okresie"),
  ...periodPresets("leads-kpi", "Nowe leady", "Liczba leadów utworzonych w bieżącym okresie"),
  ...periodPresets("calls-kpi", "Wykonane telefony", "Liczba aktywności telefonicznych zapisanych w CRM w bieżącym okresie"),
  { id: "sales-value", kind: "sales-value", name: "Wartość sprzedaży", description: "Suma potwierdzonego pola contract_value.", defaultSize: { w: 3, h: 2 }, defaultPeriod: "month" },
  { id: "meetings-today-legacy", kind: "meetings-today", name: "Spotkania dziś", description: "Spotkania z kalendarza CRM zaplanowane na dziś.", defaultSize: { w: 3, h: 2 }, hidden: true },
  { id: "lead-funnel", kind: "lead-funnel", name: "Lejek leadów", description: "Kohorta leadów miesiąca: aktywność, spotkanie, oferta, sprzedaż.", defaultSize: { w: 5, h: 5 } },
  { id: "lead-sources", kind: "lead-sources", name: "Źródła leadów", description: "Rozkład pola lead_source dla nowych leadów.", defaultSize: { w: 4, h: 4 } },
  { id: "lead-statuses", kind: "lead-statuses", name: "Statusy leadów", description: "Rozkład bieżącego statusu klientów-leadów.", defaultSize: { w: 4, h: 4 } },
  { id: "advisor-ranking", kind: "advisor-ranking", name: "Ranking doradców", description: "Informacyjne zestawienie sprzedaży, konwersji i podejmowalności.", defaultSize: { w: 7, h: 5 } },
  { id: "monthly-target", kind: "monthly-target", name: "Cel miesięczny", description: "Realizacja celu ustawionego w konfiguracji widżetu.", defaultSize: { w: 4, h: 3 } },
  { id: "status-ticker", kind: "status-ticker", name: "Pasek informacyjny", description: "Subtelne podsumowanie zagregowanych danych.", defaultSize: { w: 12, h: 1 } },
];

export const VISIBLE_COMMAND_CENTER_WIDGETS = COMMAND_CENTER_WIDGETS.filter((definition) => !definition.hidden);

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
          widget("leads-today", "leads-kpi", "Leady dzisiaj", 0, 0, 3, 2, { period: "today" }),
          widget("leads-week", "leads-kpi", "Leady w tym tygodniu", 3, 0, 3, 2, { period: "week" }),
          widget("leads-month-2", "leads-kpi", "Leady w tym miesiącu", 6, 0, 3, 2, { period: "month" }),
          widget("leads-quarter", "leads-kpi", "Leady w tym kwartale", 9, 0, 3, 2, { period: "quarter" }),
          widget("sources", "lead-sources", "Źródła leadów", 0, 2, 6, 5),
          widget("statuses", "lead-statuses", "Statusy leadów", 6, 2, 6, 5),
          widget("ticker-2", "status-ticker", "Stan firmy", 0, 7, 12, 1),
        ],
      },
    ],
  };
}

export function createWidget(definitionId: string): CommandCenterWidget {
  const definition = COMMAND_CENTER_WIDGETS.find((item) => item.id === definitionId)
    || COMMAND_CENTER_WIDGETS.find((item) => item.kind === definitionId);
  if (!definition) throw new Error(`Nieznany widżet: ${definitionId}.`);
  return {
    id: `${definition.kind}-${crypto.randomUUID()}`,
    kind: definition.kind,
    title: definition.name,
    x: 0,
    y: 99,
    w: definition.defaultSize.w,
    h: definition.defaultSize.h,
    config: definition.defaultPeriod
      ? { period: definition.defaultPeriod }
      : definition.kind === "advisor-ranking"
        ? { rankingMetric: "salesValue", limit: 6 }
        : {},
  };
}
