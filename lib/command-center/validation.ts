import {
  COMMAND_CENTER_SCHEMA_VERSION,
  type CommandCenterSnapshot,
  type CommandCenterWidgetKind,
} from "./types";
import { COMMAND_CENTER_WIDGETS } from "./widget-registry";

const widgetKinds = new Set<CommandCenterWidgetKind>(
  COMMAND_CENTER_WIDGETS.map((definition) => definition.kind)
);
const periods = new Set(["yesterday", "today", "week", "month", "quarter"]);
const rankingMetrics = new Set(["sales", "salesValue", "contactRate", "conversion"]);

export function validateCommandCenterSnapshot(value: unknown): CommandCenterSnapshot {
  if (!value || typeof value !== "object") throw new Error("Konfiguracja dashboardu jest pusta.");
  const snapshot = value as Partial<CommandCenterSnapshot>;
  if (snapshot.schemaVersion !== COMMAND_CENTER_SCHEMA_VERSION) {
    throw new Error("Nieobsługiwana wersja konfiguracji dashboardu.");
  }
  if (!Array.isArray(snapshot.pages) || snapshot.pages.length === 0) {
    throw new Error("Dashboard musi zawierać co najmniej jeden ekran.");
  }
  if (snapshot.pages.length > 20) throw new Error("Dashboard może zawierać maksymalnie 20 ekranów.");

  const pageIds = new Set<string>();
  const pageOrders = new Set<number>();
  for (const page of snapshot.pages) {
    if (!page || typeof page !== "object" || typeof page.id !== "string" || !page.id || page.id.length > 120 || pageIds.has(page.id)) {
      throw new Error("Każdy ekran musi mieć unikalny identyfikator.");
    }
    pageIds.add(page.id);
    if (typeof page.name !== "string" || !page.name.trim() || page.name.length > 120) throw new Error("Każdy ekran musi mieć poprawną nazwę.");
    if (typeof page.enabled !== "boolean") throw new Error(`Ekran „${page.name}” ma nieprawidłowy stan aktywności.`);
    if (!Number.isInteger(page.order) || page.order < 0 || page.order > 99 || pageOrders.has(page.order)) throw new Error("Ekrany muszą mieć unikalną kolejność.");
    pageOrders.add(page.order);
    if (!Number.isInteger(page.rotationSeconds) || page.rotationSeconds < 10 || page.rotationSeconds > 3600) {
      throw new Error(`Czas rotacji ekranu „${page.name}” musi wynosić od 10 do 3600 sekund.`);
    }
    if (!Array.isArray(page.widgets)) throw new Error(`Ekran „${page.name}” ma nieprawidłową listę widżetów.`);
    if (page.widgets.length > 50) throw new Error(`Ekran „${page.name}” może zawierać maksymalnie 50 widżetów.`);

    const widgetIds = new Set<string>();
    for (const widget of page.widgets) {
      if (typeof widget.id !== "string" || !widget.id || widget.id.length > 160 || widgetIds.has(widget.id)) throw new Error(`Widżety na ekranie „${page.name}” muszą mieć unikalne ID.`);
      widgetIds.add(widget.id);
      if (!widgetKinds.has(widget.kind)) throw new Error(`Nieznany typ widżetu: ${widget.kind}.`);
      if (typeof widget.title !== "string" || !widget.title.trim() || widget.title.length > 120) throw new Error("Każdy widżet musi mieć poprawny tytuł.");
      if (!widget.config || typeof widget.config !== "object" || Array.isArray(widget.config)) throw new Error(`Widżet „${widget.title}” ma nieprawidłową konfigurację.`);
      if (!Number.isInteger(widget.w) || widget.w < 2 || widget.w > 12) throw new Error(`Nieprawidłowa szerokość widżetu „${widget.title}”.`);
      if (!Number.isInteger(widget.h) || widget.h < 1 || widget.h > 8) throw new Error(`Nieprawidłowa wysokość widżetu „${widget.title}”.`);
      if (!Number.isInteger(widget.x) || widget.x < 0 || widget.x > 11) throw new Error(`Nieprawidłowa pozycja widżetu „${widget.title}”.`);
      if (!Number.isInteger(widget.y) || widget.y < 0 || widget.y + widget.h > 8) throw new Error(`Widżet „${widget.title}” nie mieści się na ekranie.`);
      if (widget.x + widget.w > 12) throw new Error(`Widżet „${widget.title}” nie mieści się w 12 kolumnach.`);
      if (widget.config.period !== undefined && !periods.has(widget.config.period)) throw new Error(`Widżet „${widget.title}” ma nieprawidłowy okres.`);
      if (widget.config.rankingMetric !== undefined && !rankingMetrics.has(widget.config.rankingMetric)) throw new Error(`Widżet „${widget.title}” ma nieprawidłowe kryterium rankingu.`);
      if (widget.config.limit !== undefined && (!Number.isInteger(widget.config.limit) || widget.config.limit < 1 || widget.config.limit > 20)) throw new Error(`Widżet „${widget.title}” ma nieprawidłowy limit.`);
      if (widget.config.targetAmount !== undefined && (!Number.isFinite(widget.config.targetAmount) || widget.config.targetAmount < 0 || widget.config.targetAmount > 1_000_000_000_000)) throw new Error(`Widżet „${widget.title}” ma nieprawidłowy cel.`);
    }

    for (let index = 0; index < page.widgets.length; index += 1) {
      const current = page.widgets[index];
      const overlap = page.widgets.slice(index + 1).find((candidate) =>
        current.x < candidate.x + candidate.w &&
        current.x + current.w > candidate.x &&
        current.y < candidate.y + candidate.h &&
        current.y + current.h > candidate.y
      );
      if (overlap) {
        throw new Error(`Widżety „${current.title}” i „${overlap.title}” nachodzą na siebie.`);
      }
    }
  }

  if (!snapshot.pages.some((page) => page.enabled)) {
    throw new Error("Przed publikacją włącz co najmniej jeden ekran.");
  }

  return snapshot as CommandCenterSnapshot;
}
