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
  { value: "yesterday", label: "wczoraj" },
  { value: "today", label: "dzisiaj" },
  { value: "week", label: "tydzień" },
  { value: "month", label: "miesiąc" },
  { value: "quarter", label: "kwartał" },
];

function periodPresets(
  kind: CommandCenterWidgetKind,
  name: string,
  description: string,
  defaultSize: { w: number; h: number } = { w: 3, h: 2 }
): CommandCenterWidgetDefinition[] {
  return periods.map((period) => ({
    id: `${kind}-${period.value}`,
    kind,
    name: `${name} — ${period.label}`,
    description: `${description} (${period.label}).`,
    defaultSize,
    defaultPeriod: period.value,
  }));
}

export const COMMAND_CENTER_WIDGETS: CommandCenterWidgetDefinition[] = [
  ...periodPresets("sales-kpi", "Sprzedaż", "Liczba nieanulowanych sprzedaży w bieżącym okresie"),
  ...periodPresets("meetings-kpi", "Spotkania umówione", "Nowe spotkania zapisane w kalendarzu CRM w bieżącym okresie"),
  ...periodPresets("leads-kpi", "Nowe leady", "Liczba leadów utworzonych w bieżącym okresie"),
  ...periodPresets("calls-kpi", "Wykonane telefony", "Liczba aktywności telefonicznych zapisanych w CRM w bieżącym okresie"),
  ...periodPresets("sales-value", "Wartość sprzedaży", "Suma potwierdzonego pola contract_value w bieżącym okresie"),
  ...periodPresets("lead-funnel", "Lejek leadów", "Kohorta leadów oraz jej aktywności, spotkania, oferty i sprzedaże", { w: 5, h: 5 }),
  ...periodPresets("lead-sources", "Źródła leadów", "Rozkład pola lead_source dla nowych leadów", { w: 4, h: 4 }),
  ...periodPresets("lead-statuses", "Statusy leadów", "Rozkład bieżącego statusu nowych leadów", { w: 4, h: 4 }),
  ...periodPresets("lead-map", "Mapa leadów — Polska", "Punkty leadów według kodów pocztowych i lokalnego katalogu współrzędnych", { w: 6, h: 5 }),
  ...periodPresets("advisor-ranking", "Ranking doradców", "Informacyjne zestawienie sprzedaży, konwersji i podejmowalności", { w: 7, h: 5 }),
  ...periodPresets("monthly-target", "Cel sprzedażowy", "Realizacja celu ustawionego dla wybranego okresu", { w: 4, h: 3 }),
  ...periodPresets("status-ticker", "Pasek informacyjny", "Podsumowanie zagregowanych danych dla wybranego okresu", { w: 12, h: 1 }),
  { id: "meetings-today-legacy", kind: "meetings-today", name: "Spotkania dziś", description: "Spotkania z kalendarza CRM zaplanowane na dziś.", defaultSize: { w: 3, h: 2 }, hidden: true },
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
          widget("meetings-today", "meetings-kpi", "Spotkania umówione dzisiaj", 9, 0, 3, 2, { period: "today" }),
          widget("funnel", "lead-funnel", "Lejek — bieżący miesiąc", 0, 2, 5, 5, { period: "month" }),
          widget("ranking", "advisor-ranking", "Wyniki doradców", 5, 2, 7, 5, { period: "month", rankingMetric: "salesValue", limit: 6 }),
          widget("ticker", "status-ticker", "Stan firmy", 0, 7, 12, 1, { period: "month" }),
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
          widget("sources", "lead-sources", "Źródła leadów", 0, 2, 6, 5, { period: "month" }),
          widget("statuses", "lead-statuses", "Statusy leadów", 6, 2, 6, 5, { period: "month" }),
          widget("ticker-2", "status-ticker", "Stan firmy", 0, 7, 12, 1, { period: "month" }),
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
    config: {
      ...(definition.defaultPeriod ? { period: definition.defaultPeriod } : {}),
      ...(definition.kind === "advisor-ranking" ? { rankingMetric: "salesValue" as const, limit: 6 } : {}),
    },
  };
}
