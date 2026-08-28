"use client";

import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react";

import { supabase } from "@/lib/supabase";
import DashboardTour from "@/app/components/DashboardTour";

type DashboardWidgetId = "calendar" | "sales" | "quick-calculator" | "sticky-notes";
type DashboardWidgetWidth = "narrow" | "medium" | "wide" | "full";
type DashboardWidgetHeight = "auto" | "compact" | "tall";

type DashboardWidgetLayout = {
  id: DashboardWidgetId;
  width: DashboardWidgetWidth;
  height: DashboardWidgetHeight;
  hidden: boolean;
};

type DashboardGridProps = {
  currentUserId: string;
  calendarWidget: ReactNode;
  salesWidget: ReactNode;
  quickCalculatorWidget: ReactNode;
  stickyNotesWidget: ReactNode;
};

const LAYOUT_VERSION = 1;
const DASHBOARD_WIDGET_IDS: DashboardWidgetId[] = [
  "calendar",
  "sales",
  "quick-calculator",
  "sticky-notes",
];

const DEFAULT_LAYOUT: DashboardWidgetLayout[] = [
  { id: "quick-calculator", width: "medium", height: "auto", hidden: false },
  { id: "sales", width: "medium", height: "auto", hidden: false },
  { id: "calendar", width: "full", height: "auto", hidden: false },
  { id: "sticky-notes", width: "full", height: "auto", hidden: false },
];

const WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  calendar: "Kalendarz spotkań",
  sales: "Podsumowanie sprzedaży",
  "quick-calculator": "Szybki kalkulator",
  "sticky-notes": "Tablica zadań",
};

const WIDTH_OPTIONS: Array<{ value: DashboardWidgetWidth; label: string }> = [
  { value: "narrow", label: "1/3 szerokości" },
  { value: "medium", label: "1/2 szerokości" },
  { value: "wide", label: "2/3 szerokości" },
  { value: "full", label: "Pełna szerokość" },
];

const HEIGHT_OPTIONS: Array<{ value: DashboardWidgetHeight; label: string }> = [
  { value: "auto", label: "Wysokość automatyczna" },
  { value: "compact", label: "Wysokość kompaktowa" },
  { value: "tall", label: "Wysoki widget" },
];

const WIDTH_CLASSES: Record<DashboardWidgetWidth, string> = {
  narrow: "lg:col-span-4",
  medium: "lg:col-span-6",
  wide: "lg:col-span-8",
  full: "lg:col-span-12",
};

const HEIGHT_CLASSES: Record<DashboardWidgetHeight, string> = {
  auto: "",
  compact: "lg:h-[28rem] lg:overflow-auto",
  tall: "lg:min-h-[42rem] lg:[&>*]:min-h-[42rem]",
};

function cloneDefaultLayout() {
  return DEFAULT_LAYOUT.map((widget) => ({ ...widget }));
}

function isWidgetId(value: unknown): value is DashboardWidgetId {
  return DASHBOARD_WIDGET_IDS.includes(value as DashboardWidgetId);
}

function isWidgetWidth(value: unknown): value is DashboardWidgetWidth {
  return WIDTH_OPTIONS.some((option) => option.value === value);
}

function isWidgetHeight(value: unknown): value is DashboardWidgetHeight {
  return HEIGHT_OPTIONS.some((option) => option.value === value);
}

function normalizeLayout(value: unknown) {
  const rawWidgets = Array.isArray(value) ? value : [];
  const seenIds = new Set<DashboardWidgetId>();
  const normalizedWidgets: DashboardWidgetLayout[] = [];

  rawWidgets.forEach((rawWidget) => {
    if (!rawWidget || typeof rawWidget !== "object") return;

    const candidate = rawWidget as Partial<DashboardWidgetLayout>;
    if (!isWidgetId(candidate.id) || seenIds.has(candidate.id)) return;

    const fallback = DEFAULT_LAYOUT.find((widget) => widget.id === candidate.id)!;
    seenIds.add(candidate.id);
    normalizedWidgets.push({
      id: candidate.id,
      width: isWidgetWidth(candidate.width) ? candidate.width : fallback.width,
      height: isWidgetHeight(candidate.height) ? candidate.height : fallback.height,
      hidden: candidate.hidden === true,
    });
  });

  DEFAULT_LAYOUT.forEach((widget) => {
    if (!seenIds.has(widget.id)) normalizedWidgets.push({ ...widget });
  });

  return normalizedWidgets;
}

function getLocalStorageKey(userId: string) {
  return `ideasol:dashboard-layout:v${LAYOUT_VERSION}:${userId}`;
}

function getTourStorageKey(userId: string) {
  return `ideasol:dashboard-tour-completed:${userId}`;
}

export default function DashboardGrid({
  currentUserId,
  calendarWidget,
  salesWidget,
  quickCalculatorWidget,
  stickyNotesWidget,
}: DashboardGridProps) {
  const [layout, setLayout] = useState<DashboardWidgetLayout[]>(cloneDefaultLayout);
  const [editing, setEditing] = useState(false);
  const [draggedId, setDraggedId] = useState<DashboardWidgetId | null>(null);
  const [dragOverId, setDragOverId] = useState<DashboardWidgetId | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "account" | "local">("idle");
  const [tourOpen, setTourOpen] = useState(false);
  const [tourReady, setTourReady] = useState(false);

  const widgetContent = useMemo<Record<DashboardWidgetId, ReactNode>>(
    () => ({
      calendar: calendarWidget,
      sales: salesWidget,
      "quick-calculator": quickCalculatorWidget,
      "sticky-notes": stickyNotesWidget,
    }),
    [calendarWidget, quickCalculatorWidget, salesWidget, stickyNotesWidget]
  );

  useEffect(() => {
    let cancelled = false;
    async function loadLayout() {
      setLoaded(false);
      setSaveStatus("idle");
      setTourOpen(false);
      setTourReady(false);
      let cachedLayout: DashboardWidgetLayout[] | null = null;
      let tourCompleted = false;

      try {
        const rawCachedLayout = window.localStorage.getItem(getLocalStorageKey(currentUserId));
        if (rawCachedLayout) cachedLayout = normalizeLayout(JSON.parse(rawCachedLayout));
        tourCompleted = window.localStorage.getItem(getTourStorageKey(currentUserId)) === "completed";
      } catch {
        cachedLayout = null;
      }

      if (cachedLayout && !cancelled) setLayout(cachedLayout);

      const previewTour =
        new URLSearchParams(window.location.search).get("dashboard-tour-preview") === "1";

      const { data, error } = await supabase
        .from("dashboard_layouts")
        .select("layout, layout_version, tour_completed_at")
        .eq("user_id", currentUserId)
        .maybeSingle();

      if (cancelled) return;
      if (!error && data?.layout) {
        const accountLayout = normalizeLayout(data.layout);
        setLayout(accountLayout);
        window.localStorage.setItem(
          getLocalStorageKey(currentUserId),
          JSON.stringify(accountLayout)
        );
        setSaveStatus("account");
      } else if (cachedLayout) {
        setSaveStatus("local");
      }

      if (!error && data?.tour_completed_at) {
        tourCompleted = true;
        try {
          window.localStorage.setItem(getTourStorageKey(currentUserId), "completed");
        } catch {
          // Zapis konta pozostaje źródłem prawdy, gdy przeglądarka blokuje localStorage.
        }
      }

      setLoaded(true);
      setTourReady(true);
      setTourOpen(previewTour || !tourCompleted);
    }

    void loadLayout();

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!loaded) return;

    window.localStorage.setItem(getLocalStorageKey(currentUserId), JSON.stringify(layout));

    const timeoutId = window.setTimeout(async () => {
      setSaveStatus("saving");
      const { error } = await supabase.from("dashboard_layouts").upsert(
        {
          user_id: currentUserId,
          layout,
          layout_version: LAYOUT_VERSION,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      setSaveStatus(error ? "local" : "account");
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [currentUserId, layout, loaded]);

  const hiddenWidgets = layout.filter((widget) => widget.hidden);
  const visibleWidgets = layout.filter((widget) => !widget.hidden);

  function updateWidget(
    widgetId: DashboardWidgetId,
    update: Partial<Pick<DashboardWidgetLayout, "width" | "height" | "hidden">>
  ) {
    setLayout((current) =>
      current.map((widget) => (widget.id === widgetId ? { ...widget, ...update } : widget))
    );
  }

  function moveWidget(sourceId: DashboardWidgetId, targetId: DashboardWidgetId) {
    if (sourceId === targetId) return;

    setLayout((current) => {
      const sourceIndex = current.findIndex((widget) => widget.id === sourceId);
      const targetIndex = current.findIndex((widget) => widget.id === targetId);

      if (sourceIndex < 0 || targetIndex < 0) return current;

      const nextLayout = [...current];
      const [movedWidget] = nextLayout.splice(sourceIndex, 1);
      const adjustedTargetIndex = nextLayout.findIndex((widget) => widget.id === targetId);
      const insertionIndex = sourceIndex < targetIndex
        ? adjustedTargetIndex + 1
        : adjustedTargetIndex;
      nextLayout.splice(insertionIndex, 0, movedWidget);
      return nextLayout;
    });
  }

  function moveWidgetByStep(widgetId: DashboardWidgetId, direction: -1 | 1) {
    const visibleIndex = visibleWidgets.findIndex((widget) => widget.id === widgetId);
    const targetWidget = visibleWidgets[visibleIndex + direction];
    if (targetWidget) moveWidget(widgetId, targetWidget.id);
  }

  function handleDragStart(event: DragEvent<HTMLDivElement>, widgetId: DashboardWidgetId) {
    if (!editing) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", widgetId);
    setDraggedId(widgetId);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, targetId: DashboardWidgetId) {
    event.preventDefault();
    const sourceId = (draggedId || event.dataTransfer.getData("text/plain")) as DashboardWidgetId;
    if (isWidgetId(sourceId)) moveWidget(sourceId, targetId);
    setDraggedId(null);
    setDragOverId(null);
  }

  function resetLayout() {
    setLayout(cloneDefaultLayout());
    setDraggedId(null);
    setDragOverId(null);
  }

  async function completeTour() {
    const completedAt = new Date().toISOString();
    setTourOpen(false);

    try {
      window.localStorage.setItem(getTourStorageKey(currentUserId), "completed");
    } catch {
      // Nie blokuj trwałego zapisu na koncie, gdy przeglądarka odrzuca localStorage.
    }

    const { error } = await supabase.from("dashboard_layouts").upsert(
      {
        user_id: currentUserId,
        layout,
        layout_version: LAYOUT_VERSION,
        tour_completed_at: completedAt,
        updated_at: completedAt,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.error("Nie udało się zapisać ukończenia samouczka", error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Twój pulpit</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {editing
              ? "Przeciągaj moduły i ustawiaj ich rozmiar. Na telefonie kolejność pozostaje jednokolumnowa."
              : "Kolejność i rozmiar widgetów możesz dopasować do swojej pracy."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {saveStatus !== "idle" && (
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              {saveStatus === "saving"
                ? "Zapisywanie..."
                : saveStatus === "account"
                  ? "Zapisano na koncie"
                  : "Zapisano na tym urządzeniu"}
            </span>
          )}
          {editing && (
            <button
              type="button"
              onClick={resetLayout}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Przywróć domyślny
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing((current) => !current)}
            data-dashboard-tour-target="personalize"
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              editing
                ? "bg-slate-900 text-white hover:bg-slate-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                : "bg-emerald-500 text-white hover:bg-emerald-400"
            }`}
          >
            {editing ? "Zakończ edycję" : "Dostosuj pulpit"}
          </button>
        </div>
      </div>

      {editing && hiddenWidgets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 dark:border-slate-600 dark:bg-slate-800/60">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Ukryte widgety:</span>
          {hiddenWidgets.map((widget) => (
            <button
              key={widget.id}
              type="button"
              onClick={() => updateWidget(widget.id, { hidden: false })}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            >
              + {WIDGET_LABELS[widget.id]}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {visibleWidgets.map((widget, visibleIndex) => (
          <div
            key={widget.id}
            data-dashboard-widget={widget.id}
            data-widget-width={widget.width}
            draggable={editing}
            onDragStart={(event) => handleDragStart(event, widget.id)}
            onDragEnd={() => {
              setDraggedId(null);
              setDragOverId(null);
            }}
            onDragOver={(event) => {
              if (!editing) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDragOverId(widget.id);
            }}
            onDragLeave={() => setDragOverId((current) => (current === widget.id ? null : current))}
            onDrop={(event) => handleDrop(event, widget.id)}
            className={`min-w-0 ${WIDTH_CLASSES[widget.width]} ${HEIGHT_CLASSES[widget.height]} ${
              editing
                ? "rounded-2xl ring-2 ring-blue-300 ring-offset-4 ring-offset-slate-100 dark:ring-blue-500 dark:ring-offset-slate-950"
                : ""
            } ${draggedId === widget.id ? "opacity-45" : "opacity-100"} ${
              dragOverId === widget.id ? "ring-4 ring-emerald-400" : ""
            }`}
          >
            {editing && (
              <div className="mb-2 flex cursor-grab flex-col gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 active:cursor-grabbing dark:border-blue-800 dark:bg-blue-950/60 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-900 dark:text-blue-100">
                  <span aria-hidden="true" className="text-base tracking-[-0.2em]">⠿</span>
                  {WIDGET_LABELS[widget.id]}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => moveWidgetByStep(widget.id, -1)}
                    disabled={visibleIndex === 0}
                    className="h-8 rounded-lg border border-blue-200 bg-white px-2 text-xs font-bold text-blue-800 disabled:opacity-30 dark:border-blue-700 dark:bg-slate-900 dark:text-blue-200"
                    aria-label={`Przesuń ${WIDGET_LABELS[widget.id]} wyżej`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveWidgetByStep(widget.id, 1)}
                    disabled={visibleIndex === visibleWidgets.length - 1}
                    className="h-8 rounded-lg border border-blue-200 bg-white px-2 text-xs font-bold text-blue-800 disabled:opacity-30 dark:border-blue-700 dark:bg-slate-900 dark:text-blue-200"
                    aria-label={`Przesuń ${WIDGET_LABELS[widget.id]} niżej`}
                  >
                    ↓
                  </button>
                  <label className="sr-only" htmlFor={`dashboard-width-${widget.id}`}>
                    Szerokość widgetu {WIDGET_LABELS[widget.id]}
                  </label>
                  <select
                    id={`dashboard-width-${widget.id}`}
                    value={widget.width}
                    onChange={(event) =>
                      updateWidget(widget.id, {
                        width: event.target.value as DashboardWidgetWidth,
                      })
                    }
                    className="h-8 rounded-lg border border-blue-200 bg-white px-2 text-[11px] font-semibold text-slate-700 outline-none dark:border-blue-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {WIDTH_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <label className="sr-only" htmlFor={`dashboard-height-${widget.id}`}>
                    Wysokość widgetu {WIDGET_LABELS[widget.id]}
                  </label>
                  <select
                    id={`dashboard-height-${widget.id}`}
                    value={widget.height}
                    onChange={(event) =>
                      updateWidget(widget.id, {
                        height: event.target.value as DashboardWidgetHeight,
                      })
                    }
                    className="h-8 rounded-lg border border-blue-200 bg-white px-2 text-[11px] font-semibold text-slate-700 outline-none dark:border-blue-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {HEIGHT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => updateWidget(widget.id, { hidden: true })}
                    className="h-8 rounded-lg border border-blue-200 bg-white px-2.5 text-[11px] font-bold text-slate-600 transition hover:border-red-300 hover:text-red-600 dark:border-blue-700 dark:bg-slate-900 dark:text-slate-300"
                  >
                    Ukryj
                  </button>
                </div>
              </div>
            )}

            <div className="h-full [&>*]:h-full">{widgetContent[widget.id]}</div>
          </div>
        ))}
      </div>

      <DashboardTour open={tourReady && tourOpen} onComplete={completeTour} />
    </div>
  );
}
